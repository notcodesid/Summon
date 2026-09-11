/**
 * Bond: how well you know one particular animal.
 *
 * It grows from time actually spent together — one step for each day you stop
 * and spend a moment with a creature in the sanctuary. It is deliberately slow.
 * A bond you can rush is not a bond, and the sanctuary's daily interaction
 * already exists as the moment that earns it; this gives that moment something
 * to accumulate into.
 *
 * The curve is triangular: reaching level L takes L(L-1)/2 days. So the first
 * new level arrives after a single visit, the fifth after ten days, and the
 * twentieth after 190 — far enough away to stay worth something.
 */

export const MAX_BOND = 20

export type BondProgress = {
  /** Days spent together, counting each day once. */
  days: number
  level: number
  /** Days since reaching `level`. */
  daysIntoLevel: number
  /** Days the current level spans. */
  daysForLevel: number
  /** 0..1 through the current level. */
  progress: number
  /** Days still needed for the next level. */
  daysToNextLevel: number
  label: string
  nextLabel: string | null
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.max(1, Math.min(MAX_BOND, Math.floor(level)))
}

/** Days together required to reach a bond level. Level 1 is where everyone starts. */
export function daysForBondLevel(level: number): number {
  const safe = clampLevel(level)
  return (safe * (safe - 1)) / 2
}

export function bondLevelFor(days: number): number {
  const safe = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0))
  let level = 1
  while (level < MAX_BOND && daysForBondLevel(level + 1) <= safe) level += 1
  return level
}

/** What the relationship is called at a given level. */
export function bondLabel(level: number): string {
  const safe = clampLevel(level)
  if (safe >= 16) return 'Inseparable'
  if (safe >= 11) return 'Constant'
  if (safe >= 7) return 'Bonded'
  if (safe >= 4) return 'Trusted'
  if (safe >= 2) return 'Getting familiar'
  return 'New companion'
}

export function bondProgress(days: number): BondProgress {
  const safe = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0))
  const level = bondLevelFor(safe)
  const floor = daysForBondLevel(level)
  const ceiling = daysForBondLevel(level + 1)
  const daysForLevel = ceiling - floor
  const daysIntoLevel = safe - floor
  const atMax = level >= MAX_BOND

  return {
    days: safe,
    level,
    daysIntoLevel,
    daysForLevel,
    progress: atMax || daysForLevel <= 0 ? 1 : daysIntoLevel / daysForLevel,
    daysToNextLevel: atMax ? 0 : Math.max(0, ceiling - safe),
    label: bondLabel(level),
    nextLabel: atMax ? null : bondLabel(level + 1),
  }
}
