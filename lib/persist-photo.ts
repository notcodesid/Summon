import {
  copyAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy'

/**
 * Camera captures land in Library/Caches and get purged. Collection photos must
 * either live under Documents or be inlined as a data URI.
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
 * Return a URI that React Native Image can load after app restarts.
 * Prefer a durable file under Documents; fall back to an inlined data URI.
 */
export async function persistCapturePhoto(
  id: string,
  base64: string,
  sourceUri: string,
): Promise<string> {
  // Data URI always works for <Image source={{ uri }} /> and survives reloads.
  // Use it if file copy fails or document storage is unavailable.
  const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : ''

  try {
    const ok = await ensureCapturesDir()
    if (ok) {
      const dest = `${CAPTURES_DIR}${id}.jpg`

      if (sourceUri) {
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
