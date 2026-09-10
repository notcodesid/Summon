import { useCallback, useEffect, useState } from 'react'
import { readOnchainCache, subscribeOnchainReady } from '@/lib/onchain-cache'

export type OnchainStatus = 'unknown' | 'pending' | 'ready'

/**
 * Local cache of whether this player's battle PDA exists.
 * Login and Profile do not create that account; first battle does,
 * via runOnchainEnsure.
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
