import type { OAuthProviderID } from '@privy-io/expo'

/**
 * Public Privy config for the Expo client.
 * Never put PRIVY_APP_SECRET here.
 */
export const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? ''
export const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? ''

export const isPrivyConfigured = privyAppId.length > 0 && privyClientId.length > 0

/**
 * Escape hatch for automated UI tests that cannot complete a Google sign-in.
 * Off unless EXPO_PUBLIC_AUTH_BYPASS is explicitly 1/true — real Privy auth
 * is the default path, because the Privy user id is the database key and the
 * embedded wallet only exists behind a real login.
 */
export const isAuthBypassed =
  process.env.EXPO_PUBLIC_AUTH_BYPASS === '1' || process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true'

/**
 * Use Privy's built-in Google provider by default. Set this to a
 * dashboard custom OAuth provider id, for example `custom:google`, when
 * you need Google profile fields like the account picture.
 */
export const googleOAuthProvider = (process.env.EXPO_PUBLIC_PRIVY_GOOGLE_PROVIDER_ID ?? 'google') as OAuthProviderID
