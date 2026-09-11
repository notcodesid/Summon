import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Creature } from '@/lib/creatures'
import { discoveryDayKey, finishedMission, type ExpeditionMission } from '@/lib/expeditions'

/**
 * Expedition log.
 *
 * The daily mission itself is derived from the collection (see
 * lib/expeditions.ts), so it needs no storage. What needs storage is the
 * *award*: the moment a mission is finished, so its XP is granted exactly
 * once no matter how many times the app reopens that day.
 *
 * Keyed by local calendar day, not by timestamp, so "today" means the same
 * thing here as it does everywhere else in the game.
 */

const STORAGE_PREFIX = 'summon.expeditions.v1.'
const LEVEL_PREFIX = 'summon.explorer-level.v1.'

export type CompletedExpedition = {
  day: string
  missionKey: ExpeditionMission['key']
  title: string
  rewardXp: number
  completedAt: number
}

export type ExpeditionLog = {
  /** Keyed by local day key — one completed expedition per day. */
  completed: Record<string, CompletedExpedition>
}

export const EMPTY_EXPEDITION_LOG: ExpeditionLog = { completed: {} }

function isCompletedExpedition(value: unknown): value is CompletedExpedition {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<CompletedExpedition>
  return (
    typeof entry.day === 'string' &&
    typeof entry.missionKey === 'string' &&
    typeof entry.rewardXp === 'number' &&
    Number.isFinite(entry.rewardXp)
  )
}

export async function loadExpeditionLog(privyUserId?: string): Promise<ExpeditionLog> {
  if (!privyUserId) return EMPTY_EXPEDITION_LOG
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${privyUserId}`)
    if (!raw) return EMPTY_EXPEDITION_LOG
    const parsed = JSON.parse(raw) as Partial<ExpeditionLog>
    if (!parsed?.completed || typeof parsed.completed !== 'object') return EMPTY_EXPEDITION_LOG

    const completed: Record<string, CompletedExpedition> = {}
    for (const [day, entry] of Object.entries(parsed.completed)) {
      if (isCompletedExpedition(entry)) completed[day] = { ...entry, day }
    }
    return { completed }
  } catch {
    // A bad log costs one day's XP, never the collection.
    return EMPTY_EXPEDITION_LOG
  }
}

async function saveExpeditionLog(privyUserId: string | undefined, log: ExpeditionLog): Promise<void> {
  if (!privyUserId) return
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${privyUserId}`, JSON.stringify(log))
  } catch {
    // The award stays in memory for this session; the mission can be re-met tomorrow.
  }
}

export function expeditionXpTotal(log: ExpeditionLog): number {
  return Object.values(log.completed).reduce((total, entry) => total + Math.max(0, entry.rewardXp), 0)
}

export function isExpeditionCompleteToday(log: ExpeditionLog, now: Date = new Date()): boolean {
  return Boolean(log.completed[discoveryDayKey(now)])
}

/**
 * Today's mission, but only when it is finished and has not been paid out.
 * Returns null while there is still something to find.
 */
export function pendingExpedition(
  creatures: Creature[],
  log: ExpeditionLog,
  now: Date = new Date(),
): ExpeditionMission | null {
  if (isExpeditionCompleteToday(log, now)) return null
  return finishedMission(creatures, now)
}

/**
 * Files a finished expedition and returns the updated log. Idempotent per day:
 * a second call for the same day returns the log unchanged.
 */
export async function recordExpedition(
  privyUserId: string | undefined,
  log: ExpeditionLog,
  mission: ExpeditionMission,
  now: Date = new Date(),
): Promise<ExpeditionLog> {
  const day = discoveryDayKey(now)
  if (log.completed[day]) return log

  const next: ExpeditionLog = {
    completed: {
      ...log.completed,
      [day]: {
        day,
        missionKey: mission.key,
        title: mission.title,
        rewardXp: mission.rewardXp,
        completedAt: now.getTime(),
      },
    },
  }
  await saveExpeditionLog(privyUserId, next)
  return next
}

/**
 * The last Explorer level the player was congratulated for.
 *
 * XP arrives from more than one place — a well-framed photo levels you up just
 * as surely as finishing an expedition does — so the level-up moment cannot
 * hang off the expedition award alone. Comparing against the last announced
 * level covers every source at once, and keeps a level from being celebrated
 * again on every visit to the sanctuary.
 */
export async function loadAnnouncedLevel(privyUserId?: string): Promise<number> {
  if (!privyUserId) return 1
  try {
    const raw = await AsyncStorage.getItem(`${LEVEL_PREFIX}${privyUserId}`)
    const parsed = raw ? Number.parseInt(raw, 10) : 1
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  } catch {
    return 1
  }
}

export async function saveAnnouncedLevel(privyUserId: string | undefined, level: number): Promise<void> {
  if (!privyUserId) return
  try {
    await AsyncStorage.setItem(`${LEVEL_PREFIX}${privyUserId}`, String(Math.max(1, Math.floor(level))))
  } catch {
    // Worst case, this level is announced once more next time.
  }
}
