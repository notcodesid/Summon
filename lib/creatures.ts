/**
 * Creature model. Stats are derived from the species name, not stored on a
 * server — the same animal always yields the same creature, so a fox you
 * scan today matches the fox someone else scanned last week.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type Stats = {
  hp: number
  attack: number
  defense: number
  speed: number
}

export type Creature = {
  id: string
  species: string
  commonName: string
  rarity: Rarity
  stats: Stats
  note: string
  photoUri: string
  capturedAt: number
}

export const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
}

/** Accent per tier. Deliberately restrained to match the mono theme. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8A8B86',
  uncommon: '#4F7A52',
  rare: '#3B6CA8',
  epic: '#7A4FA8',
  legendary: '#B07A2B',
}

const RARITY_POWER: Record<Rarity, number> = {
  common: 0,
  uncommon: 12,
  rare: 24,
  epic: 36,
  legendary: 50,
}

/** djb2. Stable across runs so a species always maps to the same stat line. */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  }
  return h
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

export function powerOf(stats: Stats): number {
  return stats.hp + stats.attack + stats.defense + stats.speed
}

export function isRarity(value: string): value is Rarity {
  return (RARITY_ORDER as string[]).includes(value)
}
