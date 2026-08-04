import {
  copyAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy'

/**
 * Local durable copy for offline / instant UI.
 * Permanent cloud URLs come from the creatures Edge Function (Supabase Storage).
 */
const CAPTURES_DIR = `${documentDirectory ?? ''}captures/`

async function ensureCapturesDir(): Promise<boolean> {
  if (!documentDirectory) return false
  const info = await getInfoAsync(CAPTURES_DIR)
  if (!info.exists) {
    await makeDirectoryAsync(CAPTURES_DIR, { intermediates: true })
  }
  return true
}

/**
 * Persist a JPEG locally so the collection can render before / without Storage.
 * Prefer Documents file; fall back to data URI.
 */
export async function persistCapturePhoto(
  id: string,
  base64: string,
  sourceUri: string,
): Promise<string> {
  const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : ''

  try {
    const ok = await ensureCapturesDir()
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
