import { useEffect, useRef } from 'react'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'

/**
 * After login, create an embedded Solana wallet if the user does not have one yet.
 * Renders nothing — runs as a side effect under PrivyProvider.
 */
export function EnsureSolanaWallet() {
  const { user, isReady } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const creatingRef = useRef(false)
  const status = solana.status
  const create = 'create' in solana ? solana.create : undefined

  useEffect(() => {
    if (!isReady || !user) return
    if (status !== 'not-created' || !create) return
    if (creatingRef.current) return

    creatingRef.current = true
    void create()
      .catch(() => {
        // User can retry next session; avoid crashing the tree.
      })
      .finally(() => {
        creatingRef.current = false
      })
  }, [isReady, user, status, create])

  return null
}
