import type { Creature } from '@/lib/creatures'

/** A slightly weaker wild rival so the first canned match is winnable, not free. */
export function cannedOpponentFor(creature: Creature): {
  name: string
  hp: number
  attack: number
  defense: number
} {
  return {
    name: 'Wild Rival',
    hp: creature.stats.hp,
    attack: Math.max(1, creature.stats.attack - 6),
    defense: Math.max(0, creature.stats.defense - 4),
  }
}
