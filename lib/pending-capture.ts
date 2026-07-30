/**
 * Hands a capture from the camera screen to the reveal screen.
 *
 * Base64 image data is far too large for route params, so it lives here for
 * the hop between the two screens. Each capture has a unique id so reveal can
 * detect a new shot after retake (the screen often stays mounted).
 */
export type PendingCapture = {
  id: string
  uri: string
  base64: string
}

let pending: PendingCapture | null = null

export function setPendingCapture(capture: Omit<PendingCapture, 'id'> & { id?: string }): void {
  pending = {
    id: capture.id ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    uri: capture.uri,
    base64: capture.base64,
  }
}

export function peekPendingCapture(): PendingCapture | null {
  return pending
}

export function takePendingCapture(): PendingCapture | null {
  const capture = pending
  pending = null
  return capture
}

export function clearPendingCapture(): void {
  pending = null
}
