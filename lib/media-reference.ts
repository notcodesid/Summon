/**
 * Signed Storage URLs expire. Prefer a durable on-device copy when one exists,
 * while still allowing a signed remote URL on a new device.
 */
export function preferDurableLocalMediaUri(remoteUri: string, localUri?: string): string {
  if (localUri?.startsWith('file:') || localUri?.startsWith('data:')) {
    return localUri
  }
  return remoteUri
}
