import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'

/**
 * A player is identified by their Privy user id. The embedded Solana wallet
 * address is stored alongside it so we have the user's wallet on record even
 * though nothing is on-chain yet.
 *
 * Writes go through the creatures Edge Function (upsert_player) so RLS-locked
 * tables are only touched with a verified Privy session + service role.
 */
export type PlayerIdentity = {
  privyUserId: string
  walletAddress?: string
  email?: string
}

/**
 * Called after login. Creates the player row on first sight and refreshes the
 * wallet address afterwards.
 */
export async function upsertPlayer(identity: PlayerIdentity): Promise<boolean> {
  if (!isEdgeConfigured() || !identity.privyUserId) return false

  try {
    await callEdgeFunction('creatures', {
      action: 'upsert_player',
      walletAddress: identity.walletAddress,
      email: identity.email,
    })
    return true
  } catch {
    return false
  }
}
