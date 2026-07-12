import type { User } from '@privy-io/expo'

type Linked = {
  type?: string
  email?: string | null
  address?: string | null
}

/**
 * Best-effort email from Privy linked accounts (Google, Apple, email OTP, etc.).
 * Social login usually provides email; Apple may hide it on subsequent logins.
 */
export function emailFromPrivyUser(user: User | null | undefined): string | null {
  if (!user) return null

  const linked = ((user as { linked_accounts?: Linked[] }).linked_accounts ?? []) as Linked[]
  for (const account of linked) {
    if (
      (account.type === 'email' || account.type === 'google_oauth' || account.type === 'apple_oauth') &&
      account.email
    ) {
      return account.email
    }
  }

  const direct = (user as { email?: { address?: string } | string }).email
  if (typeof direct === 'string' && direct) return direct
  if (direct && typeof direct === 'object' && direct.address) return direct.address

  return null
}

export function authMethodLabel(user: User | null | undefined): string | null {
  if (!user) return null
  const linked = ((user as { linked_accounts?: Linked[] }).linked_accounts ?? []) as Linked[]
  if (linked.some((a) => a.type === 'google_oauth')) return 'Google'
  if (linked.some((a) => a.type === 'apple_oauth')) return 'Apple'
  if (linked.some((a) => a.type === 'email')) return 'Email'
  return null
}
