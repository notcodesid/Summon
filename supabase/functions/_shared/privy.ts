import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.9.6'

/**
 * Resolve the caller's Privy user id from an access token.
 *
 * The mobile app sends the Privy access token in Authorization: Bearer <token>
 * (or x-privy-token). We verify the JWT against Privy's JWKS — never trust a
 * client-sent user id.
 */
export async function requirePrivyUserId(req: Request): Promise<string> {
  const appId = Deno.env.get('PRIVY_APP_ID') ?? Deno.env.get('EXPO_PUBLIC_PRIVY_APP_ID')
  if (!appId) {
    throw new AuthError('Server is missing PRIVY_APP_ID')
  }

  const header = req.headers.get('Authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const token = bearer || (req.headers.get('x-privy-token') ?? '').trim()

  if (!token) {
    throw new AuthError('Missing Privy access token')
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`),
    )
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: appId,
    })

    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    if (!sub) {
      throw new AuthError('Invalid Privy token (no subject)')
    }
    return sub
  } catch (err) {
    if (err instanceof AuthError) throw err
    console.error('privy jwt verify failed', err)
    throw new AuthError('Invalid or expired Privy session')
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
