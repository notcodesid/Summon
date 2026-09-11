import type { Creature, Rarity } from '@/lib/creatures'

/**
 * The field guide: a regional roster of animals worth finding, filled in as
 * you actually meet them.
 *
 * The roster lives with the artwork (lib/animal-images.ts), because an entry
 * is only worth showing if there is a photograph to show for it. This module
 * is deliberately image-free so the matching can be reasoned about and tested
 * without Metro in the way.
 *
 * Matching is lenient on purpose. Species names come from a vision model and
 * come back phrased differently ("Grey Squirrel", "Eastern Gray Squirrel",
 * "Sciurus carolinensis"), so entries carry aliases and we match on the genus
 * or a shared distinctive word rather than on an exact string.
 */

export type RosterEntry = {
  commonName: string
  species: string
  aliases?: readonly string[]
}

export type FieldGuideEntry = {
  key: string
  commonName: string
  species: string
  /** How many individuals of this species you have. Zero means not found yet. */
  count: number
  /** The one to show: rarest first, then most recent. */
  creature: Creature | null
  firstSeenAt: number | null
}

export type FieldGuide = {
  entries: FieldGuideEntry[]
  discovered: number
  total: number
}

/** Mirrors RARITY_ORDER in lib/creatures.ts; tests/field-guide.test.mjs pins them together. */
const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

/**
 * Words too generic to prove a match on their own — "Red" must not link a
 * Red Fox to a Red Squirrel, and "Wild" proves nothing at all.
 */
const STOP_WORDS = new Set([
  'the',
  'and',
  'wild',
  'common',
  'domestic',
  'european',
  'eastern',
  'western',
  'northern',
  'southern',
  'north',
  'south',
  'american',
  'grey',
  'gray',
  'red',
  'black',
  'brown',
  'white',
  'little',
  'large',
  'great',
  'spp',
])

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
}

function genusOf(species: string): string {
  return species.trim().toLowerCase().split(/\s+/)[0] ?? ''
}

export function matchesRoster(creature: Creature, entry: RosterEntry): boolean {
  const genus = genusOf(entry.species)
  const creatureSpecies = (creature.species || '').toLowerCase().trim()
  if (genus && creatureSpecies.startsWith(genus)) return true

  const creatureWords = new Set([...words(creature.species || ''), ...words(creature.commonName || '')])
  const entryWords = [
    ...words(entry.commonName),
    ...words(entry.species),
    ...(entry.aliases ?? []).flatMap((alias) => words(alias)),
  ]
  return entryWords.some((word) => creatureWords.has(word))
}

function seenAt(creatures: Creature[]): number | null {
  if (creatures.length === 0) return null
  return creatures.reduce((earliest, creature) => Math.min(earliest, creature.capturedAt), Infinity)
}

function bestOf(creatures: Creature[]): Creature | null {
  return creatures.reduce<Creature | null>((best, creature) => {
    if (!best) return creature
    const rank = RARITY_RANK[creature.rarity] ?? 0
    const bestRank = RARITY_RANK[best.rarity] ?? 0
    if (rank !== bestRank) return rank > bestRank ? creature : best
    return creature.capturedAt > best.capturedAt ? creature : best
  }, null)
}

function entryKey(entry: RosterEntry): string {
  return `${entry.species}|${entry.commonName}`.toLowerCase()
}

/**
 * Fills the roster in, and appends anything you have caught that the roster
 * does not know about — a real sighting is never hidden just because it is not
 * on the list.
 */
export function buildFieldGuide(creatures: Creature[], roster: readonly RosterEntry[]): FieldGuide {
  const buckets = roster.map((entry) => ({ entry, members: [] as Creature[] }))
  const extras: Creature[] = []

  for (const creature of creatures) {
    const bucket = buckets.find((candidate) => matchesRoster(creature, candidate.entry))
    if (bucket) bucket.members.push(creature)
    else extras.push(creature)
  }

  const entries: FieldGuideEntry[] = buckets.map(({ entry, members }) => ({
    key: entryKey(entry),
    commonName: entry.commonName,
    species: entry.species,
    count: members.length,
    creature: bestOf(members),
    firstSeenAt: seenAt(members),
  }))

  // Species outside the roster, grouped by name so repeats collapse.
  const bySpecies = new Map<string, Creature[]>()
  for (const creature of extras) {
    const key = (creature.species || creature.commonName || 'unknown').trim().toLowerCase()
    const group = bySpecies.get(key)
    if (group) group.push(creature)
    else bySpecies.set(key, [creature])
  }

  for (const [key, members] of bySpecies) {
    entries.push({
      key,
      commonName: members[0].commonName,
      species: members[0].species,
      count: members.length,
      creature: bestOf(members),
      firstSeenAt: seenAt(members),
    })
  }

  entries.sort((a, b) => {
    if (a.count > 0 !== b.count > 0) return a.count > 0 ? -1 : 1
    if (a.count > 0 && b.count > 0 && a.firstSeenAt !== b.firstSeenAt) {
      return (b.firstSeenAt ?? 0) - (a.firstSeenAt ?? 0)
    }
    return a.commonName.localeCompare(b.commonName)
  })

  return {
    entries,
    discovered: entries.filter((entry) => entry.count > 0).length,
    total: entries.length,
  }
}
