import assert from 'node:assert/strict'
import test from 'node:test'
import { bondLabel, bondLevelFor, bondProgress, daysForBondLevel, MAX_BOND } from '../lib/bond.ts'

test('everyone starts at level 1 and the first day together levels you up', () => {
  assert.equal(bondLevelFor(0), 1)
  assert.equal(bondLevelFor(1), 2)
  assert.equal(daysForBondLevel(1), 0)
  assert.equal(daysForBondLevel(2), 1)
})

test('the curve is triangular — later levels cost steadily more', () => {
  assert.equal(daysForBondLevel(3), 3)
  assert.equal(daysForBondLevel(4), 6)
  assert.equal(daysForBondLevel(5), 10)
  assert.equal(daysForBondLevel(10), 45)

  let previous = -1
  for (let level = 1; level <= MAX_BOND; level += 1) {
    const days = daysForBondLevel(level)
    assert.ok(days > previous, `level ${level} must cost more than level ${level - 1}`)
    previous = days
  }
})

test('a level is reached on exactly the day it costs, not before', () => {
  for (let level = 2; level <= 12; level += 1) {
    const cost = daysForBondLevel(level)
    assert.equal(bondLevelFor(cost), level, `${cost} days must reach level ${level}`)
    assert.equal(bondLevelFor(cost - 1), level - 1, `${cost - 1} days must not`)
  }
})

test('bond is capped so it can never run away', () => {
  assert.equal(bondLevelFor(100_000), MAX_BOND)
  const progress = bondProgress(100_000)
  assert.equal(progress.level, MAX_BOND)
  assert.equal(progress.progress, 1)
  assert.equal(progress.daysToNextLevel, 0)
  assert.equal(progress.nextLabel, null, 'there is nothing beyond the cap to promise')
})

test('nonsense day counts read as a new companion rather than crashing', () => {
  for (const input of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const progress = bondProgress(input)
    assert.equal(progress.days, 0)
    assert.equal(progress.level, 1)
    assert.equal(progress.label, 'New companion')
  }
})

test('progress through a level stays between zero and one', () => {
  for (let days = 0; days <= 250; days += 1) {
    const progress = bondProgress(days)
    assert.ok(progress.progress >= 0 && progress.progress <= 1, `progress escaped at ${days} days`)
    assert.ok(progress.level >= 1 && progress.level <= MAX_BOND)
    assert.ok(progress.daysIntoLevel >= 0)
  }
})

test('the relationship only ever gets warmer', () => {
  const order = ['New companion', 'Getting familiar', 'Trusted', 'Bonded', 'Constant', 'Inseparable']
  let seen = -1
  for (let level = 1; level <= MAX_BOND; level += 1) {
    const index = order.indexOf(bondLabel(level))
    assert.ok(index >= 0, `level ${level} has no label`)
    assert.ok(index >= seen, `label went backwards at level ${level}`)
    seen = index
  }
})

test('the label describes the level you are on, and the next one is named', () => {
  assert.equal(bondProgress(0).label, 'New companion')
  assert.equal(bondProgress(0).nextLabel, 'Getting familiar')
  assert.equal(bondProgress(10).label, 'Trusted')
  assert.equal(bondProgress(10).daysToNextLevel, 5, 'ten days is level 5, five short of six')
})
