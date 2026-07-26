import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * The player's avatar image.
 *
 * Supabase holds the durable copy; AsyncStorage mirrors it so the avatar
 * renders immediately on launch instead of popping in after a round trip.
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

/**
 * Stores a photo against the player.
 *
 * A Google photo never overwrites one the player uploaded themselves —
 * otherwise signing in again would silently undo their choice.
 */
export async function savePlayerPhoto(
  privyUserId: string,
  url: string,
  source: PhotoSource,
): Promise<boolean> {
  if (!isSupabaseConfigured || !privyUserId || !url) return false

  try {
    const supabase = getSupabase()

    if (source === 'google') {
      const { data } = await supabase
        .from('players')
        .select('photo_source')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()

      if (data?.photo_source === 'upload') return false
    }

    const { error } = await supabase
      .from('players')
      .upsert(
        {
          privy_user_id: privyUserId,
          photo_url: url,
          photo_source: source,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )

    if (error) return false
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
  if (!isSupabaseConfigured) return cached

  try {
    const { data, error } = await getSupabase()
      .from('players')
      .select('photo_url')
      .eq('privy_user_id', privyUserId)
      .maybeSingle()

    // Keep the cache when we simply could not reach the row.
    if (error || !data) return cached

    // The row answered and has no photo — that is authoritative, so a photo
    // removed elsewhere actually disappears here too.
    if (!data.photo_url) {
      await clearCache(privyUserId)
      return null
    }

    await writeCache(privyUserId, data.photo_url as string)
    return data.photo_url as string
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
