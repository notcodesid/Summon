import { useEffect, useRef } from 'react'
import { upsertPlayer } from '@/lib/players'
import { usePlayer } from '@/lib/use-player'

/**
 * Records the signed-in player in Supabase, and records their wallet address
 * once Privy has created it. Renders nothing.
 */
export function EnsurePlayerRecord() {
  const { isReady, privyUserId, walletAddress, email } = usePlayer()
  const lastWrittenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isReady || !privyUserId) return

    // Re-write once the wallet address arrives, but not on every render.
    const signature = `${privyUserId}:${walletAddress ?? ''}`
    if (lastWrittenRef.current === signature) return
    lastWrittenRef.current = signature

    void upsertPlayer({ privyUserId, walletAddress, email }).then((ok) => {
      if (!ok) lastWrittenRef.current = null
    })
  }, [isReady, privyUserId, walletAddress, email])

  return null
}
