export type PhotoMediaReference = {
  photoUri: string
  localPhotoUri?: string
  remotePhotoUri?: string
}

type PhotoMediaInput =
  | string
  | null
  | undefined
  | {
      photoUri?: unknown
      localPhotoUri?: unknown
      remotePhotoUri?: unknown
    }

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function isDurableLocalMediaUri(uri?: string): boolean {
  return Boolean(uri?.startsWith('file:') || uri?.startsWith('data:'))
}

export function resolvePhotoMediaUri(media: Pick<PhotoMediaReference, 'localPhotoUri' | 'remotePhotoUri'>): string {
  return media.localPhotoUri || media.remotePhotoUri || ''
}

/**
 * Migrates the old one-string cache format and always keeps local and remote
 * references separate. Signed URLs may refresh without replacing the durable
 * on-device copy.
 */
export function normalizePhotoMediaReference(input: PhotoMediaInput): PhotoMediaReference {
  const legacyPhotoUri =
    typeof input === 'string'
      ? stringValue(input)
      : input && typeof input === 'object'
        ? stringValue(input.photoUri)
        : undefined
  const explicitLocal = input && typeof input === 'object' ? stringValue(input.localPhotoUri) : undefined
  const explicitRemote = input && typeof input === 'object' ? stringValue(input.remotePhotoUri) : undefined

  const localPhotoUri =
    explicitLocal && isDurableLocalMediaUri(explicitLocal)
      ? explicitLocal
      : legacyPhotoUri && isDurableLocalMediaUri(legacyPhotoUri)
        ? legacyPhotoUri
        : undefined
  const remotePhotoUri =
    explicitRemote || (legacyPhotoUri && !isDurableLocalMediaUri(legacyPhotoUri) ? legacyPhotoUri : undefined)

  return {
    photoUri: resolvePhotoMediaUri({ localPhotoUri, remotePhotoUri }),
    ...(localPhotoUri ? { localPhotoUri } : {}),
    ...(remotePhotoUri ? { remotePhotoUri } : {}),
  }
}

export function refreshRemotePhotoUri(input: PhotoMediaInput, remotePhotoUri?: string | null): PhotoMediaReference {
  const current = normalizePhotoMediaReference(input)
  return normalizePhotoMediaReference({
    localPhotoUri: current.localPhotoUri,
    remotePhotoUri: remotePhotoUri || undefined,
  })
}
