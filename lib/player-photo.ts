import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'
import {
  normalizePhotoMediaReference,
  refreshRemotePhotoUri,
  resolvePhotoMediaUri,
  type PhotoMediaReference,
} from '@/lib/media-reference'
import { deletePersistedPlayerPhoto, persistPlayerPhoto } from '@/lib/persist-photo'

/**
 * The player's avatar image.
 *
 * Server holds the durable copy (via Edge + RLS); AsyncStorage mirrors it so
 * the avatar renders immediately on launch.
 */
export type PlayerPhotoInput =
  | { source: 'google'; sourceUrl: string }
  | {
      source: 'upload'
      imageBase64: string
      localPhotoUri: string
    }

const cacheKey = (privyUserId: string) => `summon.photo.v1.${privyUserId}`

async function readCache(privyUserId: string): Promise<PhotoMediaReference | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(privyUserId))
    if (!raw) return null
    try {
      return normalizePhotoMediaReference(JSON.parse(raw))
    } catch {
      // Migrate the v1 cache, which stored one URL string directly.
      return normalizePhotoMediaReference(raw)
    }
  } catch {
    return null
  }
}

async function writeCache(privyUserId: string, media: PhotoMediaReference): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(privyUserId), JSON.stringify(normalizePhotoMediaReference(media)))
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

export async function savePlayerPhoto(privyUserId: string, input: PlayerPhotoInput): Promise<boolean> {
  if (!isEdgeConfigured() || !privyUserId) return false

  try {
    const cached = await readCache(privyUserId)
    const result = await callEdgeFunction<{
      ok?: boolean
      skipped?: boolean
      photoUrl?: string | null
    }>('creatures', {
      action: 'save_player_photo',
      photoSource: input.source,
      sourceUrl: input.source === 'google' ? input.sourceUrl : undefined,
      imageBase64: input.source === 'upload' ? input.imageBase64 : undefined,
    })

    if (result.photoUrl) {
      const persistedLocalPhotoUri =
        result.skipped && cached?.localPhotoUri
          ? cached.localPhotoUri
          : await persistPlayerPhoto(
              privyUserId,
              input.source === 'upload' ? input.localPhotoUri : result.photoUrl,
              input.source === 'upload' ? input.imageBase64 : undefined,
            )

      if (!persistedLocalPhotoUri && !result.skipped) {
        await deletePersistedPlayerPhoto(privyUserId)
      }

      await writeCache(
        privyUserId,
        normalizePhotoMediaReference({
          localPhotoUri: persistedLocalPhotoUri ?? undefined,
          remotePhotoUri: result.photoUrl,
        }),
      )
    }
    return result.ok === true || result.skipped === true
  } catch {
    return false
  }
}

export async function loadPlayerPhoto(privyUserId: string): Promise<string | null> {
  const cached = await readCache(privyUserId)
  if (!isEdgeConfigured()) {
    return cached ? resolvePhotoMediaUri(cached) || null : null
  }

  try {
    const { player } = await callEdgeFunction<{
      player: { photo_url?: string | null } | null
    }>('creatures', { action: 'get_player' })

    if (!player) {
      return cached ? resolvePhotoMediaUri(cached) || null : null
    }

    if (!player.photo_url) {
      await clearPlayerPhotoCache(privyUserId)
      return null
    }

    const localPhotoUri = cached?.localPhotoUri ?? (await persistPlayerPhoto(privyUserId, player.photo_url))
    const refreshed = refreshRemotePhotoUri(
      {
        localPhotoUri,
        remotePhotoUri: cached?.remotePhotoUri,
      },
      player.photo_url,
    )
    await writeCache(privyUserId, refreshed)
    return resolvePhotoMediaUri(refreshed) || null
  } catch {
    return cached ? resolvePhotoMediaUri(cached) || null : null
  }
}

export async function clearPlayerPhotoCache(privyUserId?: string): Promise<void> {
  if (!privyUserId) return
  await Promise.all([clearCache(privyUserId), deletePersistedPlayerPhoto(privyUserId)])
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
