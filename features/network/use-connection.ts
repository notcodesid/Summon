import { useMemo } from 'react'
import { Connection } from '@solana/web3.js'
import { useNetwork } from './use-network'

/** RPC connection for the currently selected cluster. */
export function useConnection() {
  const { selectedNetwork } = useNetwork()
  return useMemo(() => new Connection(selectedNetwork.url, 'confirmed'), [selectedNetwork.url])
}
