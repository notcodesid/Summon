/**
 * Google's OpenID userinfo endpoint.
 *
 * Privy hands over the Google OAuth access token exactly once — in the
 * `onOAuthTokenGrant` callback during sign-in — so the photo is fetched at
 * that moment and stored. The token cannot be retrieved later.
 */
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export type GoogleProfile = {
  picture?: string
  name?: string
  email?: string
}

/**
 * Returns null rather than throwing — a missing photo must never block a
 * successful sign-in.
 */
export async function fetchGoogleProfile(
  accessToken: string,
): Promise<GoogleProfile | null> {
  try {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null

    const data = (await response.json()) as Record<string, unknown>
    return {
      picture: typeof data.picture === 'string' ? data.picture : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
      email: typeof data.email === 'string' ? data.email : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Google returns a sized URL ending in `=s96-c`. Ask for a larger one so the
 * avatar stays sharp on high-density screens.
 */
export function upscaleGooglePhoto(url: string, size = 256): string {
  return url.replace(/=s\d+(-c)?$/, `=s${size}-c`)
}
