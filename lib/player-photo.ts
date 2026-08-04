import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'

/**
 * The player's avatar image.
 *
 * Server holds the durable copy (via Edge + RLS); AsyncStorage mirrors it so
 * the avatar renders immediately on launch.
 */
export type PhotoSource = 'google' | 'upload'

const cacheKey = (privyUserId: string) => `summon.photo.v1.${privyUserId}`

async function readCache(privyUserId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(cacheKey(privyUserId))
  } catch {
    return null
  }
}

async function writeCache(privyUserId: string, url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(privyUserId), url)
  } catch {
    // A failed mirror is not worth surfacing.
  }
}

async function clearCache(privyUserId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(privyUserId))
  } catch {
    // Ignored for the same reason.
  }
}

export async function savePlayerPhoto(
  privyUserId: string,
  url: string,
  source: PhotoSource,
): Promise<boolean> {
  if (!isEdgeConfigured() || !privyUserId || !url) return false

  try {
    const result = await callEdgeFunction<{ ok?: boolean; skipped?: boolean }>(
      'creatures',
      {
        action: 'save_player_photo',
        photoUrl: url,
        photoSource: source,
      },
    )
    if (result.skipped) return false
    await writeCache(privyUserId, url)
    return true
  } catch {
    return false
  }
}

export async function loadPlayerPhoto(
  privyUserId: string,
): Promise<string | null> {
  const cached = await readCache(privyUserId)
  if (!isEdgeConfigured()) return cached

  try {
    const { player } = await callEdgeFunction<{
      player: { photo_url?: string | null } | null
    }>('creatures', { action: 'get_player' })

    if (!player) return cached

    if (!player.photo_url) {
      await clearCache(privyUserId)
      return null
    }

    await writeCache(privyUserId, player.photo_url)
    return player.photo_url
  } catch {
    return cached
  }
}

/** Avatar image for the signed-in player, or null while unknown. */
export function usePlayerPhoto(privyUserId?: string) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!privyUserId) {
      setPhotoUrl(null)
      return
    }
    const url = await loadPlayerPhoto(privyUserId)
    setPhotoUrl(url)
  }, [privyUserId])

  useEffect(() => {
    let active = true
    if (!privyUserId) {
      setPhotoUrl(null)
      return
    }
    void loadPlayerPhoto(privyUserId).then((url) => {
      if (active) setPhotoUrl(url)
    })
    return () => {
      active = false
    }
  }, [privyUserId])

  return { photoUrl, refresh }
}
