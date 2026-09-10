import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'

/**
 * Ask the server sponsor wallet for starter SOL.
 *
 * The sponsor private key lives in Edge Function secrets only. The app only
 * sends its wallet address + Privy token. One drip per user, ever — the
 * server enforces idempotency plus a daily cap.
 */
export async function requestSponsorDrip(walletAddress: string): Promise<boolean> {
  if (!isEdgeConfigured() || !walletAddress) return false

  try {
    await callEdgeFunction<{ ok: boolean; already?: boolean; signature?: string }>('drip', {
      walletAddress,
    })
    return true
  } catch {
    return false
  }
}
