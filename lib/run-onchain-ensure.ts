import { Connection } from '@solana/web3.js'
import { readOnchainCache, writeOnchainCache, notifyOnchainReady } from '@/lib/onchain-cache'
import { ensureOnchainPlayer } from '@/lib/onchain-player'
import { solanaRpcUrl, isDevnetRpc } from '@/lib/solana-config'
import { requestSponsorDrip } from '@/lib/sponsor'

/** One attempt per wallet per session — Profile focus fires often. */
const attempted = new Set<string>()

/**
 * Create the on-chain PlayerProfile PDA if it is missing.
 *
 * Call this from the first Keep, not from login or Profile. Scan does not
 * need the player PDA; collecting the animal on-chain does.
 * Fetch-first: no transaction when the account already exists.
 */
export async function runOnchainEnsure(args: {
  privyUserId: string
  walletAddress: string
  getProvider: () => Promise<never>
}): Promise<void> {
  const key = `${args.privyUserId}:${args.walletAddress}`
  if (attempted.has(key)) return
  attempted.add(key)

  try {
    if (await readOnchainCache(args.privyUserId)) {
      notifyOnchainReady()
      return
    }

    const connection = new Connection(solanaRpcUrl, 'confirmed')
    const result = await ensureOnchainPlayer({
      walletAddress: args.walletAddress,
      getProvider: args.getProvider as unknown as () => Promise<never>,
      connection,
      // Sponsor first (same path on test + mainnet), devnet airdrop fallback.
      // No confirm polling — balance recheck below verifies arrival.
      fundWallet: async (conn, dest) => {
        if (await requestSponsorDrip(dest.toBase58())) return true
        if (!isDevnetRpc(conn.rpcEndpoint)) return false
        try {
          await conn.requestAirdrop(dest, 100_000_000)
          return true
        } catch {
          return false
        }
      },
    })

    // Unfunded wallets retry next session — don't cache, don't show errors.
    if (!result.created && result.funded === false) {
      attempted.delete(key)
      return
    }

    await writeOnchainCache(args.privyUserId, {
      pda: result.pda,
      signature: result.signature,
      updatedAt: Date.now(),
    })
    notifyOnchainReady()
  } catch {
    // Background only: retry next session, never crash the tree.
    attempted.delete(key)
  }
}
