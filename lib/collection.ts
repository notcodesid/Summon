import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Creature, Rarity } from '@/lib/creatures'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * The collection lives in Supabase, keyed by Privy user id.
 *
 * AsyncStorage is kept as a local mirror so the app still shows something
 * when the device is offline, when Supabase is not configured, or before the
 * player has signed in. Supabase wins whenever it answers — but local-only
 * catches are never discarded just because remote is empty or lagging.
 */
const STORAGE_KEY = 'summon.collection.v1'

type CreatureRow = {
  id: string
  privy_user_id: string
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

function creatureToRow(creature: Creature, privyUserId: string): CreatureRow {
  return {
    id: creature.id,
    privy_user_id: privyUserId,
    species: creature.species,
    common_name: creature.commonName,
    rarity: creature.rarity,
    stats: creature.stats,
    note: creature.note,
    photo_uri: creature.photoUri,
    captured_at: new Date(creature.capturedAt).toISOString(),
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

/** Camera cache paths die after a short time — never treat them as real photos. */
function isEphemeralPhotoUri(uri: string): boolean {
  if (!uri) return false
  return (
    uri.includes('/Library/Caches/') ||
    uri.includes('/Caches/Camera/') ||
    uri.includes('/cache/Camera/')
  )
}

function withUsablePhoto(creature: Creature): Creature {
  if (!creature.photoUri || !isEphemeralPhotoUri(creature.photoUri)) return creature
  return { ...creature, photoUri: '' }
}

/** Newest first when combining a fresh catch with the existing local list. */
function prependLocal(creature: Creature, existing: Creature[]): Creature[] {
  const rest = existing.filter((c) => c.id !== creature.id)
  return [creature, ...rest]
}

/** Newest first. Falls back to the local mirror if Supabase is unavailable. */
export async function loadCollection(privyUserId?: string): Promise<Creature[]> {
  const local = (await readLocal()).map(withUsablePhoto)

  if (!isSupabaseConfigured || !privyUserId) {
    // No account key — only keep local rows that still have a real photo.
    const cleaned = local.filter(
      (c) => c.photoUri.length > 0 && !isEphemeralPhotoUri(c.photoUri),
    )
    await writeLocal(cleaned)
    return cleaned
  }

  try {
    const { data, error } = await getSupabase()
      .from('creatures')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .order('captured_at', { ascending: false })

    if (error || !data) {
      const cleaned = local.filter(
        (c) => c.photoUri.length > 0 && !isEphemeralPhotoUri(c.photoUri),
      )
      await writeLocal(cleaned)
      return cleaned
    }

    // Successful remote read is source of truth (empty DB => empty Home).
    // Still keep very recent local-only catches that have a durable photo in
    // case Supabase insert has not landed yet.
    const remote = (data as CreatureRow[]).map(rowToCreature).map(withUsablePhoto)
    const remoteIds = new Set(remote.map((c) => c.id))
    const unsyncedLocal = local.filter(
      (c) =>
        !remoteIds.has(c.id) &&
        c.photoUri.length > 0 &&
        !isEphemeralPhotoUri(c.photoUri) &&
        Date.now() - c.capturedAt < 5 * 60 * 1000,
    )
    const merged = [...remote, ...unsyncedLocal].sort(
      (a, b) => b.capturedAt - a.capturedAt,
    )
    // Prefer durable local photo when remote still has a blank/cache path.
    const withPhotos = merged.map((creature) => {
      if (creature.photoUri) return creature
      const localHit = local.find((c) => c.id === creature.id)
      if (
        localHit?.photoUri &&
        !isEphemeralPhotoUri(localHit.photoUri)
      ) {
        return { ...creature, photoUri: localHit.photoUri }
      }
      return creature
    })

    await writeLocal(withPhotos)
    return withPhotos
  } catch {
    const cleaned = local.filter(
      (c) => c.photoUri.length > 0 && !isEphemeralPhotoUri(c.photoUri),
    )
    await writeLocal(cleaned)
    return cleaned
  }
}

/**
 * Saves a catch. Writes the local mirror first so the collection always
 * reflects the catch, then persists to Supabase.
 */
export async function addToCollection(
  creature: Creature,
  privyUserId?: string,
): Promise<Creature[]> {
  const next = prependLocal(creature, await readLocal())
  await writeLocal(next)

  if (!isSupabaseConfigured || !privyUserId) return next

  try {
    await getSupabase().from('creatures').insert(creatureToRow(creature, privyUserId))
  } catch {
    // Kept locally; a later load will re-sync from whatever Supabase has.
  }

  return next
}

/** Wipe local + remote creatures (broken photo rows, reset demos, etc.). */
export async function clearCollection(privyUserId?: string): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)

  if (!isSupabaseConfigured) return

  try {
    const client = getSupabase()
    if (privyUserId) {
      await client.from('creatures').delete().eq('privy_user_id', privyUserId)
    } else {
      await client.from('creatures').delete().neq('id', '')
    }
  } catch {
    // Local is already clear; remote wipe is best-effort.
  }
}
