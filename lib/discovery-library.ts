import type { Creature, Rarity } from '@/lib/creatures'

export type CollectionFilter = 'all' | Rarity

const WEEKLY_PROMPTS = [
  'Find an animal with wings.',
  'Look for a small animal close to home.',
  'Spot an animal active near sunset.',
  'Find an animal with a bold pattern.',
  'Look near water for your next discovery.',
  'Photograph an animal you hear before you see.',
] as const

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function uniqueSpeciesCount(creatures: Creature[]): number {
  return new Set(creatures.map((creature) => normalized(creature.species || creature.commonName)).filter(Boolean)).size
}

export function latestDiscovery(creatures: Creature[]): Creature | null {
  return creatures.reduce<Creature | null>(
    (latest, creature) => (!latest || creature.capturedAt > latest.capturedAt ? creature : latest),
    null,
  )
}

export function filterCollection(creatures: Creature[], query: string, filter: CollectionFilter): Creature[] {
  const normalizedQuery = normalized(query)

  return creatures.filter((creature) => {
    if (filter !== 'all' && creature.rarity !== filter) return false
    if (!normalizedQuery) return true

    return [creature.commonName, creature.species, creature.note]
      .map(normalized)
      .some((value) => value.includes(normalizedQuery))
  })
}

export function weeklyDiscoveryPrompt(date: Date = new Date()): string {
  const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))
  return WEEKLY_PROMPTS[Math.abs(week) % WEEKLY_PROMPTS.length]
}
