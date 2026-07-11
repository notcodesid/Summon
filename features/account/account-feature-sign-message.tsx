import { Button, Text, View } from 'react-native'
import React, { useState } from 'react'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { appStyles } from '@/constants/app-styles'
import { ellipsify } from '@/utils/ellipsify'

export function AccountFeatureSignMessage({ address }: { address: string }) {
  const { wallets } = useEmbeddedSolanaWallet()
  const [status, setStatus] = useState<string | null>(null)

  async function submit() {
    try {
      const wallet = wallets?.[0]
      if (!wallet) {
        setStatus('No Solana wallet')
        return
      }
      const provider = await wallet.getProvider()
      const message = `Signing a message with ${address}`
      const { signature } = await provider.request({
        method: 'signMessage',
        params: { message },
      })
      setStatus(`Signed: ${ellipsify(String(signature), 10)}`)
    } catch (e) {
      setStatus(`Error: ${e}`)
    }
  }

  return (
    <View style={appStyles.stack}>
      <Button onPress={submit} title="Sign message" />
      {status ? <Text>{status}</Text> : null}
    </View>
  )
}
