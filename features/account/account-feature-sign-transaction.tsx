import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { Button, Text, View } from 'react-native'
import React, { useState } from 'react'
import { createMemoInstruction } from '@solana/spl-memo'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { appStyles } from '@/constants/app-styles'
import { useConnection } from '@/features/network/use-connection'
import { ellipsify } from '@/utils/ellipsify'

export function AccountFeatureSignTransaction({ address }: { address: string }) {
  const { wallets } = useEmbeddedSolanaWallet()
  const connection = useConnection()
  const [status, setStatus] = useState<string | null>(null)

  async function submit() {
    try {
      const wallet = wallets?.[0]
      if (!wallet) {
        setStatus('No Solana wallet')
        return
      }

      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } = await connection.getLatestBlockhashAndContext()

      const message = new TransactionMessage({
        payerKey: new PublicKey(address),
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [createMemoInstruction('Hello from Privy Solana wallet')],
      }).compileToLegacyMessage()

      const transaction = new VersionedTransaction(message)
      const provider = await wallet.getProvider()

      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: {
          transaction,
          connection,
          options: { minContextSlot },
        },
      })

      setStatus(`Tx: ${ellipsify(String(signature), 10)}`)
    } catch (e) {
      setStatus(`Error: ${e}`)
    }
  }

  return (
    <View style={appStyles.stack}>
      <Button onPress={submit} title="Sign transaction (memo)" />
      {status ? <Text>{status}</Text> : null}
    </View>
  )
}
