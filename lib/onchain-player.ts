import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from '@solana/web3.js'
import { solanaRpcUrl, summonProgramId, isDevnetRpc } from '@/lib/solana-config'

/**
 * On-chain player (game file) helpers.
 *
 * The Privy embedded wallet gives the user an address (the pocket).
 * The Summon program owns a separate PDA account per wallet
 * (the game file: wins / losses / XP). Create that PDA on the first
 * Keep, not at login — scan never needs it.
 *
 * Uses raw web3.js instead of @coral-xyz/anchor in the mobile bundle:
 * one instruction, fetch-first idempotency, signed via Privy's provider.
 */

const PLAYER_SEED = 'player'

/** First 8 bytes of sha256("global:initialize_player"). Verified against program. */
const INITIALIZE_PLAYER_DISCRIMINATOR = Buffer.from([79, 249, 88, 177, 220, 62, 56, 128])

export type EnsureOnchainResult = {
  pda: string
  /** Null when the account already existed or creation was skipped — no transaction sent. */
  signature: string | null
  created: boolean
  /** False when skipped because the wallet has no SOL for rent. Retried later. */
  funded?: boolean
}

/** PlayerProfile: 8 discriminator + 32 authority + 4 wins + 4 losses + 4 xp + 1 bump. */
const PLAYER_PROFILE_SPACE = 53
/** Devnet fallback top-up when the sponsor drip is unreachable. */
const DEVNET_AIRDROP_LAMPORTS = 100_000_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Public RPCs (devnet especially) answer 429 when crowded. Retry a few
 * times with growing waits instead of failing on the first busy signal.
 */
async function withRpcRetry<T>(label: string, work: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      await sleep(1000 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`RPC busy (${label})`)
}

/**
 * Top up a fresh wallet. Returns true when money may have arrived.
 * Default: devnet airdrop only (tests / pre-deploy). The app passes a
 * sponsor-drip-first version. No confirm polling — the caller rechecks
 * balance after a short wait instead (confirm loops poll the RPC dozens
 * of times on a congested network).
 */
async function defaultFundWallet(connection: Connection, wallet: PublicKey): Promise<boolean> {
  if (!isDevnetRpc(connection.rpcEndpoint)) return false
  try {
    await connection.requestAirdrop(wallet, DEVNET_AIRDROP_LAMPORTS)
    return true
  } catch {
    return false
  }
}

type SignAndSendProvider = {
  request: (args: {
    method: 'signAndSendTransaction'
    params: { transaction: Transaction; connection: Connection; options?: { commitment?: Commitment } }
  }) => Promise<{ signature: string }>
}

export function playerPdaFor(walletAddress: string): PublicKey {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(walletAddress)
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), wallet.toBuffer()],
    program,
  )
  return pda
}

export async function hasOnchainPlayer(
  connection: Connection,
  walletAddress: string,
): Promise<{ exists: boolean; pda: string }> {
  const pda = playerPdaFor(walletAddress)
  const info = await withRpcRetry('getAccountInfo', () => connection.getAccountInfo(pda))
  return { exists: info !== null, pda: pda.toBase58() }
}

export async function buildInitializePlayerTransaction(
  connection: Connection,
  walletAddress: string,
): Promise<{ transaction: Transaction; pda: string }> {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(walletAddress)
  const pda = playerPdaFor(walletAddress)

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INITIALIZE_PLAYER_DISCRIMINATOR,
  })

  const { blockhash } = await withRpcRetry('getLatestBlockhash', () =>
    connection.getLatestBlockhash('confirmed'),
  )
  const transaction = new Transaction({
    feePayer: wallet,
    recentBlockhash: blockhash,
  }).add(instruction)

  return { transaction, pda: pda.toBase58() }
}

/**
 * Fetch-first ensure: returns exists without sending a transaction when the
 * PDA is already initialized. Otherwise signs + sends initialize_player
 * through the Privy embedded wallet provider.
 *
 * A fresh wallet has 0 SOL, so the transaction would fail simulation
 * ("debit an account but found no record of a prior credit"). To avoid a
 * red error box on first login: check balance first, top up on devnet,
 * and skip silently when there is no SOL (retried next session).
 */
export async function ensureOnchainPlayer(args: {
  walletAddress: string
  getProvider: () => Promise<SignAndSendProvider>
  connection?: Connection
  fundWallet?: (connection: Connection, wallet: PublicKey) => Promise<boolean>
}): Promise<EnsureOnchainResult> {
  const connection = args.connection ?? new Connection(solanaRpcUrl, 'confirmed')

  const existing = await hasOnchainPlayer(connection, args.walletAddress)
  if (existing.exists) {
    return { pda: existing.pda, signature: null, created: false, funded: true }
  }

  const wallet = new PublicKey(args.walletAddress)
  const rent = await withRpcRetry('getMinimumBalanceForRentExemption', () =>
    connection.getMinimumBalanceForRentExemption(PLAYER_PROFILE_SPACE),
  ).catch(() => 0)
  let balance = await withRpcRetry('getBalance', () => connection.getBalance(wallet)).catch(() => 0)

  if (balance < rent) {
    const fund = args.fundWallet ?? defaultFundWallet
    const maybeFunded = await fund(connection, wallet).catch(() => false)
    if (maybeFunded) {
      await sleep(2000)
      balance = await withRpcRetry('getBalance', () => connection.getBalance(wallet)).catch(() => 0)
    } else if (!isDevnetRpc(connection.rpcEndpoint)) {
      return { pda: existing.pda, signature: null, created: false, funded: false }
    }
  }

  if (balance < rent) {
    return { pda: existing.pda, signature: null, created: false, funded: false }
  }

  const { transaction, pda } = await buildInitializePlayerTransaction(connection, args.walletAddress)
  const provider = await args.getProvider()
  const { signature } = await provider.request({
    method: 'signAndSendTransaction',
    params: { transaction, connection, options: { commitment: 'confirmed' } },
  })

  return { pda, signature, created: true, funded: true }
}
