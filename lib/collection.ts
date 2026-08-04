import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Creature, Rarity } from '@/lib/creatures'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'

/**
 * Collection: local AsyncStorage mirror + server (Edge Function) as source of truth.
 * Direct Supabase table access is locked down by RLS — all remote ops go through
 * the `creatures` function after Privy auth.
 */
const STORAGE_KEY = 'summon.collection.v1'

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

async function writeLocal(creatures: Creature[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(creatures))
  } catch {
    // A failed local mirror should never block the player.
  }
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

/** Newest first. Remote list (when signed in) is source of truth. */
export async function loadCollection(privyUserId?: string): Promise<Creature[]> {
  const local = (await readLocal()).map(withUsablePhoto)

  if (!isEdgeConfigured() || !privyUserId) {
    const cleaned = local.filter((c) => c.photoUri.length > 0)
    await writeLocal(cleaned)
    return cleaned
  }

  try {
    const { creatures } = await callEdgeFunction<{ creatures: CreatureRow[] }>('creatures', {
      action: 'list',
    })

    const remote = (creatures ?? []).map(rowToCreature).map(withUsablePhoto)
    const remoteIds = new Set(remote.map((c) => c.id))
    const unsyncedLocal = local.filter(
      (c) =>
        !remoteIds.has(c.id) &&
        c.photoUri.length > 0 &&
        Date.now() - c.capturedAt < 5 * 60 * 1000,
    )
    const merged = [...remote, ...unsyncedLocal].sort(
      (a, b) => b.capturedAt - a.capturedAt,
    )
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
 * Falls back to local-only if the server is unreachable.
 */
export async function addToCollection(
  creature: Creature,
  privyUserId?: string,
  imageBase64?: string,
): Promise<Creature[]> {
  const next = prependLocal(creature, await readLocal())
  await writeLocal(next)

  if (!isEdgeConfigured() || !privyUserId) return next

  try {
    const result = await callEdgeFunction<{
      creature?: {
        id: string
        species: string
        commonName: string
        rarity: string
        stats: Creature['stats']
        note: string
        photoUri: string | null
        capturedAt: number
      }
    }>('creatures', {
      action: 'save',
      creature: {
        id: creature.id,
        species: creature.species,
        commonName: creature.commonName,
        rarity: creature.rarity,
        stats: creature.stats,
        note: creature.note,
        photoUri: creature.photoUri,
        capturedAt: creature.capturedAt,
      },
      imageBase64: imageBase64 || undefined,
    })

    if (result.creature?.photoUri) {
      const updated = next.map((c) =>
        c.id === creature.id ? { ...c, photoUri: result.creature!.photoUri || c.photoUri } : c,
      )
      await writeLocal(updated)
      return updated
    }
  } catch {
    // Kept locally; a later load will re-sync from the server.
  }

  return next
}

export async function clearCollection(privyUserId?: string): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)

  if (!isEdgeConfigured() || !privyUserId) return

  try {
    await callEdgeFunction('creatures', { action: 'clear' })
  } catch {
    // Local is already clear.
  }
}
