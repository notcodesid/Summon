import { Text } from 'react-native'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useAccountGetBalance } from '@/features/account/use-account-get-balance'

export function AccountFeatureGetBalance({ address }: { address: string }) {
  const { data, isLoading, error } = useAccountGetBalance({ address })

  if (error) {
    return <Text>Balance: error</Text>
  }

  return <Text>Balance: {isLoading ? '...' : `${((data ?? 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}</Text>
}
