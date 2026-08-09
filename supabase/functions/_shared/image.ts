export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

function stripBase64Prefix(data: string): string {
  const marker = 'base64,'
  const index = data.indexOf(marker)
  return index >= 0 ? data.slice(index + marker.length) : data
}

/**
 * Reject oversized payloads before decoding them or forwarding them to a
 * provider. The mobile client uploads JPEGs, but this is intentionally a
 * server-side guard rather than a client-only convention.
 */
export function imageDataFromBase64(input: string): {
  base64: string
  bytes: Uint8Array
} {
  const base64 = stripBase64Prefix(input).trim()
  if (!base64) throw new ImageValidationError('Missing image data')

  const maxBase64Length = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4
  if (base64.length > maxBase64Length) {
    throw new ImageValidationError('Image is too large. Use a photo under 3 MB.')
  }

  try {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ImageValidationError('Image is too large. Use a photo under 3 MB.')
    }
    return { base64, bytes }
  } catch (error) {
    if (error instanceof ImageValidationError) throw error
    throw new ImageValidationError('Image data is invalid.')
  }
}
