import type { BattleAction, EcologicalClass } from '@/lib/battle-rules'

/**
 * Mirrors programs/summon-battle/src/{combat,instructions/play_turn}.rs so the
 * fight screen can show what a move will actually do before the player commits
 * a transaction to it.
 *
 * Every number here has a counterpart in the Rust. If one changes, the other
 * must change with it — tests/combat.test.mjs pins the shared constants and the
 * six advantaged class pairings so the two cannot drift apart silently.
 */

/** Program discriminant order — the index into this array is the on-chain u8. */
export const ECOLOGICAL_ORDER: EcologicalClass[] = ['ground', 'sky', 'water', 'night', 'urban', 'wild']

export const CLASS_INDEX: Record<EcologicalClass, number> = {
  ground: 0,
  sky: 1,
  water: 2,
  night: 3,
  urban: 4,
  wild: 5,
}

/** constants.rs */
export const MAX_ENERGY = 3
export const INSTINCT_COST = 2
export const MAX_TURNS = 8

/** The `class_bonus` percentage when nothing special applies. */
const NEUTRAL_PERCENT = 100
/** play_turn.rs gives these six attacker→defender pairings a 20% edge. */
const EVEN_PERCENT = 120
const ADVANTAGED_PAIRS: readonly (readonly [number, number])[] = [
  [0, 4],
  [1, 0],
  [2, 0],
  [3, 1],
  [4, 5],
  [5, 2],
]

/** combat.rs damage(). Never returns zero. */
export function damage(attack: number, defense: number): number {
  const value = Math.floor((Math.max(0, attack) * 100) / (100 + Math.max(0, defense)))
  return Math.max(1, value)
}

/** play_turn.rs scaled_damage(). */
export function scaledDamage(base: number, percent: number): number {
  return Math.max(1, Math.floor((Math.max(0, base) * Math.max(0, percent)) / 100))
}

export function classBonusPercent(attackerClass: number, defenderClass: number): number {
  return ADVANTAGED_PAIRS.some(([a, d]) => a === attackerClass && d === defenderClass) ? EVEN_PERCENT : NEUTRAL_PERCENT
}

/** True when this class pairing is one of the six that hit 20% harder. */
export function hasClassAdvantage(attackerClass: number, defenderClass: number): boolean {
  return classBonusPercent(attackerClass, defenderClass) > NEUTRAL_PERCENT
}

/**
 * play_turn.rs trait bonuses. Trait indices follow the passive list in
 * lib/creature-personality.ts; index 5 is the neutral fallback and, like index
 * 3 (Bright Spirit), carries no mechanical effect on-chain.
 */
export function traitBonusPercent(trait: number, action: BattleAction, attackerClass: number): number {
  if (trait === 0 && action === 'strike') return 15
  if (trait === 1 && action === 'instinct') return 15
  if (trait === 4 && attackerClass === 3) return 15
  return 0
}

/** Guarding halves incoming damage — except for Gentle Presence, which cuts it further. */
export function guardIncomingPercent(trait: number): number {
  return trait === 2 ? 35 : 50
}

export type CombatInput = {
  playerAttack: number
  playerDefense: number
  playerClass: number
  playerTrait: number
  playerEnergy: number
  playerSpeed: number
  opponentAttack: number
  opponentDefense: number
  opponentClass: number
  opponentSpeed: number
}

/** Damage this action would deal to the opponent, before their retaliation. */
export function playerDamageFor(input: CombatInput, action: BattleAction): number {
  if (action === 'guard') return 0
  const base = damage(input.playerAttack, input.opponentDefense)
  const percent =
    classBonusPercent(input.playerClass, input.opponentClass) +
    (action === 'instinct' ? 60 : 0) +
    traitBonusPercent(input.playerTrait, action, input.playerClass)
  return scaledDamage(base, percent)
}

/** Damage the opponent deals back this turn. */
export function opponentDamageFor(input: CombatInput, guarded: boolean): number {
  const base = damage(input.opponentAttack, input.playerDefense)
  const classed = scaledDamage(base, classBonusPercent(input.opponentClass, input.playerClass))
  return guarded ? scaledDamage(classed, guardIncomingPercent(input.playerTrait)) : classed
}

export function energyAfter(input: CombatInput, action: BattleAction): number {
  if (action === 'guard') return Math.min(MAX_ENERGY, input.playerEnergy + 2)
  if (action === 'instinct') return Math.max(0, input.playerEnergy - INSTINCT_COST)
  return Math.min(MAX_ENERGY, input.playerEnergy + 1)
}

export function canUseInstinct(input: CombatInput): boolean {
  return input.playerEnergy >= INSTINCT_COST
}

export function playerGoesFirst(input: CombatInput): boolean {
  return input.playerSpeed >= input.opponentSpeed
}

export type TurnPreview = {
  playerFirst: boolean
  /** Damage dealt to the opponent this turn (0 if the player guarded, or was knocked out first). */
  damageToOpponent: number
  /** Damage taken this turn. */
  damageToPlayer: number
  energyAfter: number
}

/**
 * The whole turn, resolved in the same order play_turn.rs resolves it: the
 * faster side acts first, a knockout ends the exchange immediately, and the
 * slower side only retaliates if it is still standing.
 */
export function previewTurn(args: {
  input: CombatInput
  action: BattleAction
  playerHp: number
  opponentHp: number
}): TurnPreview {
  const { input, action } = args
  const guarded = action === 'guard'
  const playerFirst = playerGoesFirst(input)

  let playerHp = Math.max(0, args.playerHp)
  let opponentHp = Math.max(0, args.opponentHp)
  let damageToOpponent = 0
  let damageToPlayer = 0

  const knockedOut = () => playerHp <= 0 || opponentHp <= 0

  if (!playerFirst) {
    damageToPlayer = opponentDamageFor(input, guarded)
    playerHp = Math.max(0, playerHp - damageToPlayer)
  }

  if (!knockedOut()) {
    damageToOpponent = playerDamageFor(input, action)
    opponentHp = Math.max(0, opponentHp - damageToOpponent)
  }

  if (playerFirst && !knockedOut()) {
    damageToPlayer = opponentDamageFor(input, guarded)
    playerHp = Math.max(0, playerHp - damageToPlayer)
  }

  return {
    playerFirst,
    damageToOpponent,
    damageToPlayer,
    energyAfter: energyAfter(input, action),
  }
}
