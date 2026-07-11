import { useQuery } from '@tanstack/react-query'
import { useConnection } from './use-connection'
import { useNetwork } from './use-network'

export function useNetworkGetVersion() {
  const connection = useConnection()
  const { selectedNetwork } = useNetwork()
  return useQuery({
    queryKey: ['getVersion', selectedNetwork.id],
    queryFn: () =>
      connection.getVersion().then((version) => ({
        core: version['solana-core'],
        features: version['feature-set'],
      })),
  })
}
