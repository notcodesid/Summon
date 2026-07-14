import * as Crypto from 'expo-crypto'
import { EventParser, Program, type Idl } from '@anchor-lang/core'
import { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID } from '@magicblock-labs/ephemeral-rollups-sdk'
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js'
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
const BASE_SETTLEMENT_TIMEOUT_MS = 180_000
const SPONSORED_COMMIT_LIMIT = 10n
const PLAYER_ACCOUNT_SIZE = 936
const MINIMUM_DEVNET_BALANCE = 0.05 * LAMPORTS_PER_SOL
const DEVNET_AIRDROP_AMOUNT = 0.1 * LAMPORTS_PER_SOL
const PLAYER_DISCRIMINATOR = [56, 3, 60, 86, 174, 16, 244, 195] as const

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
      const signatures = await resolutionSignatures(ephemeralConnection, ephemeralProgram, player)
      const nonce = BigInt(resolved.requestNonce.toString())
      await settleResolvedPlayer({
        baseConnection,
        ephemeralConnection,
        ephemeralProgram,
        wallet,
        authority,
        player,
        nonce,
      })

      const snapshot = snapshotFromAccount(resolved, signatures)
      const record = snapshot.pulls.find((pull) => pull.id === `pull-${nonce}`)
      if (!record) throw new Error('VRF callback resolved, but the pull was not found in history')
      return record
    },
  }
}

async function settleResolvedPlayer({
  baseConnection,
  ephemeralConnection,
  ephemeralProgram,
  wallet,
  authority,
  player,
  nonce,
}: {
  baseConnection: Connection
  ephemeralConnection: Connection
  ephemeralProgram: Program
  wallet: PrivySolanaWallet
  authority: PublicKey
  player: PublicKey
  nonce: bigint
}) {
  const shouldRotate = nonce % SPONSORED_COMMIT_LIMIT === 0n

  if (shouldRotate) {
    await commitAndUndelegate({ ephemeralConnection, ephemeralProgram, wallet, authority, player })
    await waitForBaseSettlement(baseConnection, ephemeralProgram.programId, player, nonce)
    return
  }

  try {
    const commitInstruction = await buildCommitInstruction(ephemeralProgram, 'commitPlayer', authority, player)
    await sendSimulatedTransaction({
      connection: ephemeralConnection,
      wallet,
      instructions: [commitInstruction],
    })
  } catch (cause) {
    if (!isSponsoredCommitLimitError(cause)) throw cause

    // Existing accounts may already have reached MagicBlock's default sponsored
    // commit cap. Close that ER session so the next pull can delegate a fresh one.
    await commitAndUndelegate({ ephemeralConnection, ephemeralProgram, wallet, authority, player })
    await waitForBaseSettlement(baseConnection, ephemeralProgram.programId, player, nonce)
  }
}

async function commitAndUndelegate({
  ephemeralConnection,
  ephemeralProgram,
  wallet,
  authority,
  player,
}: {
  ephemeralConnection: Connection
  ephemeralProgram: Program
  wallet: PrivySolanaWallet
  authority: PublicKey
  player: PublicKey
}) {
  const instruction = await buildCommitInstruction(ephemeralProgram, 'commitAndUndelegatePlayer', authority, player)
  await sendSimulatedTransaction({ connection: ephemeralConnection, wallet, instructions: [instruction] })
}

async function buildCommitInstruction(
  program: Program,
  instructionName: 'commitPlayer' | 'commitAndUndelegatePlayer',
  authority: PublicKey,
  player: PublicKey,
) {
  return method(program, instructionName)
    .accountsPartial({ payer: authority, player, magicProgram: MAGIC_PROGRAM_ID })
    .instruction()
}

async function waitForBaseSettlement(
  connection: Connection,
  programId: PublicKey,
  player: PublicKey,
  expectedNonce: bigint,
) {
  await waitFor(
    async () => {
      const account = await connection.getAccountInfo(player, 'confirmed')
      if (!account || !account.owner.equals(programId)) return false
      const state = decodePlayerAccount(
        new Uint8Array(account.data.buffer, account.data.byteOffset, account.data.byteLength),
      )
      return BigInt(state.requestNonce.toString()) >= expectedNonce
    },
    BASE_SETTLEMENT_TIMEOUT_MS,
    'Player state did not settle back to Solana after delegation rotation',
  )
}

function isSponsoredCommitLimitError(cause: unknown) {
  const message = cause instanceof Error ? messageWithCause(cause) : String(cause)
  return /sponsored commit limit exceeded|current commit nonce .* reached the limit|0xa0000000|2684354560/i.test(
    message,
  )
}

function messageWithCause(error: Error): string {
  const nested = 'cause' in error && error.cause instanceof Error ? messageWithCause(error.cause) : ''
  return `${error.message} ${nested}`
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
  const info = await program.provider.connection.getAccountInfo(player, 'confirmed')
  if (!info) throw new Error(`Player account ${player.toBase58()} was not found`)
  if (!info.owner.equals(program.programId)) {
    throw new Error(`Player account ${player.toBase58()} has unexpected ER owner ${info.owner.toBase58()}`)
  }

  return decodePlayerAccount(new Uint8Array(info.data.buffer, info.data.byteOffset, info.data.byteLength))
}

function decodePlayerAccount(data: Uint8Array): PlayerAccount {
  if (data.length !== PLAYER_ACCOUNT_SIZE) {
    throw new Error(`Player account has invalid size ${data.length}; expected ${PLAYER_ACCOUNT_SIZE}`)
  }
  for (let index = 0; index < PLAYER_DISCRIMINATOR.length; index += 1) {
    if (data[index] !== PLAYER_DISCRIMINATOR[index]) {
      throw new Error('Player account discriminator does not match PlayerState')
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const inventory = Array.from({ length: 10 }, (_, index) => view.getUint16(40 + index * 2, true))
  const history = Array.from({ length: HISTORY_CAPACITY }, (_, index): PullEntryAccount => {
    const offset = 120 + index * 51
    return {
      nonce: view.getBigUint64(offset, true),
      collectibleIndex: view.getUint8(offset + 8),
      roll: view.getUint16(offset + 9, true),
      resolvedAt: view.getBigInt64(offset + 11, true),
      randomness: Array.from(data.subarray(offset + 19, offset + 51)),
    }
  })

  return {
    authority: new PublicKey(data.subarray(8, 40)),
    inventory,
    totalPulls: view.getBigUint64(60, true),
    requestNonce: view.getBigUint64(68, true),
    pending: view.getUint8(76) !== 0,
    pendingNonce: view.getBigUint64(77, true),
    historyLen: view.getUint8(117),
    historyCursor: view.getUint8(118),
    history,
  }
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
    await ensureFreshWalletFunding(baseConnection, authority)
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
      await fetchPlayer(ephemeralProgram, player)
      return true
    },
    ER_PROPAGATION_TIMEOUT_MS,
    'Player delegation did not become visible on the Ephemeral Rollup',
  )
}

async function ensureFreshWalletFunding(connection: Connection, authority: PublicKey) {
  const balance = await connection.getBalance(authority, 'confirmed')
  if (balance >= MINIMUM_DEVNET_BALANCE) return

  try {
    const signature = await connection.requestAirdrop(authority, DEVNET_AIRDROP_AMOUNT)
    const latestBlockhash = await connection.getLatestBlockhash('confirmed')
    await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new Error(
      `This fresh Devnet wallet needs test SOL before its first summon. The automatic faucet was unavailable: ${detail}`,
    )
  }

  const fundedBalance = await connection.getBalance(authority, 'confirmed')
  if (fundedBalance < MINIMUM_DEVNET_BALANCE) {
    throw new Error('The Devnet faucet responded, but the wallet did not receive enough test SOL. Try again shortly.')
  }
}

async function waitForResolution(program: Program, player: PublicKey, previousNonce: bigint) {
  await waitFor(
    async () => {
      const account = await fetchPlayer(program, player)
      if (!account.pending && BigInt(account.requestNonce.toString()) > previousNonce) {
        return true
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
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch (cause) {
      lastError = cause
      console.warn(`[Summon] ${timeoutMessage}`, cause)
      if (!isTransientErError(cause)) throw cause
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error')
  throw new Error(`${timeoutMessage}: ${detail}`)
}

function isTransientErError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause)
  return /not found|failed to fetch|network request|timeout|timed out|connection|socket/i.test(message)
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
