import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'

/**
 * The signed-in player: their Privy user id (used as the database key) and
 * their embedded Solana wallet address.
 *
 * `walletAddress` is undefined for a moment after sign-in — Privy creates the
 * wallet just after the user record exists.
 */
export type Player = {
  isReady: boolean
  privyUserId?: string
  walletAddress?: string
  email?: string
  /** Display name from the Google account, when Privy has one. */
  name?: string
}

type LinkedAccount = { email?: unknown; name?: unknown }

function accountsOf(user: unknown): LinkedAccount[] | undefined {
  return (user as { linked_accounts?: LinkedAccount[] } | null)?.linked_accounts
}

function emailOf(user: unknown): string | undefined {
  const hit = accountsOf(user)?.find(
    (account) => typeof account?.email === 'string',
  )
  return hit?.email as string | undefined
}

function nameOf(user: unknown): string | undefined {
  const hit = accountsOf(user)?.find(
    (account) => typeof account?.name === 'string' && account.name !== '',
  )
  return hit?.name as string | undefined
}

/**
 * Privy's Google accounts carry no profile picture, so the avatar is built
 * from initials. Falls back to the first letter of the email.
 */
export function initialsFor(player: Pick<Player, 'name' | 'email'>): string {
  const source = player.name?.trim() || player.email?.trim() || ''
  if (!source) return '?'

  const parts = source.split(/[\s.@_-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function usePlayer(): Player {
  const { user, isReady } = usePrivy()
  const solana = useEmbeddedSolanaWallet()

  const walletAddress =
    'wallets' in solana && solana.wallets?.length
      ? solana.wallets[0]?.address
      : undefined

  return {
    isReady,
    privyUserId: user?.id,
    walletAddress,
    email: emailOf(user),
    name: nameOf(user),
  }
}
