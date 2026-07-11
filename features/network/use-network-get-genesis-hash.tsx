import { useQuery } from '@tanstack/react-query'
import { useConnection } from './use-connection'
import { useNetwork } from './use-network'

export function useNetworkGetGenesisHash() {
  const connection = useConnection()
  const { selectedNetwork } = useNetwork()
  return useQuery({
    queryKey: ['getGenesisHash', selectedNetwork.id],
    queryFn: () => connection.getGenesisHash(),
  })
}
