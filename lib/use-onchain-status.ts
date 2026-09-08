import { useCallback, useEffect, useState } from 'react'
import { readOnchainCache, subscribeOnchainReady } from '@/lib/onchain-cache'

export type OnchainStatus = 'unknown' | 'pending' | 'ready'

/**
 * Lightweight status for the profile indicator.
 * Source of truth is the chain (fetch-first in runOnchainEnsure);
 * this hook reads the local cache on mount, on wallet change, and live
 * whenever the background ensure shouts that the account landed.
 */
export function useOnchainStatus(privyUserId?: string, walletAddress?: string): {
  status: OnchainStatus
  pda?: string
} {
  const [status, setStatus] = useState<OnchainStatus>('unknown')
  const [pda, setPda] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    if (!privyUserId) {
      setStatus('unknown')
      setPda(undefined)
      return
    }
    const cached = await readOnchainCache(privyUserId).catch(() => null)
    if (cached) {
      setPda(cached.pda)
      setStatus('ready')
      return
    }
    setPda(undefined)
    setStatus(walletAddress ? 'pending' : 'unknown')
  }, [privyUserId, walletAddress])

  useEffect(() => {
    void refresh()
    return subscribeOnchainReady(() => {
      void refresh()
    })
  }, [refresh])

  return { status, pda }
}
