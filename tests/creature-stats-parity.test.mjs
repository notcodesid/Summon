import assert from 'node:assert/strict'
import test from 'node:test'
import { statsFor as clientStatsFor, RARITY_ORDER } from '../lib/creatures.ts'
import { statsFor as serverStatsFor, isRarity, normalizeSpecies } from '../supabase/functions/_shared/creature-stats.ts'

/**
 * The client renders stats; the server recomputes and stores them. They are two
 * copies of one algorithm sitting on opposite sides of a trust boundary, so the
 * only thing keeping them honest is this test.
 */

const SPECIES = [
  'Vulpes vulpes',
  'Tyto alba',
  'Canis familiaris',
  'Felis catus',
  'Oryctolagus cuniculus',
  'Sciurus carolinensis',
  'Capreolus capreolus',
  'Bos taurus',
  'Ovis aries',
  'Equus caballus',
  'Corvus corone',
  'Apis mellifera',
  '  Padded name  ',
  'UPPERCASE NAME',
  'ünïcödé species',
  'a',
  '',
]

test('the server derives exactly the stats the app renders', () => {
  for (const species of SPECIES) {
    for (const rarity of RARITY_ORDER) {
      assert.deepEqual(
        serverStatsFor(species, rarity),
        clientStatsFor(species, rarity),
        `stats diverged for ${JSON.stringify(species)} / ${rarity}`,
      )
    }
  }
})

test('rarity values the app can produce are the ones the server accepts', () => {
  for (const rarity of RARITY_ORDER) assert.equal(isRarity(rarity), true)
  for (const bad of ['mythic', 'COMMON', '', null, undefined, 1, {}]) {
    assert.equal(isRarity(bad), false, `${JSON.stringify(bad)} must be rejected`)
  }
})

test('species comparison ignores case and padding on both sides', () => {
  assert.equal(normalizeSpecies('  Vulpes vulpes '), normalizeSpecies('VULPES VULPES'))
  assert.equal(normalizeSpecies(undefined), '')
  assert.equal(normalizeSpecies(42), '')
})

test('stats stay inside the bounds the program will accept', () => {
  // create_battle validates hp 1..=500, attack 1..=250, defense/speed <= 250.
  // A species name hashed to the top of every spread must still fit.
  for (const species of SPECIES) {
    for (const rarity of RARITY_ORDER) {
      const stats = serverStatsFor(species, rarity)
      assert.ok(stats.hp > 0 && stats.hp <= 500, `hp ${stats.hp} out of range`)
      assert.ok(stats.attack > 0 && stats.attack <= 250, `attack ${stats.attack} out of range`)
      assert.ok(stats.defense >= 0 && stats.defense <= 250, `defense ${stats.defense} out of range`)
      assert.ok(stats.speed >= 0 && stats.speed <= 250, `speed ${stats.speed} out of range`)
    }
  }
})

test('the same species always yields the same creature', () => {
  const first = clientStatsFor('Vulpes vulpes', 'rare')
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(clientStatsFor('Vulpes vulpes', 'rare'), first)
  }
  // Casing and whitespace are part of the same identity.
  assert.deepEqual(clientStatsFor('  vulpes VULPES  ', 'rare'), clientStatsFor('vulpes vulpes', 'rare'))
})
