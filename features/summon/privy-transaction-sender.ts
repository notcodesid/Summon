import bs58 from 'bs58'
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

export type PrivySolanaWallet = {
  address: string
  getProvider(): Promise<{
    request(input: {
      method: 'signAndSendTransaction'
      params: {
        transaction: VersionedTransaction
        connection: Connection
        options: { minContextSlot: number; commitment: 'confirmed' }
      }
    }): Promise<{ signature: string | Uint8Array }>
  }>
}

/**
 * Simulates first, then hands the exact transaction to Privy for the wallet-owned
 * signature and submission. This module never sees private key material.
 */
export async function sendSimulatedTransaction({
  connection,
  wallet,
  instructions,
}: {
  connection: Connection
  wallet: PrivySolanaWallet
  instructions: TransactionInstruction[]
}) {
  const authority = new PublicKey(wallet.address)
  const {
    context: { slot: minContextSlot },
    value: latestBlockhash,
  } = await connection.getLatestBlockhashAndContext('confirmed')
  const message = new TransactionMessage({
    payerKey: authority,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage()
  const transaction = new VersionedTransaction(message)

  const simulation = await connection.simulateTransaction(transaction, {
    commitment: 'processed',
    sigVerify: false,
  })
  if (simulation.value.err) {
    const logs = simulation.value.logs?.join('\n') ?? 'No simulation logs returned'
    throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}\n${logs}`)
  }

  const provider = await wallet.getProvider()
  const { signature } = await provider.request({
    method: 'signAndSendTransaction',
    params: {
      transaction,
      connection,
      options: { minContextSlot, commitment: 'confirmed' },
    },
  })
  const encoded = typeof signature === 'string' ? signature : bs58.encode(signature)

  await connection.confirmTransaction(
    {
      signature: encoded,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed',
  )
  return encoded
}
