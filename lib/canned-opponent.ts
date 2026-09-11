import type { ImageSourcePropType } from 'react-native'
import { ANIMAL_PHOTOS } from '@/lib/animal-images'
import { ecologicalClassFor, type EcologicalClass } from '@/lib/battle-rules'
import { CLASS_INDEX, hasClassAdvantage } from '@/lib/combat'
import type { Creature } from '@/lib/creatures'

/**
 * The wild rival you meet in a match.
 *
 * It is a real species with a real photo, picked deterministically from your
 * companion's catch id — so a given creature always meets the same rival, and
 * the encounter reads as a specific animal rather than a placeholder. Its
 * ecological class is the same thing your own creature has, which means the
 * class table in play_turn.rs applies between you: the matchup shown on the
 * fight screen is mechanical, not decoration.
 *
 * Stats stay a touch below yours so the first match is winnable without being
 * free.
 */

export type Matchup = 'advantage' | 'even' | 'disadvantage'

export type Rival = {
  species: string
  commonName: string
  image: ImageSourcePropType
  /** Programme discriminant, from combat.ts CLASS_INDEX. */
  ecologicalClass: number
  className: EcologicalClass
  /** A field-note line, so the encounter has a voice. */
  note: string
  hp: number
  attack: number
  defense: number
  speed: number
}

const CLASS_NOTES: Record<EcologicalClass, string> = {
  ground: 'Rooted and heavy. It will not give up the ground it knows.',
  sky: 'Quick and difficult to pin down.',
  water: 'At home in the shallows, awkward anywhere else.',
  night: 'Comes alive when the light goes.',
  urban: 'Streetwise. Reads you before you move.',
  wild: 'Fully wild — no fear of you at all.',
}

/** djb2, matching lib/creatures.ts, so the pick is stable across devices. */
function hash(input: string): number {
  let value = 5381
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) + value + input.charCodeAt(index)) >>> 0
  }
  return value
}

export function matchupFor(playerClass: number, rivalClass: number): Matchup {
  if (hasClassAdvantage(playerClass, rivalClass)) return 'advantage'
  if (hasClassAdvantage(rivalClass, playerClass)) return 'disadvantage'
  return 'even'
}

export function cannedOpponentFor(creature: Creature): Rival {
  // Never meet the same species you brought — a fox fighting a fox reads as a
  // bug, not an encounter.
  const speciesKey = (creature.species || creature.commonName).toLowerCase().trim()
  const candidates = ANIMAL_PHOTOS.filter((photo) => photo.species.toLowerCase() !== speciesKey)
  const pool = candidates.length > 0 ? candidates : ANIMAL_PHOTOS
  const picked = pool[hash(creature.id) % pool.length]

  return {
    species: picked.species,
    commonName: picked.commonName,
    image: picked.image,
    ecologicalClass: CLASS_INDEX[picked.ecologicalClass],
    className: picked.ecologicalClass,
    note: CLASS_NOTES[picked.ecologicalClass],
    hp: creature.stats.hp,
    attack: Math.max(1, creature.stats.attack - 6),
    defense: Math.max(0, creature.stats.defense - 4),
    speed: Math.max(1, creature.stats.speed - 3),
  }
}

/** The matchup from the player's side, for the fight screen's read. */
export function matchupAgainst(creature: Creature, rival: Rival): Matchup {
  return matchupFor(CLASS_INDEX[ecologicalClassFor(creature)], rival.ecologicalClass)
}
