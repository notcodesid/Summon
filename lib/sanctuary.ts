import AsyncStorage from '@react-native-async-storage/async-storage'
import { isSanctuaryPoint, type SanctuaryPoint } from '@/lib/sanctuary-position'

/**
 * Persistence for sanctuary arrangements.
 *
 * A creature's default spot is derived (see lib/sanctuary-position.ts). Only
 * spots the player has actually dragged are stored, so moving a creature is a
 * deliberate act that sticks, and everything else keeps its natural home.
 */
export {
  clampToBounds,
  homePositionFor,
  isSanctuaryPoint,
  type SanctuaryBounds,
  type SanctuaryPoint,
} from '@/lib/sanctuary-position'

const STORAGE_PREFIX = 'summon.sanctuary.v1.'

export type SanctuaryPlacements = Record<string, SanctuaryPoint>

export async function loadPlacements(privyUserId?: string): Promise<SanctuaryPlacements> {
  if (!privyUserId) return {}
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${privyUserId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const clean: SanctuaryPlacements = {}
    for (const [id, point] of Object.entries(parsed)) {
      if (isSanctuaryPoint(point)) clean[id] = { x: point.x, y: point.y }
    }
    return clean
  } catch {
    // A bad cache just means everyone goes back to their derived home spot.
    return {}
  }
}

export async function savePlacement(
  privyUserId: string | undefined,
  creatureId: string,
  point: SanctuaryPoint,
): Promise<void> {
  if (!privyUserId || !isSanctuaryPoint(point)) return
  try {
    const current = await loadPlacements(privyUserId)
    current[creatureId] = { x: point.x, y: point.y }
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${privyUserId}`, JSON.stringify(current))
  } catch {
    // Losing an arrangement is survivable; the derived spot still applies.
  }
}

export async function clearPlacements(privyUserId?: string): Promise<void> {
  if (!privyUserId) return
  try {
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}${privyUserId}`)
  } catch {
    // Nothing to do.
  }
}
