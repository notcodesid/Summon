import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Creature, Rarity } from '@/lib/creatures'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * The collection lives in Supabase, keyed by Privy user id.
 *
 * AsyncStorage is kept as a local mirror so the app still shows something
 * when the device is offline, when Supabase is not configured, or before the
 * player has signed in. Supabase wins whenever it answers.
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

/** Newest first. Falls back to the local mirror if Supabase is unavailable. */
export async function loadCollection(privyUserId?: string): Promise<Creature[]> {
  if (!isSupabaseConfigured || !privyUserId) {
    return readLocal()
  }

  try {
    const { data, error } = await getSupabase()
      .from('creatures')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .order('captured_at', { ascending: false })

    if (error || !data) return readLocal()

    const creatures = (data as CreatureRow[]).map(rowToCreature)
    await writeLocal(creatures)
    return creatures
  } catch {
    return readLocal()
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
  const next = [creature, ...(await readLocal())]
  await writeLocal(next)

  if (!isSupabaseConfigured || !privyUserId) return next

  try {
    await getSupabase().from('creatures').insert(creatureToRow(creature, privyUserId))
  } catch {
    // Kept locally; a later load will re-sync from whatever Supabase has.
  }

  return next
}

export async function clearCollection(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
