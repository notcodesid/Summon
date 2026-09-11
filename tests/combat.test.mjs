import assert from 'node:assert/strict'
import test from 'node:test'
import { ECOLOGICAL_CLASSES } from '../lib/battle-rules.ts'
import {
  canUseInstinct,
  CLASS_INDEX,
  classBonusPercent,
  damage,
  ECOLOGICAL_ORDER,
  energyAfter,
  guardIncomingPercent,
  hasClassAdvantage,
  INSTINCT_COST,
  MAX_ENERGY,
  MAX_TURNS,
  opponentDamageFor,
  playerDamageFor,
  playerGoesFirst,
  previewTurn,
  scaledDamage,
  traitBonusPercent,
} from '../lib/combat.ts'

const input = (overrides = {}) => ({
  playerAttack: 60,
  playerDefense: 40,
  playerClass: 0,
  playerTrait: 5,
  playerEnergy: 0,
  playerSpeed: 50,
  opponentAttack: 54,
  opponentDefense: 36,
  opponentClass: 5,
  opponentSpeed: 47,
  ...overrides,
})

test('the numeric class order matches the labels the app renders', () => {
  // play_turn.rs passes these as u8s, so this array's index IS the on-chain
  // discriminant. If the two ever disagree, battles resolve as the wrong class.
  assert.deepEqual(ECOLOGICAL_ORDER, ECOLOGICAL_CLASSES)
  ECOLOGICAL_ORDER.forEach((name, index) => assert.equal(CLASS_INDEX[name], index))
})

test('constants mirror constants.rs', () => {
  assert.equal(MAX_ENERGY, 3)
  assert.equal(INSTINCT_COST, 2)
  assert.equal(MAX_TURNS, 8)
})

test('exactly the six Rust pairings carry the class bonus, everything else is even', () => {
  const expected = new Set(['0->4', '1->0', '2->0', '3->1', '4->5', '5->2'])
  const actual = new Set()

  for (let attacker = 0; attacker < 6; attacker += 1) {
    for (let defender = 0; defender < 6; defender += 1) {
      const percent = classBonusPercent(attacker, defender)
      assert.ok(percent === 100 || percent === 120, `unexpected percent ${percent}`)
      if (percent === 120) actual.add(`${attacker}->${defender}`)
    }
  }

  assert.deepEqual([...actual].sort(), [...expected].sort())
})

test('advantage is directional, not symmetric', () => {
  // Sky beats ground, but ground does not beat sky.
  assert.equal(hasClassAdvantage(CLASS_INDEX.sky, CLASS_INDEX.ground), true)
  assert.equal(hasClassAdvantage(CLASS_INDEX.ground, CLASS_INDEX.sky), false)
  // A class has no edge over itself.
  for (const name of ECOLOGICAL_ORDER) {
    assert.equal(hasClassAdvantage(CLASS_INDEX[name], CLASS_INDEX[name]), false)
  }
})

test('damage mirrors combat.rs and never bottoms out at zero', () => {
  // The Rust test asserts damage(1, MAX_DEFENSE) == 1.
  assert.equal(damage(1, 250), 1)
  assert.equal(damage(0, 0), 1)
  assert.ok(damage(100, 100) < damage(100, 0), 'defense must reduce damage')
  assert.equal(scaledDamage(0, 100), 1, 'scaled damage is floored at one')
})

test('trait bonuses land on the actions the Rust rewards', () => {
  // 0 Trailblazer rewards Strike, 1 Keen Senses rewards Instinct,
  // 4 Night Watch rewards a night-class creature.
  assert.equal(traitBonusPercent(0, 'strike', 0), 15)
  assert.equal(traitBonusPercent(0, 'guard', 0), 0)
  assert.equal(traitBonusPercent(1, 'instinct', 0), 15)
  assert.equal(traitBonusPercent(4, 'strike', 3), 15)
  assert.equal(traitBonusPercent(4, 'strike', 0), 0)
  // 3 Bright Spirit and the 5 neutral fallback do nothing on-chain.
  assert.equal(traitBonusPercent(3, 'strike', 3), 0)
  assert.equal(traitBonusPercent(5, 'strike', 3), 0)
})

test('only Gentle Presence sharpens a guard', () => {
  assert.equal(guardIncomingPercent(2), 35)
  for (const trait of [0, 1, 3, 4, 5]) assert.equal(guardIncomingPercent(trait), 50)
})

test('energy follows the program: strike +1, guard +2, instinct -2, capped', () => {
  assert.equal(energyAfter(input({ playerEnergy: 0 }), 'strike'), 1)
  assert.equal(energyAfter(input({ playerEnergy: 2 }), 'guard'), 3)
  assert.equal(energyAfter(input({ playerEnergy: 3 }), 'strike'), 3)
  assert.equal(energyAfter(input({ playerEnergy: 3 }), 'instinct'), 1)
  assert.equal(energyAfter(input({ playerEnergy: 0 }), 'instinct'), 0)
})

test('instinct needs two energy and nothing else does', () => {
  assert.equal(canUseInstinct(input({ playerEnergy: 2 })), true)
  assert.equal(canUseInstinct(input({ playerEnergy: 1 })), false)
})

test('the faster creature moves first, and ties go to the player', () => {
  assert.equal(playerGoesFirst(input({ playerSpeed: 60, opponentSpeed: 40 })), true)
  assert.equal(playerGoesFirst(input({ playerSpeed: 40, opponentSpeed: 60 })), false)
  assert.equal(playerGoesFirst(input({ playerSpeed: 50, opponentSpeed: 50 })), true)
})

test('an instinct hits harder than a strike from the same creature', () => {
  const state = input()
  assert.ok(playerDamageFor(state, 'instinct') > playerDamageFor(state, 'strike'))
  assert.equal(playerDamageFor(state, 'guard'), 0)
})

test('guarding reduces what the opponent deals back', () => {
  const state = input()
  assert.ok(opponentDamageFor(state, true) < opponentDamageFor(state, false))
})

test('the preview resolves in the same order the program does', () => {
  const state = input({ playerSpeed: 60, opponentSpeed: 40, playerEnergy: 0 })
  const preview = previewTurn({ input: state, action: 'strike', playerHp: 100, opponentHp: 100 })

  assert.equal(preview.playerFirst, true)
  assert.ok(preview.damageToOpponent > 0)
  assert.ok(preview.damageToPlayer > 0, 'the slower rival still gets its turn')
  assert.equal(preview.energyAfter, 1)
})

test('a knockout ends the exchange before the slower side can retaliate', () => {
  // The player is fast and the rival is on one hit point: the rival never swings.
  const state = input({ playerSpeed: 99, opponentSpeed: 1 })
  const preview = previewTurn({ input: state, action: 'strike', playerHp: 100, opponentHp: 1 })

  assert.equal(preview.playerFirst, true)
  assert.ok(preview.damageToOpponent > 0)
  assert.equal(preview.damageToPlayer, 0, 'a knocked-out rival does not hit back')
})

test('a slower player knocked out on the rival turn never gets to act', () => {
  const state = input({ playerSpeed: 1, opponentSpeed: 99 })
  const preview = previewTurn({ input: state, action: 'strike', playerHp: 1, opponentHp: 100 })

  assert.equal(preview.playerFirst, false)
  assert.ok(preview.damageToPlayer > 0)
  assert.equal(preview.damageToOpponent, 0, 'the player was down before their move')
})

test('a class advantage is worth exactly twenty percent', () => {
  const neutral = input({ playerClass: CLASS_INDEX.ground, opponentClass: CLASS_INDEX.wild })
  const advantaged = input({ playerClass: CLASS_INDEX.ground, opponentClass: CLASS_INDEX.urban })

  const neutralHit = playerDamageFor(neutral, 'strike')
  const advantagedHit = playerDamageFor(advantaged, 'strike')
  assert.equal(advantagedHit, scaledDamage(damage(neutral.playerAttack, neutral.opponentDefense), 120))
  assert.ok(advantagedHit > neutralHit)
})
