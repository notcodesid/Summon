import AsyncStorage from '@react-native-async-storage/async-storage'
import { deleteAsync, documentDirectory, EncodingType, readAsStringAsync } from 'expo-file-system/legacy'
import type { Creature, Rarity } from '@/lib/creatures'
import { saveWithDurableRetry } from '@/lib/durable-save'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'
import { normalizePhotoMediaReference, refreshRemotePhotoUri } from '@/lib/media-reference'

/**
 * Collection: local AsyncStorage mirror + server (Edge Function) as source of truth.
 * Direct Supabase table access is locked down by RLS — all remote ops go through
 * the `creatures` function after Privy auth.
 */
const STORAGE_KEY = 'summon.collection.v1'
const PENDING_SAVE_KEY_PREFIX = 'summon.collection.pending.v1.'

type CreatureRow = {
  id: string
  privy_user_id?: string
  species: string
  common_name: string
  rarity: string
  stats: Creature['stats']
  note: string | null
  photo_uri: string | null
  captured_at: string
}

type PendingSave = {
  creature: Creature
  queuedAt: number
}

type RemoteCreature = {
  id: string
  species: string
  commonName: string
  rarity: string
  stats: Creature['stats']
  note: string
  photoUri: string | null
  capturedAt: number
}

export type CollectionSaveResult =
  | { status: 'saved'; creature: Creature }
  | { status: 'pending'; creature: Creature; message: string }
  | { status: 'failed'; message: string }

function rowToCreature(row: CreatureRow): Creature {
  const media = normalizePhotoMediaReference({
    remotePhotoUri: row.photo_uri ?? undefined,
  })
  return {
    id: row.id,
    species: row.species,
    commonName: row.common_name,
    rarity: row.rarity as Rarity,
    stats: row.stats,
    note: row.note ?? '',
    ...media,
    capturedAt: Date.parse(row.captured_at),
  }
}

function normalizeCreatureMedia(creature: Creature): Creature {
  return {
    ...creature,
    ...normalizePhotoMediaReference(creature),
  }
}

async function readLocal(): Promise<Creature[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Creature[]).map(normalizeCreatureMedia) : []
  } catch {
    return []
  }
}

async function writeLocal(creatures: Creature[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(creatures.map(normalizeCreatureMedia)))
    return true
  } catch {
    return false
  }
}

function pendingSaveKey(privyUserId: string): string {
  return `${PENDING_SAVE_KEY_PREFIX}${privyUserId}`
}

async function readPendingSaves(privyUserId: string): Promise<PendingSave[]> {
  try {
    const raw = await AsyncStorage.getItem(pendingSaveKey(privyUserId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (entry): entry is PendingSave =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof entry.queuedAt === 'number' &&
          Boolean(entry.creature) &&
          typeof entry.creature.id === 'string',
      )
      .map((entry) => ({
        ...entry,
        creature: normalizeCreatureMedia(entry.creature),
      }))
  } catch {
    return []
  }
}

async function writePendingSaves(privyUserId: string, pending: PendingSave[]): Promise<boolean> {
  try {
    const key = pendingSaveKey(privyUserId)
    if (pending.length === 0) {
      await AsyncStorage.removeItem(key)
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(pending))
    }
    return true
  } catch {
    return false
  }
}

async function enqueuePendingSave(privyUserId: string, creature: Creature): Promise<boolean> {
  const current = await readPendingSaves(privyUserId)
  const next = [
    { creature: normalizeCreatureMedia(creature), queuedAt: Date.now() },
    ...current.filter((entry) => entry.creature.id !== creature.id),
  ]
  return writePendingSaves(privyUserId, next)
}

function isEphemeralPhotoUri(uri: string): boolean {
  if (!uri) return false
  return (
    uri.includes('/Library/Caches/') ||
    uri.includes('/Caches/Camera/') ||
    uri.includes('/cache/Camera/') ||
    uri.startsWith('data:')
  )
}

function withUsablePhoto(creature: Creature): Creature {
  const normalized = normalizeCreatureMedia(creature)
  const localPhotoUri = normalized.localPhotoUri
  if (!localPhotoUri || !isEphemeralPhotoUri(localPhotoUri)) return normalized
  // Keep data: URIs for offline display of just-caught creatures; strip camera cache only.
  if (uriIsData(localPhotoUri)) return normalized
  return {
    ...normalized,
    ...normalizePhotoMediaReference({
      remotePhotoUri: normalized.remotePhotoUri,
    }),
  }
}

function uriIsData(uri: string): boolean {
  return uri.startsWith('data:')
}

function prependLocal(creature: Creature, existing: Creature[]): Creature[] {
  const rest = existing.filter((c) => c.id !== creature.id)
  return [creature, ...rest]
}

function creaturePayload(creature: Creature) {
  return {
    id: creature.id,
    species: creature.species,
    commonName: creature.commonName,
    rarity: creature.rarity,
    stats: creature.stats,
    note: creature.note,
    capturedAt: creature.capturedAt,
  }
}

async function uploadCreature(creature: Creature, imageBase64: string): Promise<RemoteCreature> {
  const result = await callEdgeFunction<{ creature?: RemoteCreature }>('creatures', {
    action: 'save',
    creature: creaturePayload(creature),
    imageBase64,
  })

  if (!result.creature) {
    throw new Error('The save service did not confirm this animal.')
  }

  return result.creature
}

function base64FromDataUri(uri: string): string | null {
  const marker = 'base64,'
  const index = uri.indexOf(marker)
  return index >= 0 ? uri.slice(index + marker.length) : null
}

async function imageBase64For(creature: Creature): Promise<string | null> {
  const { localPhotoUri } = normalizePhotoMediaReference(creature)
  if (!localPhotoUri) return null

  if (uriIsData(localPhotoUri)) {
    return base64FromDataUri(localPhotoUri)
  }

  try {
    return await readAsStringAsync(localPhotoUri, {
      encoding: EncodingType.Base64,
    })
  } catch {
    return null
  }
}

function withRefreshedRemotePhoto(localCreature: Creature, remoteCreature: RemoteCreature): Creature {
  return {
    ...localCreature,
    ...refreshRemotePhotoUri(localCreature, remoteCreature.photoUri),
  }
}

async function storeRemotePhotoRefresh(creature: Creature, remoteCreature: RemoteCreature): Promise<Creature> {
  const refreshed = withRefreshedRemotePhoto(creature, remoteCreature)
  const local = await readLocal()
  await writeLocal(
    local.map((entry) =>
      entry.id === refreshed.id
        ? {
            ...entry,
            ...refreshRemotePhotoUri(entry, remoteCreature.photoUri),
          }
        : entry,
    ),
  )
  return refreshed
}

/**
 * Retries locally queued saves. It is safe to call on every collection load:
 * Edge `save` upserts by creature id, and successful items are removed only
 * after the server acknowledges the write.
 */
export async function syncPendingSaves(privyUserId?: string): Promise<number> {
  if (!isEdgeConfigured() || !privyUserId) return 0

  const pending = await readPendingSaves(privyUserId)
  if (pending.length === 0) return 0

  const remaining: PendingSave[] = []
  let synced = 0

  for (const entry of pending) {
    try {
      const imageBase64 = await imageBase64For(entry.creature)
      if (!imageBase64) {
        throw new Error('The saved photo is not available for upload yet.')
      }

      const remoteCreature = await uploadCreature(entry.creature, imageBase64)
      await storeRemotePhotoRefresh(entry.creature, remoteCreature)
      synced += 1
    } catch {
      remaining.push(entry)
    }
  }

  await writePendingSaves(privyUserId, remaining)
  return synced
}

/** Newest first. Remote list (when signed in) is source of truth. */
export async function loadCollection(privyUserId?: string): Promise<Creature[]> {
  if (!isEdgeConfigured() || !privyUserId) {
    const local = (await readLocal()).map(withUsablePhoto)
    const cleaned = local.filter((c) => c.photoUri.length > 0)
    await writeLocal(cleaned)
    return cleaned
  }

  await syncPendingSaves(privyUserId)
  const local = (await readLocal()).map(withUsablePhoto)

  try {
    const { creatures } = await callEdgeFunction<{ creatures: CreatureRow[] }>('creatures', {
      action: 'list',
    })

    const localById = new Map(local.map((creature) => [creature.id, creature]))
    const remote = (creatures ?? [])
      .map(rowToCreature)
      .map(withUsablePhoto)
      .map((creature) => {
        const existing = localById.get(creature.id)
        return {
          ...creature,
          ...refreshRemotePhotoUri(existing ?? creature, creature.remotePhotoUri),
        }
      })
    const remoteIds = new Set(remote.map((c) => c.id))
    const pendingIds = new Set((await readPendingSaves(privyUserId)).map((entry) => entry.creature.id))
    const unsyncedLocal = local.filter((c) => !remoteIds.has(c.id) && c.photoUri.length > 0 && pendingIds.has(c.id))
    const merged = [...remote, ...unsyncedLocal].sort((a, b) => b.capturedAt - a.capturedAt)
    await writeLocal(merged)
    return merged
  } catch {
    const cleaned = local.filter((c) => c.photoUri.length > 0)
    await writeLocal(cleaned)
    return cleaned
  }
}

/**
 * Saves a catch. Uploads photo to Storage (via Edge) when base64 is provided.
 * A remote failure is explicitly reported as pending only after a durable
 * local retry record is written.
 */
export async function addToCollection(
  creature: Creature,
  privyUserId?: string,
  imageBase64?: string,
): Promise<CollectionSaveResult> {
  const normalizedCreature = normalizeCreatureMedia(creature)
  const next = prependLocal(normalizedCreature, await readLocal())

  if (!privyUserId) {
    return {
      status: 'failed',
      message: 'Sign in before adding an animal to your collection.',
    }
  }

  if (!isEdgeConfigured()) {
    const storedLocally = await writeLocal(next)
    if (!storedLocally) {
      return {
        status: 'failed',
        message: 'Could not save this animal on this device. Please try again.',
      }
    }
    const queued = await enqueuePendingSave(privyUserId, normalizedCreature)
    if (!queued) {
      return {
        status: 'failed',
        message: 'Could not prepare a safe retry for this animal. Please try again.',
      }
    }
    return {
      status: 'pending',
      creature: normalizedCreature,
      message: 'Saved on this device. Cloud saving is unavailable right now.',
    }
  }

  let confirmedCreature = normalizedCreature
  const result = await saveWithDurableRetry({
    entity: normalizedCreature,
    persistLocal: () => writeLocal(next),
    enqueue: () => enqueuePendingSave(privyUserId, normalizedCreature),
    upload: async () => {
      const uploadBase64 = imageBase64 || (await imageBase64For(normalizedCreature))
      if (!uploadBase64) {
        throw new Error('The photo is not ready to upload.')
      }
      return uploadCreature(normalizedCreature, uploadBase64)
    },
    onRemoteSaved: async (remoteCreature) => {
      confirmedCreature = await storeRemotePhotoRefresh(normalizedCreature, remoteCreature)
    },
    dequeue: async () => {
      await writePendingSaves(
        privyUserId,
        (await readPendingSaves(privyUserId)).filter((entry) => entry.creature.id !== creature.id),
      )
    },
    pendingMessage: 'Saved on this device. We’ll keep trying to upload it when you reopen your collection.',
    localFailureMessage: 'Could not save this animal on this device. Please try again.',
    queueFailureMessage: 'Could not prepare a safe retry for this animal. Please try again.',
  })

  if (result.status === 'saved') {
    return { status: 'saved', creature: confirmedCreature }
  }

  if (result.status === 'pending') {
    return {
      status: 'pending',
      creature: result.entity,
      message: result.message,
    }
  }

  return result
}

async function clearLocalPhotos(creatures: Creature[]): Promise<void> {
  const capturesDirectory = `${documentDirectory ?? ''}captures/`
  await Promise.all(
    creatures.map(async (creature) => {
      const { localPhotoUri } = normalizePhotoMediaReference(creature)
      if (!localPhotoUri?.startsWith(capturesDirectory)) return
      try {
        await deleteAsync(localPhotoUri, { idempotent: true })
      } catch {
        // The local index is still cleared below.
      }
    }),
  )
}

/** Removes the local mirror and the on-device copies of saved photos. */
export async function clearLocalCollection(privyUserId?: string): Promise<void> {
  const local = await readLocal()
  await clearLocalPhotos(local)
  await AsyncStorage.removeItem(STORAGE_KEY)
  if (privyUserId) {
    await AsyncStorage.removeItem(pendingSaveKey(privyUserId))
  }
}

/**
 * Deletes the collection from the server first. Local records are removed
 * only after the private media and rows are confirmed deleted remotely.
 */
export async function clearCollection(privyUserId?: string): Promise<boolean> {
  if (!isEdgeConfigured() || !privyUserId) return false

  try {
    await callEdgeFunction('creatures', { action: 'clear' })
    await clearLocalCollection(privyUserId)
    return true
  } catch {
    return false
  }
}
