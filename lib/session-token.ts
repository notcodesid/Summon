/**
 * Holds a getter for the current Privy access token so non-React modules
 * (collection, identify) can call authenticated Edge Functions.
 *
 * Wired once from AppProviders via setAccessTokenGetter.
 */
type TokenGetter = () => Promise<string | null | undefined>

let tokenGetter: TokenGetter | null = null

export function setAccessTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter
}

export async function getSessionAccessToken(): Promise<string | null> {
  if (!tokenGetter) return null
  try {
    const token = await tokenGetter()
    return token ?? null
  } catch {
    return null
  }
}
