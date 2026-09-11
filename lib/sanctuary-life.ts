import type { Creature } from '@/lib/creatures'

export type SanctuaryActivity = 'sleeping' | 'wandering' | 'playing' | 'visiting'
export type SanctuaryMood = 'sleepy' | 'content' | 'excited' | 'curious'

function hash(input: string): number {
  let value = 5381
  for (let index = 0; index < input.length; index += 1) value = ((value << 5) + value + input.charCodeAt(index)) >>> 0
  return value
}

export function localDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function sanctuaryBehavior(
  creature: Creature,
  date: Date = new Date(),
): {
  activity: SanctuaryActivity
  mood: SanctuaryMood
} {
  const hour = date.getHours()
  if (hour >= 22 || hour < 6) return { activity: 'sleeping', mood: 'sleepy' }

  const seed = hash(`${creature.id}:${localDayKey(date)}:${Math.floor(hour / 3)}`)
  const temperament = creature.personality?.temperament
  if (temperament === 'playful' && seed % 3 === 0) return { activity: 'playing', mood: 'excited' }
  if (temperament === 'curious' || seed % 4 === 0) return { activity: 'visiting', mood: 'curious' }
  return { activity: 'wandering', mood: 'content' }
}

/** How many distinct days you have stopped to spend a moment with this creature. */
export function daysTogether(life: { interactionDays: Record<string, string[]> }, creatureId: string): number {
  return Object.values(life.interactionDays).filter((ids) => ids.includes(creatureId)).length
}

export function interactionMessage(creature: Creature): string {
  const name = creature.nickname || creature.commonName
  switch (creature.personality?.temperament) {
    case 'brave':
      return `${name} stands proudly beside you.`
    case 'curious':
      return `${name} leans closer to investigate.`
    case 'playful':
      return `${name} bounds around happily.`
    default:
      return `${name} settles peacefully beside you.`
  }
}
