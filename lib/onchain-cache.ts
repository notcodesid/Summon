import AsyncStorage from '@react-native-async-storage/async-storage'

export const onchainCacheKeyFor = (privyUserId: string) => `summon.onchain.v1.${privyUserId}`

export type OnchainCache = {
  pda: string
  signature: string | null
  updatedAt: number
}

export async function readOnchainCache(privyUserId: string): Promise<OnchainCache | null> {
  try {
    const raw = await AsyncStorage.getItem(onchainCacheKeyFor(privyUserId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnchainCache
    return parsed?.pda ? parsed : null
  } catch {
    return null
  }
}

export async function writeOnchainCache(privyUserId: string, cache: OnchainCache): Promise<void> {
  try {
    await AsyncStorage.setItem(onchainCacheKeyFor(privyUserId), JSON.stringify(cache))
  } catch {
    // Cache is best-effort; chain fetch-first keeps us correct.
  }
}

type ReadyListener = () => void

const readyListeners = new Set<ReadyListener>()

/** First-battle ensure shouts when the PlayerProfile PDA lands. */
export function subscribeOnchainReady(listener: ReadyListener): () => void {
  readyListeners.add(listener)
  return () => {
    readyListeners.delete(listener)
  }
}

export function notifyOnchainReady(): void {
  for (const listener of readyListeners) {
    try {
      listener()
    } catch {
      // One bad listener must not break the others.
    }
  }
}
