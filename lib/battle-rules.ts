import type { Creature } from '@/lib/creatures'

export type BattleAction = 'strike' | 'guard' | 'instinct'
export type EcologicalClass = 'ground' | 'sky' | 'water' | 'night' | 'urban' | 'wild'

export const ECOLOGICAL_CLASSES: EcologicalClass[] = ['ground', 'sky', 'water', 'night', 'urban', 'wild']

export function ecologicalClassFor(creature: Creature): EcologicalClass {
  const affinity = creature.personality?.habitatAffinity
  if (affinity === 'water') return 'water'
  if (affinity === 'night') return 'night'
  if (affinity === 'neighborhood') return 'urban'
  if (affinity === 'woodland') return 'wild'
  const name = `${creature.commonName} ${creature.species}`.toLowerCase()
  if (/bird|owl|hawk|eagle|pigeon|crow|bat/.test(name)) return 'sky'
  return 'ground'
}

export function passiveTraitIndex(creature: Creature): number {
  const index = ['Trailblazer', 'Keen Senses', 'Gentle Presence', 'Bright Spirit', 'Night Watch'].indexOf(
    creature.personality?.passiveTrait ?? '',
  )
  return index < 0 ? 5 : index
}

export function instinctNameFor(creature: Creature): string {
  const names: Record<EcologicalClass, string> = {
    ground: 'Root Rush',
    sky: 'Gale Dive',
    water: 'Tidal Sweep',
    night: 'Moonstep',
    urban: 'Streetwise',
    wild: 'Wildcall',
  }
  return names[ecologicalClassFor(creature)]
}

export function actionDescription(action: BattleAction, creature: Creature): string {
  if (action === 'strike') return 'Reliable damage · builds 1 energy'
  if (action === 'guard') return 'Reduce damage · builds 2 energy'
  return `${instinctNameFor(creature)} · costs 2 energy`
}
