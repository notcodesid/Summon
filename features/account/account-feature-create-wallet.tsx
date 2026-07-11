import { Button, Text, View } from 'react-native'
import React, { useState } from 'react'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { appStyles } from '@/constants/app-styles'

/**
 * Manual Solana wallet creation — use when createOnLogin is off,
 * or if auto-create did not run.
 * @see https://docs.privy.io/wallets/wallets/create/create-a-wallet
 */
export function AccountFeatureCreateWallet() {
  const solana = useEmbeddedSolanaWallet()
  const [status, setStatus] = useState<string | null>(null)
  const hasWallet = (solana.wallets?.length ?? 0) > 0

  async function onCreate() {
    try {
      if (!solana.create) {
        setStatus('Wallet create is unavailable in the current state')
        return
      }
      setStatus('Creating Solana wallet…')
      await solana.create()
      setStatus('Wallet created')
    } catch (e) {
      setStatus(`Create failed: ${e}`)
    }
  }

  return (
    <View style={appStyles.stack}>
      <Button disabled={hasWallet || !solana.create} title="Create Solana wallet" onPress={onCreate} />
      {status ? <Text>{status}</Text> : null}
    </View>
  )
}
