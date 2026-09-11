import type { Creature } from '@/lib/creatures'

/**
 * Explorer progression: the single source of truth for XP, level and unlocks.
 *
 * XP only ever comes from things the player actually did — framing a good
 * photo, finishing the day's expedition. It is derived, never stored as a
 * running total, so it cannot drift out of sync with the collection that
 * produced it.
 */

export type ExplorerProgress = {
  totalXp: number
  level: number
  /** XP earned since reaching `level`. */
  xpIntoLevel: number
  /** XP the current level spans. */
  xpForLevel: number
  /** 0..1 through the current level. */
  progress: number
  /** Cumulative XP needed to reach the next level. */
  nextLevelXp: number
  /** XP still missing for the next level. */
  xpToNextLevel: number
}

/** Past this the curve is meaningless and the UI has nowhere to put it. */
export const MAX_LEVEL = 99

/**
 * Cumulative XP required to reach `level`. Level 1 is free; each level costs
 * 100 more than the last, so the first few arrive fast and later ones ask for
 * a real habit: 100, 300, 600, 1000, 1500…
 */
export function xpToReachLevel(level: number): number {
  const safe = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return 50 * (safe - 1) * safe
}

export function explorerProgress(totalXp: number): ExplorerProgress {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0))

  let level = 1
  while (level < MAX_LEVEL && xpToReachLevel(level + 1) <= xp) level += 1

  const levelFloor = xpToReachLevel(level)
  const nextLevelXp = xpToReachLevel(level + 1)
  const xpForLevel = nextLevelXp - levelFloor
  const xpIntoLevel = xp - levelFloor

  return {
    totalXp: xp,
    level,
    xpIntoLevel,
    xpForLevel,
    progress: xpForLevel > 0 ? xpIntoLevel / xpForLevel : 1,
    nextLevelXp,
    xpToNextLevel: Math.max(0, nextLevelXp - xp),
  }
}

/** Framing XP banked at capture time. Creatures caught before grades existed count as zero. */
export function captureXpFor(creatures: Creature[]): number {
  return creatures.reduce((total, creature) => total + Math.max(0, creature.captureBonusXp ?? 0), 0)
}
