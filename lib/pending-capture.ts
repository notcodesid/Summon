/**
 * Hands a capture from the camera screen to the reveal screen.
 *
 * Base64 image data is far too large for route params, so it lives here for
 * the one navigation hop between the two screens.
 */
type PendingCapture = {
  uri: string
  base64: string
}

let pending: PendingCapture | null = null

export function setPendingCapture(capture: PendingCapture): void {
  pending = capture
}

export function takePendingCapture(): PendingCapture | null {
  const capture = pending
  pending = null
  return capture
}
