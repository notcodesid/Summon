import assert from 'node:assert/strict'
import test from 'node:test'
import { powerOf, statsFor } from '../lib/creatures.ts'

test('calculates deterministic stats and total combat power across rarity tiers', () => {
  const foxCommon = statsFor('Vulpes vulpes', 'common')
  const foxLegendary = statsFor('Vulpes vulpes', 'legendary')

  assert.equal(typeof foxCommon.hp, 'number')
  assert.equal(typeof foxCommon.attack, 'number')
  assert.equal(typeof foxCommon.defense, 'number')
  assert.equal(typeof foxCommon.speed, 'number')

  const commonPower = powerOf(foxCommon)
  const legendaryPower = powerOf(foxLegendary)

  // Legendary tier gets +50 power boost per stat attribute (total +200 power)
  assert.equal(legendaryPower > commonPower, true)
  assert.equal(legendaryPower - commonPower, 200)
})

test('maintains identical stats for same species regardless of casing and whitespace', () => {
  const first = statsFor('Canis lupus', 'rare')
  const second = statsFor('  CANIS LUPUS  ', 'rare')

  assert.deepEqual(first, second)
})
