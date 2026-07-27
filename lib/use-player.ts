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
  /** Google profile photo, when Privy exposes one on the user payload. */
  googlePhotoUrl?: string
}

type LinkedAccount = {
  email?: unknown
  name?: unknown
  profile_picture_url?: unknown
  profilePictureUrl?: unknown
  photo_url?: unknown
}

function accountsOf(user: unknown): LinkedAccount[] | undefined {
  return (user as { linked_accounts?: LinkedAccount[] } | null)?.linked_accounts
}

function emailOf(user: unknown): string | undefined {
  const hit = accountsOf(user)?.find((account) => typeof account?.email === 'string')
  return hit?.email as string | undefined
}

function nameOf(user: unknown): string | undefined {
  const hit = accountsOf(user)?.find((account) => typeof account?.name === 'string' && account.name !== '')
  return hit?.name as string | undefined
}

function firstString(...values: unknown[]): string | undefined {
  const hit = values.find((value) => typeof value === 'string' && value.length > 0)
  return hit as string | undefined
}

function googlePhotoOf(user: unknown): string | undefined {
  const root = user as {
    profile_picture_url?: unknown
    profilePictureUrl?: unknown
    photo_url?: unknown
  } | null
  const account = accountsOf(user)?.find((next) =>
    firstString(next.profile_picture_url, next.profilePictureUrl, next.photo_url),
  )

  return firstString(
    root?.profile_picture_url,
    root?.profilePictureUrl,
    root?.photo_url,
    account?.profile_picture_url,
    account?.profilePictureUrl,
    account?.photo_url,
  )
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

  const walletAddress = 'wallets' in solana && solana.wallets?.length ? solana.wallets[0]?.address : undefined

  return {
    isReady,
    privyUserId: user?.id,
    walletAddress,
    email: emailOf(user),
    name: nameOf(user),
    googlePhotoUrl: googlePhotoOf(user),
  }
}
