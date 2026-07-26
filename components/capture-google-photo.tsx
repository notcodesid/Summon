import { useCallback, useEffect, useRef } from 'react'
import { useOAuthTokens, usePrivy } from '@privy-io/expo'
import { fetchGoogleProfile, upscaleGooglePhoto } from '@/lib/google-profile'
import { savePlayerPhoto } from '@/lib/player-photo'

/**
 * Captures the player's Google profile photo at sign-in.
 *
 * Privy grants the Google OAuth access token exactly once, in this callback,
 * and it cannot be fetched again later — so the photo URL is resolved here
 * and persisted. Renders nothing.
 *
 * The token grant can land before Privy has finished populating the user, so
 * a resolved URL is held until the user id is known.
 */
export function CaptureGooglePhoto() {
  const { user } = usePrivy()
  const privyUserId = user?.id
  const pendingUrlRef = useRef<string | null>(null)

  const flush = useCallback(async () => {
    const url = pendingUrlRef.current
    if (!url || !privyUserId) return
    const saved = await savePlayerPhoto(privyUserId, url, 'google')
    // Clear only on a definite outcome so a transient failure can retry.
    if (saved) pendingUrlRef.current = null
  }, [privyUserId])

  useOAuthTokens({
    onOAuthTokenGrant: (tokens) => {
      if (tokens.provider !== 'google' || !tokens.access_token) return

      void fetchGoogleProfile(tokens.access_token).then((profile) => {
        if (!profile?.picture) return
        pendingUrlRef.current = upscaleGooglePhoto(profile.picture)
        void flush()
      })
    },
  })

  useEffect(() => {
    void flush()
  }, [flush])

  return null
}
