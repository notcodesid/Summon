import { PropsWithChildren } from 'react'
import { PrivyProvider } from '@privy-io/expo'
import { isPrivyConfigured, privyAppId, privyClientId } from '@/lib/privy-config'
import { EnsureSolanaWallet } from '@/components/ensure-solana-wallet'
import { EnsurePlayerRecord } from '@/components/ensure-player-record'
import { CaptureGooglePhoto } from '@/components/capture-google-photo'

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
      <EnsureSolanaWallet />
      <EnsurePlayerRecord />
      <CaptureGooglePhoto />
      {children}
    </PrivyProvider>
  )
}
