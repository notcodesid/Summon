import type { CaptureGrade } from '@/lib/creatures'

export type Temperament = 'brave' | 'curious' | 'calm' | 'playful'
export type SizeVariation = 'compact' | 'balanced' | 'grand'
export type HabitatAffinity = 'park' | 'water' | 'neighborhood' | 'woodland' | 'night'
export type PassiveTrait = 'Trailblazer' | 'Keen Senses' | 'Gentle Presence' | 'Bright Spirit' | 'Night Watch'
export type CardVariation = 'field notes' | 'silver leaf' | 'blue hour' | 'violet dusk' | 'golden light'

export type CreaturePersonality = {
  temperament: Temperament
  sizeVariation: SizeVariation
  passiveTrait: PassiveTrait
  habitatAffinity: HabitatAffinity
  cardVariation: CardVariation
}

function hash(input: string): number {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function pick<T>(values: readonly T[], seed: number, shift: number): T {
  return values[(seed >>> shift) % values.length]
}

const TEMPERAMENTS = ['brave', 'curious', 'calm', 'playful'] as const
const SIZES = ['compact', 'balanced', 'grand'] as const
const PASSIVES = ['Trailblazer', 'Keen Senses', 'Gentle Presence', 'Bright Spirit', 'Night Watch'] as const
const HABITATS = ['park', 'water', 'neighborhood', 'woodland', 'night'] as const
const CARD_VARIATIONS = ['field notes', 'silver leaf', 'blue hour', 'violet dusk', 'golden light'] as const

const CARD_BY_QUALITY: Record<CaptureGrade, readonly CardVariation[]> = {
  good: ['field notes', 'silver leaf'],
  great: ['silver leaf', 'blue hour', 'violet dusk'],
  perfect: ['blue hour', 'violet dusk', 'golden light'],
}

/**
 * Produces game personality, not a claim about the photographed animal's
 * real behavior, health, age, or aggression. A capture id makes individuals
 * of the same species vary while remaining stable across devices.
 */
export function personalityFor(args: {
  captureId: string
  species: string
  captureGrade?: CaptureGrade
}): CreaturePersonality {
  const seed = hash(`${args.captureId}:${args.species.toLowerCase().trim()}`)
  const cardOptions = CARD_BY_QUALITY[args.captureGrade ?? 'good']

  return {
    temperament: pick(TEMPERAMENTS, seed, 0),
    sizeVariation: pick(SIZES, seed, 5),
    passiveTrait: pick(PASSIVES, seed, 9),
    habitatAffinity: pick(HABITATS, seed, 13),
    cardVariation: pick(cardOptions, seed, 17),
  }
}

export function parseCreaturePersonality(value: unknown): CreaturePersonality | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<CreaturePersonality>
  if (!TEMPERAMENTS.includes(candidate.temperament as Temperament)) return undefined
  if (!SIZES.includes(candidate.sizeVariation as SizeVariation)) return undefined
  if (!PASSIVES.includes(candidate.passiveTrait as PassiveTrait)) return undefined
  if (!HABITATS.includes(candidate.habitatAffinity as HabitatAffinity)) return undefined
  if (!CARD_VARIATIONS.includes(candidate.cardVariation as CardVariation)) return undefined
  return candidate as CreaturePersonality
}
