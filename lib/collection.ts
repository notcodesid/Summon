import AsyncStorage from '@react-native-async-storage/async-storage'
import { deleteAsync, documentDirectory, EncodingType, readAsStringAsync } from 'expo-file-system/legacy'
import type { Creature, Rarity } from '@/lib/creatures'
import { saveWithDurableRetry } from '@/lib/durable-save'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'
import { preferDurableLocalMediaUri } from '@/lib/media-reference'

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
  return {
    id: row.id,
    species: row.species,
    commonName: row.common_name,
    rarity: row.rarity as Rarity,
    stats: row.stats,
    note: row.note ?? '',
    photoUri: row.photo_uri ?? '',
    capturedAt: Date.parse(row.captured_at),
  }
}

async function readLocal(): Promise<Creature[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Creature[]) : []
  } catch {
    return []
  }
}

async function writeLocal(creatures: Creature[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(creatures))
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

    return parsed.filter(
      (entry): entry is PendingSave =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof entry.queuedAt === 'number' &&
        Boolean(entry.creature) &&
        typeof entry.creature.id === 'string',
    )
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
  const next = [{ creature, queuedAt: Date.now() }, ...current.filter((entry) => entry.creature.id !== creature.id)]
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
  if (!creature.photoUri || !isEphemeralPhotoUri(creature.photoUri)) return creature
  // Keep data: URIs for offline display of just-caught creatures; strip camera cache only.
  if (uriIsData(creature.photoUri)) return creature
  return { ...creature, photoUri: '' }
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
    photoUri: creature.photoUri,
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
  if (!creature.photoUri) return null

  if (uriIsData(creature.photoUri)) {
    return base64FromDataUri(creature.photoUri)
  }

  try {
    return await readAsStringAsync(creature.photoUri, {
      encoding: EncodingType.Base64,
    })
  } catch {
    return null
  }
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

      await uploadCreature(entry.creature, imageBase64)
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
      .map((creature) => ({
        ...creature,
        photoUri: preferDurableLocalMediaUri(creature.photoUri, localById.get(creature.id)?.photoUri),
      }))
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
  const next = prependLocal(creature, await readLocal())

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
    const queued = await enqueuePendingSave(privyUserId, creature)
    if (!queued) {
      return {
        status: 'failed',
        message: 'Could not prepare a safe retry for this animal. Please try again.',
      }
    }
    return {
      status: 'pending',
      creature,
      message: 'Saved on this device. Cloud saving is unavailable right now.',
    }
  }

  const result = await saveWithDurableRetry({
    entity: creature,
    persistLocal: () => writeLocal(next),
    enqueue: () => enqueuePendingSave(privyUserId, creature),
    upload: async () => {
      const uploadBase64 = imageBase64 || (await imageBase64For(creature))
      if (!uploadBase64) {
        throw new Error('The photo is not ready to upload.')
      }
      return uploadCreature(creature, uploadBase64)
    },
    onRemoteSaved: async () => {},
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
    return { status: 'saved', creature }
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
      if (!creature.photoUri.startsWith(capturesDirectory)) return
      try {
        await deleteAsync(creature.photoUri, { idempotent: true })
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
