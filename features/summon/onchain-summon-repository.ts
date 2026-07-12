import * as Crypto from 'expo-crypto'
import { EventParser, Program, type Idl } from '@anchor-lang/core'
import { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID } from '@magicblock-labs/ephemeral-rollups-sdk'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { collectibleAt, collectibles } from './catalog'
import { sendSimulatedTransaction, type PrivySolanaWallet } from './privy-transaction-sender'
import type { PullRecord, SummonRepository, SummonSnapshot } from './types'

const PLAYER_SEED = new TextEncoder().encode('player')
const EPHEMERAL_VRF_QUEUE = new PublicKey('5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc')
const ASIA_ER_VALIDATOR = new PublicKey('MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57')
// Must match programs/summon/src/lib.rs. The SBF-safe account layout stores
// the newest 16 resolved pulls on-chain.
const HISTORY_CAPACITY = 16
const ER_PROPAGATION_TIMEOUT_MS = 180_000
const VRF_CALLBACK_TIMEOUT_MS = 120_000

type AnchorNumber = { toString(): string }
type PullEntryAccount = {
  nonce: AnchorNumber
  collectibleIndex: number
  roll: number
  resolvedAt: AnchorNumber
  randomness: number[]
}
type PlayerAccount = {
  authority: PublicKey
  inventory: number[]
  totalPulls: AnchorNumber
  requestNonce: AnchorNumber
  pending: boolean
  pendingNonce: AnchorNumber
  historyLen: number
  historyCursor: number
  history: PullEntryAccount[]
}

export function createOnchainSummonRepository({
  idl,
  baseConnection,
  ephemeralConnection,
  wallet,
  configuredProgramId,
  networkId,
}: {
  idl: Idl
  baseConnection: Connection
  ephemeralConnection: Connection
  wallet: PrivySolanaWallet
  configuredProgramId: string
  networkId: string
}): SummonRepository {
  if (networkId !== 'solana:devnet') {
    throw new Error('Summon on-chain pulls currently require Solana Devnet')
  }

  const authority = new PublicKey(wallet.address)
  const baseProgram = programFor(idl, baseConnection, authority)
  const ephemeralProgram = programFor(idl, ephemeralConnection, authority)
  const programId = baseProgram.programId
  if (programId.toBase58() !== configuredProgramId) {
    throw new Error(`Summon program mismatch: IDL=${programId.toBase58()} config=${configuredProgramId}`)
  }
  const [player] = PublicKey.findProgramAddressSync([PLAYER_SEED, authority.toBytes()], programId)

  return {
    mode: 'onchain',

    async getSnapshot(owner) {
      assertOwner(owner, wallet.address)
      const account = await fetchPlayer(ephemeralProgram, player).catch(() => null)
      const fallback = account ?? (await fetchPlayer(baseProgram, player).catch(() => null))
      if (!fallback) return { owned: [], pulls: [], pending: false }
      return snapshotFromAccount(fallback, await resolutionSignatures(ephemeralConnection, ephemeralProgram, player))
    },

    async pull(owner) {
      assertOwner(owner, wallet.address)
      await ensureDelegated({ baseProgram, ephemeralProgram, baseConnection, wallet, player })

      const before = await fetchPlayer(ephemeralProgram, player)
      if (before.pending) throw new Error('A summon is already waiting for the VRF callback')
      const previousNonce = BigInt(before.requestNonce.toString())
      const clientSeed = await Crypto.getRandomBytesAsync(32)
      const requestInstruction = await method(ephemeralProgram, 'requestPull', [Array.from(clientSeed)])
        .accountsPartial({ payer: authority, player, oracleQueue: EPHEMERAL_VRF_QUEUE })
        .instruction()

      await sendSimulatedTransaction({
        connection: ephemeralConnection,
        wallet,
        instructions: [requestInstruction],
      })

      const resolved = await waitForResolution(ephemeralProgram, player, previousNonce)
      const commitInstruction = await method(ephemeralProgram, 'commitPlayer')
        .accountsPartial({ payer: authority, player, magicProgram: MAGIC_PROGRAM_ID })
        .instruction()
      await sendSimulatedTransaction({
        connection: ephemeralConnection,
        wallet,
        instructions: [commitInstruction],
      })

      const signatures = await resolutionSignatures(ephemeralConnection, ephemeralProgram, player)
      const snapshot = snapshotFromAccount(resolved, signatures)
      const nonce = BigInt(resolved.requestNonce.toString())
      const record = snapshot.pulls.find((pull) => pull.id === `pull-${nonce}`)
      if (!record) throw new Error('VRF callback resolved, but the pull was not found in history')
      return record
    },
  }
}

function programFor(idl: Idl, connection: Connection, authority: PublicKey) {
  return new Program(idl, { connection, publicKey: authority })
}

function method(program: Program, name: string, args: unknown[] = []) {
  const builder = (program.methods as Record<string, (...methodArgs: unknown[]) => any>)[name]
  if (!builder) throw new Error(`Summon IDL is missing instruction ${name}`)
  return builder(...args)
}

async function fetchPlayer(program: Program, player: PublicKey): Promise<PlayerAccount> {
  const client = (program.account as Record<string, { fetch(address: PublicKey): Promise<unknown> }>).playerState
  if (!client) throw new Error('Summon IDL is missing the PlayerState account')
  return (await client.fetch(player)) as PlayerAccount
}

async function ensureDelegated({
  baseProgram,
  ephemeralProgram,
  baseConnection,
  wallet,
  player,
}: {
  baseProgram: Program
  ephemeralProgram: Program
  baseConnection: Connection
  wallet: PrivySolanaWallet
  player: PublicKey
}) {
  const authority = new PublicKey(wallet.address)
  let account = await baseConnection.getAccountInfo(player, 'confirmed')
  if (!account) {
    const initialize = await method(baseProgram, 'initialize')
      .accountsPartial({ authority, player, systemProgram: SystemProgram.programId })
      .instruction()
    await sendSimulatedTransaction({ connection: baseConnection, wallet, instructions: [initialize] })
    account = await baseConnection.getAccountInfo(player, 'confirmed')
  }
  if (!account) throw new Error('Player account was not created')

  if (account.owner.equals(baseProgram.programId)) {
    const delegate = await method(baseProgram, 'delegatePlayer')
      .accountsPartial({ payer: authority, pda: player })
      .remainingAccounts([{ pubkey: ASIA_ER_VALIDATOR, isSigner: false, isWritable: false }])
      .instruction()
    await sendSimulatedTransaction({ connection: baseConnection, wallet, instructions: [delegate] })
  } else if (!account.owner.equals(DELEGATION_PROGRAM_ID)) {
    throw new Error(`Player account has unexpected owner ${account.owner.toBase58()}`)
  }

  await waitFor(
    async () => {
      try {
        await fetchPlayer(ephemeralProgram, player)
        return true
      } catch {
        return false
      }
    },
    ER_PROPAGATION_TIMEOUT_MS,
    'Player delegation did not become visible on the Ephemeral Rollup',
  )
}

async function waitForResolution(program: Program, player: PublicKey, previousNonce: bigint) {
  await waitFor(
    async () => {
      try {
        const account = await fetchPlayer(program, player)
        if (!account.pending && BigInt(account.requestNonce.toString()) > previousNonce) {
          return true
        }
      } catch {
        // The ER can briefly return account-not-found while delegation is propagating.
      }
      return false
    },
    VRF_CALLBACK_TIMEOUT_MS,
    'Timed out waiting for the verified VRF callback',
  )
  return fetchPlayer(program, player)
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, timeoutMessage: string) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(timeoutMessage)
}

function snapshotFromAccount(account: PlayerAccount, signatures: ReadonlyMap<string, string>): SummonSnapshot {
  const history = orderedHistory(account)
  const pulls = history.map((entry): PullRecord => {
    const nonce = entry.nonce.toString()
    const randomness = Uint8Array.from(entry.randomness)
    return {
      id: `pull-${nonce}`,
      collectibleId: collectibleAt(entry.collectibleIndex)?.id ?? `unknown-${entry.collectibleIndex}`,
      createdAt: new Date(Number(entry.resolvedAt.toString()) * 1_000).toISOString(),
      roll: entry.roll,
      seed: abbreviateHex(randomness),
      signature: abbreviateSignature(signatures.get(nonce)),
      status: 'verified',
    }
  })
  const owned = account.inventory.flatMap((quantity, index) => {
    const collectible = collectibleAt(index)
    if (!collectible || quantity === 0) return []
    const oldestKnown = [...history].reverse().find((entry) => entry.collectibleIndex === index)
    return [
      {
        collectibleId: collectible.id,
        quantity,
        firstReceivedAt: oldestKnown
          ? new Date(Number(oldestKnown.resolvedAt.toString()) * 1_000).toISOString()
          : new Date(0).toISOString(),
      },
    ]
  })
  return { owned, pulls, pending: account.pending }
}

function orderedHistory(account: PlayerAccount) {
  const length = Math.min(account.historyLen, HISTORY_CAPACITY, account.history.length)
  const start = length === HISTORY_CAPACITY ? account.historyCursor : 0
  return Array.from({ length }, (_, offset) => account.history[(start + offset) % HISTORY_CAPACITY])
    .filter((entry) => collectibleAt(entry.collectibleIndex))
    .reverse()
}

async function resolutionSignatures(connection: Connection, program: Program, player: PublicKey) {
  const result = new Map<string, string>()
  try {
    const signatures = await connection.getSignaturesForAddress(player, { limit: 64 }, 'confirmed')
    await Promise.all(
      signatures.map(async ({ signature }) => {
        const transaction = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
        if (!transaction?.meta?.logMessages) return
        const parser = new EventParser(program.programId, program.coder)
        for (const event of parser.parseLogs(transaction.meta.logMessages)) {
          if (event.name.toLowerCase() !== 'pullresolved') continue
          const nonce = String((event.data as { nonce: AnchorNumber }).nonce)
          result.set(nonce, signature)
        }
      }),
    )
  } catch {
    // Proof state remains authoritative; signature indexing is best-effort RPC metadata.
  }
  return result
}

function assertOwner(requested: string, connected: string) {
  if (requested !== connected) throw new Error('Connected wallet changed during the summon request')
}

function abbreviateHex(bytes: Uint8Array) {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`
}

function abbreviateSignature(signature?: string) {
  if (!signature) return 'Indexing…'
  return `${signature.slice(0, 6)}…${signature.slice(-6)}`
}

if (collectibles.length !== 10) {
  throw new Error('The on-chain Summon protocol requires exactly ten collectibles')
}
