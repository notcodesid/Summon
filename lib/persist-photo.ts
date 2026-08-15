import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  downloadAsync,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy'

/**
 * Local durable copy for offline / instant UI.
 * Permanent cloud URLs come from the creatures Edge Function (Supabase Storage).
 */
const CAPTURES_DIR = `${documentDirectory ?? ''}captures/`
const PROFILE_PHOTOS_DIR = `${documentDirectory ?? ''}profile-photos/`
const CUTOUTS_DIR = `${documentDirectory ?? ''}cutouts/`

async function ensureDirectory(directory: string): Promise<boolean> {
  if (!documentDirectory) return false
  const info = await getInfoAsync(directory)
  if (!info.exists) {
    await makeDirectoryAsync(directory, { intermediates: true })
  }
  return true
}

/**
 * Persist a JPEG locally so the collection can render before / without Storage.
 * Prefer Documents file; fall back to data URI.
 */
export async function persistCapturePhoto(id: string, base64: string, sourceUri: string): Promise<string> {
  const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : ''

  try {
    const ok = await ensureDirectory(CAPTURES_DIR)
    if (ok) {
      const dest = `${CAPTURES_DIR}${id}.jpg`

      if (sourceUri && !sourceUri.startsWith('data:')) {
        try {
          await copyAsync({ from: sourceUri, to: dest })
          return dest
        } catch {
          // Fall through to base64 write.
        }
      }

      if (base64) {
        await writeAsStringAsync(dest, base64, { encoding: EncodingType.Base64 })
        return dest
      }
    }
  } catch {
    // Fall through to data URI.
  }

  if (dataUri) return dataUri
  return sourceUri
}

function playerPhotoPath(privyUserId: string): string {
  return `${PROFILE_PHOTOS_DIR}${encodeURIComponent(privyUserId)}.image`
}

/**
 * Persists an avatar independently of its expiring signed URL. Uploads can be
 * copied/written immediately; remote-only avatars are downloaded after the
 * server returns a fresh signed URL.
 */
export async function persistPlayerPhoto(
  privyUserId: string,
  sourceUri?: string,
  base64?: string,
): Promise<string | null> {
  try {
    if (!(await ensureDirectory(PROFILE_PHOTOS_DIR))) return null
    const destination = playerPhotoPath(privyUserId)
    const nextDestination = `${destination}.next`
    await deleteAsync(nextDestination, { idempotent: true })

    if (base64) {
      await writeAsStringAsync(nextDestination, base64, {
        encoding: EncodingType.Base64,
      })
    } else if (sourceUri?.startsWith('data:')) {
      const marker = 'base64,'
      const markerIndex = sourceUri.indexOf(marker)
      if (markerIndex >= 0) {
        await writeAsStringAsync(nextDestination, sourceUri.slice(markerIndex + marker.length), {
          encoding: EncodingType.Base64,
        })
      } else {
        return null
      }
    } else if (sourceUri?.startsWith('file:')) {
      await copyAsync({ from: sourceUri, to: nextDestination })
    } else if (sourceUri?.startsWith('http:') || sourceUri?.startsWith('https:')) {
      await downloadAsync(sourceUri, nextDestination)
    } else {
      return null
    }

    await deleteAsync(destination, { idempotent: true })
    await moveAsync({ from: nextDestination, to: destination })
    return destination
  } catch {
    return null
  }
}

export async function deletePersistedPlayerPhoto(privyUserId: string): Promise<void> {
  try {
    await deleteAsync(playerPhotoPath(privyUserId), { idempotent: true })
  } catch {
    // Cache metadata is still cleared by the caller.
  }
}

/**
 * Persist a transparent PNG cutout locally for instant 2.5D rendering and sanctuary roaming.
 */
export async function persistCreatureCutout(id: string, base64: string, sourceUri?: string): Promise<string> {
  const dataUri = base64 ? `data:image/png;base64,${base64}` : ''

  try {
    const ok = await ensureDirectory(CUTOUTS_DIR)
    if (ok) {
      const dest = `${CUTOUTS_DIR}${id}.png`

      if (sourceUri && !sourceUri.startsWith('data:')) {
        try {
          await copyAsync({ from: sourceUri, to: dest })
          return dest
        } catch {
          // Fall through to base64 write.
        }
      }

      if (base64) {
        await writeAsStringAsync(dest, base64, { encoding: EncodingType.Base64 })
        return dest
      }
    }
  } catch {
    // Fall through to data URI.
  }

  if (dataUri) return dataUri
  return sourceUri || ''
}

export async function deletePersistedCutout(id: string): Promise<void> {
  try {
    await deleteAsync(`${CUTOUTS_DIR}${id}.png`, { idempotent: true })
  } catch {
    // Local index is cleared by caller.
  }
}

