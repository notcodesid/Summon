import type { Creature } from '@/lib/creatures'

export type ExpeditionMission = {
  key: 'daily-discovery' | 'daily-variety' | 'daily-wings'
  title: string
  prompt: string
  current: number
  target: number
  rewardXp: number
}

export type Habitat = {
  key: 'park' | 'water' | 'neighborhood' | 'woodland' | 'night'
  label: string
  icon: 'leaf' | 'water' | 'home' | 'trail-sign' | 'moon'
  hint: string
}

export const HABITATS: Habitat[] = [
  { key: 'park', label: 'Park', icon: 'leaf', hint: 'birds · squirrels · dogs' },
  { key: 'water', label: 'Water', icon: 'water', hint: 'fish · ducks · insects' },
  { key: 'neighborhood', label: 'Nearby', icon: 'home', hint: 'cats · dogs · urban wildlife' },
  { key: 'woodland', label: 'Woodland', icon: 'trail-sign', hint: 'deer · rabbits · birds' },
  { key: 'night', label: 'After dark', icon: 'moon', hint: 'moths · owls · nocturnal life' },
]

/**
 * A stable key for the local calendar day. One key per day, never a timestamp,
 * so "today" means the same thing to the mission, the streak and the
 * expedition log.
 *
 * Months are 1-indexed to match `localDayKey` in lib/sanctuary-life.ts. The two
 * are deliberately identical now: they key different stores today, but a
 * mix-up used to produce silently different days, and merging them into one
 * shared module is blocked by the test runner's module resolution.
 */
export function discoveryDayKey(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function todaysCreatures(creatures: Creature[], now: Date): Creature[] {
  const today = discoveryDayKey(now)
  return creatures.filter((creature) => discoveryDayKey(creature.capturedAt) === today)
}

function speciesKey(creature: Creature): string {
  return (creature.species || creature.commonName).trim().toLocaleLowerCase()
}

function hasWings(creature: Creature): boolean {
  return /bird|owl|eagle|hawk|pigeon|sparrow|crow|raven|duck|goose|swan|parrot|moth|butterfly|bee|fly|bat/i.test(
    `${creature.species} ${creature.commonName}`,
  )
}

export function dailyMission(creatures: Creature[], now: Date = new Date()): ExpeditionMission {
  const today = todaysCreatures(creatures, now)
  const variant =
    Math.abs(Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000)) % 3

  if (variant === 1) {
    const count = new Set(today.map(speciesKey).filter(Boolean)).size
    return {
      key: 'daily-variety',
      title: 'Different neighbors',
      prompt: 'Discover two different species today.',
      current: Math.min(count, 2),
      target: 2,
      rewardXp: 150,
    }
  }

  if (variant === 2) {
    return {
      key: 'daily-wings',
      title: 'Look to the sky',
      prompt: 'Find a real animal with wings.',
      current: today.some(hasWings) ? 1 : 0,
      target: 1,
      rewardXp: 100,
    }
  }

  return {
    key: 'daily-discovery',
    title: 'Step outside',
    prompt: 'Make one real animal discovery today.',
    current: Math.min(today.length, 1),
    target: 1,
    rewardXp: 75,
  }
}

export function discoveryStreak(creatures: Creature[], now: Date = new Date()): number {
  const days = new Set(creatures.map((creature) => discoveryDayKey(creature.capturedAt)))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let streak = 0
  while (days.has(discoveryDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * Today's mission, but only once it is finished — null while there is still
 * something to find. This is the decision the award hangs off, kept here so
 * it can be reasoned about (and tested) without any storage in the way.
 */
export function finishedMission(creatures: Creature[], now: Date = new Date()): ExpeditionMission | null {
  const mission = dailyMission(creatures, now)
  return mission.current >= mission.target ? mission : null
}

export function suggestedHabitat(now: Date = new Date()): Habitat['key'] {
  const hour = now.getHours()
  if (hour >= 19 || hour < 5) return 'night'
  if (hour < 9) return 'park'
  if (hour >= 16) return 'neighborhood'
  return 'woodland'
}
