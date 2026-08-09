/** Maximum accepted decoded JPEG size for the API and private Storage buckets. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_EDGE = 1600

type PreparedImage = {
  uri: string
  base64: string
}

function base64ByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

async function renderJpeg(
  uri: string,
  width?: number | null,
  sourceBase64?: string,
  compress = 0.72,
): Promise<PreparedImage> {
  const actions = width && width > MAX_IMAGE_EDGE ? [{ resize: { width: MAX_IMAGE_EDGE } }] : []
  try {
    // This module is available after the next development-build rebuild.
    // Lazy loading keeps an older installed dev client from crashing at launch.
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator')
    const result = await manipulateAsync(uri, actions, {
      base64: true,
      compress,
      format: SaveFormat.JPEG,
    })

    if (!result.base64) throw new Error('Could not prepare this image.')
    return { uri: result.uri, base64: result.base64 }
  } catch (error) {
    // Camera and ImagePicker already produce a JPEG at the requested quality.
    // A bounded original remains safe while this older build awaits rebuilding.
    if (sourceBase64 && base64ByteLength(sourceBase64) <= MAX_IMAGE_BYTES) {
      return { uri, base64: sourceBase64 }
    }

    throw error
  }
}

/**
 * Produces a bounded JPEG before a photo ever leaves the device. A second,
 * stronger compression pass keeps unusually detailed images under the server
 * limit without relying on a later network failure.
 */
export async function prepareImageForUpload(
  uri: string,
  width?: number | null,
  sourceBase64?: string,
): Promise<PreparedImage> {
  const first = await renderJpeg(uri, width, sourceBase64)
  if (base64ByteLength(first.base64) <= MAX_IMAGE_BYTES) return first

  const second = await renderJpeg(uri, width, sourceBase64, 0.55)
  if (base64ByteLength(second.base64) <= MAX_IMAGE_BYTES) return second

  throw new Error('This image is too large to upload. Please choose a simpler photo.')
}
