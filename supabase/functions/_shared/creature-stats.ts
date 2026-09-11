/**
 * Deterministic creature stats — the server's copy.
 *
 * This MUST produce byte-identical output to `statsFor` in lib/creatures.ts.
 * The app renders whatever this returns, so a divergence would mean the
 * creature a player sees is not the creature their battle actually uses.
 * `tests/creature-stats-parity.test.mjs` fails if the two ever disagree.
 *
 * Stats are derived from the species name rather than stored, which is what
 * makes them trustworthy: the server can recompute them from the species it
 * attested at scan time, so a client cannot invent a stronger creature.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITY_ORDER as string[]).includes(value)
}

const RARITY_POWER: Record<Rarity, number> = {
  common: 0,
  uncommon: 12,
  rare: 24,
  epic: 36,
  legendary: 50,
}

/** djb2. Must match lib/creatures.ts hash() exactly. */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  }
  return h
}

export type Stats = {
  hp: number
  attack: number
  defense: number
  speed: number
}

export function statsFor(species: string, rarity: Rarity): Stats {
  const h = hash(species.toLowerCase().trim())
  const power = RARITY_POWER[rarity]
  const spread = (shift: number, span: number) => (h >>> shift) % span

  return {
    hp: 40 + spread(0, 30) + power,
    attack: 30 + spread(6, 30) + power,
    defense: 30 + spread(12, 30) + power,
    speed: 30 + spread(18, 30) + power,
  }
}

export function isStats(value: unknown): value is Stats {
  if (!value || typeof value !== 'object') return false
  const stats = value as Partial<Stats>
  return (['hp', 'attack', 'defense', 'speed'] as const).every(
    (key) => typeof stats[key] === 'number' && Number.isFinite(stats[key]),
  )
}

/** Species identity for comparison — case and surrounding space must not matter. */
export function normalizeSpecies(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
