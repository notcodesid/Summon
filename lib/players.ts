import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * A player is identified by their Privy user id. The embedded Solana wallet
 * address is stored alongside it so we have the user's wallet on record even
 * though nothing is on-chain yet.
 */
export type PlayerIdentity = {
  privyUserId: string
  walletAddress?: string
  email?: string
}

/**
 * Called after login. Creates the player row on first sight and refreshes the
 * wallet address afterwards (it does not exist yet the moment the user signs
 * in — Privy creates it a beat later).
 *
 * Returns false when the write did not happen, so callers can retry.
 */
export async function upsertPlayer(identity: PlayerIdentity): Promise<boolean> {
  if (!isSupabaseConfigured || !identity.privyUserId) return false

  try {
    const { error } = await getSupabase()
      .from('players')
      .upsert(
        {
          privy_user_id: identity.privyUserId,
          wallet_address: identity.walletAddress ?? null,
          email: identity.email ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )

    return !error
  } catch {
    return false
  }
}
