import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@/features/network/use-connection'
import { useNetwork } from '@/features/network/use-network'

export function useAccountGetBalance({ address }: { address: string }) {
  const connection = useConnection()
  const { selectedNetwork } = useNetwork()
  return useQuery({
    queryKey: ['get-balance', selectedNetwork.id, address],
    queryFn: () => connection.getBalance(new PublicKey(address)),
    enabled: Boolean(address),
  })
}
