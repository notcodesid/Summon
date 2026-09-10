import { Buffer } from 'buffer'
import { Connection, PublicKey } from '@solana/web3.js'
import { digest, CryptoDigestAlgorithm } from 'expo-crypto'
import type { Creature } from '@/lib/creatures'
import { CATCH_ID_LENGTH } from '@/lib/catch-id'
import {
  collectCreatureOnchain,
  CREATURE_ACCOUNT_SPACE,
  hasOnchainCreature,
} from '@/lib/onchain-creature'
import { ensureOnchainPlayer, type SignAndSendProvider } from '@/lib/onchain-player'
import { isDevnetRpc, solanaRpcUrl } from '@/lib/solana-config'
import { requestSponsorDrip } from '@/lib/sponsor'

function stripBase64Prefix(data: string): string {
  const marker = 'base64,'
  const index = data.indexOf(marker)
  return index >= 0 ? data.slice(index + marker.length) : data
}

export async function photoHashFromBase64(imageBase64: string): Promise<Uint8Array> {
  const pure = stripBase64Prefix(imageBase64)
  const bytes = Buffer.from(pure, 'base64')
  if (bytes.length === 0) {
    throw new Error('Photo is empty.')
  }
  const digestBuffer = await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes))
  return new Uint8Array(digestBuffer)
}

export type KeepOnchainResult =
  | { ok: true; pda: string }
  | { ok: false; message: string }

/**
 * First Keep for a wallet: drip if needed, open the player game-file,
 * then write this catch to a creature PDA. Fetch-first on retries.
 */
export async function keepCreatureOnchain(args: {
  walletAddress: string
  creature: Creature
  imageBase64: string
  getProvider: () => Promise<SignAndSendProvider>
}): Promise<KeepOnchainResult> {
  if (args.creature.id.length !== CATCH_ID_LENGTH * 2) {
    return { ok: false, message: 'Could not record this catch on-chain. Please try again.' }
  }

  const connection = new Connection(solanaRpcUrl, 'confirmed')

  const fundWallet = async (conn: Connection, dest: PublicKey) => {
    if (await requestSponsorDrip(dest.toBase58())) return true
    if (!isDevnetRpc(conn.rpcEndpoint)) return false
    try {
      await conn.requestAirdrop(dest, 100_000_000)
      return true
    } catch {
      return false
    }
  }

  try {
    const player = await ensureOnchainPlayer({
      walletAddress: args.walletAddress,
      getProvider: args.getProvider,
      connection,
      fundWallet,
    })

    if (player.funded === false) {
      return {
        ok: false,
        message: 'Need a little SOL to record this catch. Please try again in a moment.',
      }
    }

    const existing = await hasOnchainCreature(connection, args.walletAddress, args.creature.id)
    if (existing.exists) {
      return { ok: true, pda: existing.pda }
    }

    const wallet = new PublicKey(args.walletAddress)
    const rent = await connection
      .getMinimumBalanceForRentExemption(CREATURE_ACCOUNT_SPACE)
      .catch(() => 0)
    let balance = await connection.getBalance(wallet).catch(() => 0)
    if (balance < rent) {
      const maybeFunded = await fundWallet(connection, wallet)
      if (maybeFunded) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        balance = await connection.getBalance(wallet).catch(() => 0)
      }
    }
    if (balance < rent) {
      return {
        ok: false,
        message: 'Need a little SOL to record this catch. Please try again in a moment.',
      }
    }

    const photoHash = await photoHashFromBase64(args.imageBase64)
    const collected = await collectCreatureOnchain({
      walletAddress: args.walletAddress,
      creature: args.creature,
      photoHash,
      getProvider: args.getProvider,
      connection,
    })
    return { ok: true, pda: collected.pda }
  } catch (error) {
    const raw = error instanceof Error ? error.message : ''
    if (/insufficient|no record of a prior credit/i.test(raw)) {
      return {
        ok: false,
        message: 'Need a little SOL to record this catch. Please try again in a moment.',
      }
    }
    return { ok: false, message: 'Could not record this catch on-chain. Please try again.' }
  }
}
