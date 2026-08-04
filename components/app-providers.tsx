import { PropsWithChildren, useEffect } from 'react'
import { PrivyProvider, usePrivy } from '@privy-io/expo'
import { isPrivyConfigured, privyAppId, privyClientId } from '@/lib/privy-config'
import { EnsureSolanaWallet } from '@/components/ensure-solana-wallet'
import { EnsurePlayerRecord } from '@/components/ensure-player-record'
import { CaptureGooglePhoto } from '@/components/capture-google-photo'
import { setAccessTokenGetter } from '@/lib/session-token'

/** Binds Privy getAccessToken for Edge Function calls outside React. */
function BindPrivyAccessToken() {
  const { getAccessToken } = usePrivy()

  useEffect(() => {
    setAccessTokenGetter(async () => {
      try {
        return (await getAccessToken()) ?? null
      } catch {
        return null
      }
    })
  }, [getAccessToken])

  return null
}

/**
 * Root providers. Privy owns Google/Apple auth + embedded Solana wallets.
 */
export function AppProviders({ children }: PropsWithChildren) {
  if (!isPrivyConfigured) {
    // Allow the shell to render so misconfig is obvious on the login screen.
    return children
  }

  return (
    <PrivyProvider appId={privyAppId} clientId={privyClientId}>
      <BindPrivyAccessToken />
      <EnsureSolanaWallet />
      <EnsurePlayerRecord />
      <CaptureGooglePhoto />
      {children}
    </PrivyProvider>
  )
}
