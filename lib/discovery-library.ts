import type { Creature, Rarity } from '@/lib/creatures'

export type CollectionFilter = 'all' | Rarity

export type SpeciesMilestone = {
  current: number
  target: number
  remaining: number
  progress: number
}

const SPECIES_MILESTONES = [3, 5, 10, 25, 50, 100] as const

const WEEKLY_PROMPTS = [
  'Find an animal with wings.',
  'Notice a small animal close to home.',
  'Find an animal with a bold pattern.',
  'Photograph without approaching.',
  'Find wildlife in a familiar place.',
  'Notice an animal by its sound.',
] as const

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function uniqueSpeciesCount(creatures: Creature[]): number {
  return new Set(creatures.map((creature) => normalized(creature.species || creature.commonName)).filter(Boolean)).size
}

export function nextSpeciesMilestone(creatures: Creature[]): SpeciesMilestone {
  const current = uniqueSpeciesCount(creatures)
  const target = SPECIES_MILESTONES.find((milestone) => milestone > current) ?? Math.ceil((current + 1) / 50) * 50

  return {
    current,
    target,
    remaining: target - current,
    progress: current / target,
  }
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
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - daysSinceMonday)

  const calendarDay = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())
  const week = Math.floor(calendarDay / (7 * 24 * 60 * 60 * 1000))
  return WEEKLY_PROMPTS[Math.abs(week) % WEEKLY_PROMPTS.length]
}
