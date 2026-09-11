import assert from 'node:assert/strict'
import test from 'node:test'
import { RARITY_ORDER } from '../lib/creatures.ts'
import { buildFieldGuide, matchesRoster } from '../lib/field-guide.ts'

/** A stand-in for the real roster — the tests must not pull in bundled images. */
const ROSTER = [
  { commonName: 'Red Fox', species: 'Vulpes vulpes', aliases: ['fox', 'vixen', 'vulpes'] },
  { commonName: 'Barn Owl', species: 'Tyto alba', aliases: ['owl', 'tyto'] },
  { commonName: 'Grey Squirrel', species: 'Sciurus carolinensis', aliases: ['squirrel', 'sciurus'] },
  { commonName: 'Cattle', species: 'Bos taurus', aliases: ['cow', 'bull', 'cattle', 'calf', 'bos'] },
]

const creature = (overrides = {}) => ({
  id: 'catch',
  species: 'Vulpes vulpes',
  commonName: 'Red Fox',
  rarity: 'rare',
  stats: { hp: 60, attack: 50, defense: 40, speed: 80 },
  note: '',
  photoUri: '',
  capturedAt: 1000,
  ...overrides,
})

test('an empty collection leaves the whole roster undiscovered', () => {
  const guide = buildFieldGuide([], ROSTER)
  assert.equal(guide.total, 4)
  assert.equal(guide.discovered, 0)
  for (const entry of guide.entries) {
    assert.equal(entry.count, 0)
    assert.equal(entry.creature, null)
    assert.equal(entry.firstSeenAt, null)
  }
})

test('the rarity ranking matches RARITY_ORDER', () => {
  // buildFieldGuide cannot import creatures.ts at runtime, so the rank table is
  // a copy. Checking every pair is the only thing keeping the copy honest.
  for (const left of RARITY_ORDER) {
    for (const right of RARITY_ORDER) {
      const guide = buildFieldGuide(
        [creature({ id: 'a', rarity: left, capturedAt: 1 }), creature({ id: 'b', rarity: right, capturedAt: 2 })],
        [],
      )
      const winner = guide.entries[0].creature.rarity
      const expectedRank = Math.max(RARITY_ORDER.indexOf(left), RARITY_ORDER.indexOf(right))
      assert.equal(winner, RARITY_ORDER[expectedRank], `${left} versus ${right}`)
    }
  }
})

test('the model can name a species and the guide still recognises it', () => {
  // Exact binomial.
  assert.equal(matchesRoster(creature(), ROSTER[0]), true)
  // Common name only, as the model often returns it.
  assert.equal(matchesRoster(creature({ species: '', commonName: 'Red Fox' }), ROSTER[0]), true)
  // A differently phrased common name — the alias catches it.
  assert.equal(matchesRoster(creature({ species: '', commonName: 'Eastern Gray Squirrel' }), ROSTER[2]), true)
  // Genus alone is enough.
  assert.equal(matchesRoster(creature({ species: 'Sciurus vulgaris', commonName: 'Squirrel' }), ROSTER[2]), true)
})

test('a shared generic word is not enough to claim a sighting', () => {
  // "Red Squirrel" must not fill in the Red Fox entry just because both are red.
  const redSquirrel = creature({ species: 'Sciurus vulgaris', commonName: 'Red Squirrel' })
  assert.equal(matchesRoster(redSquirrel, ROSTER[0]), false)
  // And an entirely unrelated animal matches nothing.
  assert.equal(matchesRoster(creature({ species: 'Apis mellifera', commonName: 'Honey Bee' }), ROSTER[0]), false)
})

test('a species is only claimed by the first roster entry that fits', () => {
  const guide = buildFieldGuide([creature()], ROSTER)
  const fox = guide.entries.find((entry) => entry.commonName === 'Red Fox')
  assert.equal(fox.count, 1)
  assert.equal(guide.discovered, 1)
  // Nobody else picked it up.
  assert.equal(guide.entries.filter((entry) => entry.count > 0).length, 1)
})

test('repeats of one species collapse into a single entry', () => {
  const guide = buildFieldGuide(
    [
      creature({ id: 'a', capturedAt: 500 }),
      creature({ id: 'b', capturedAt: 900 }),
      creature({ id: 'c', capturedAt: 700 }),
    ],
    ROSTER,
  )
  const fox = guide.entries.find((entry) => entry.commonName === 'Red Fox')
  assert.equal(fox.count, 3)
  assert.equal(fox.firstSeenAt, 500, 'first seen is the earliest, not the newest')
  assert.equal(guide.discovered, 1, 'three individuals is still one species')
})

test('the entry shows the rarest individual, then the most recent', () => {
  const guide = buildFieldGuide(
    [
      creature({ id: 'common-one', rarity: 'common', capturedAt: 900 }),
      creature({ id: 'rare-one', rarity: 'rare', capturedAt: 100 }),
      creature({ id: 'rare-two', rarity: 'rare', capturedAt: 800 }),
    ],
    ROSTER,
  )
  const fox = guide.entries.find((entry) => entry.commonName === 'Red Fox')
  assert.equal(fox.creature.id, 'rare-two', 'rarer beats newer, and ties go to the newer')
})

test('a real sighting is never hidden just because the roster has no artwork', () => {
  const guide = buildFieldGuide(
    [creature(), creature({ id: 'bee', species: 'Apis mellifera', commonName: 'Honey Bee' })],
    ROSTER,
  )
  assert.equal(guide.discovered, 2)
  assert.equal(guide.total, 5, 'the roster plus the one species it did not know about')
  const bee = guide.entries.find((entry) => entry.commonName === 'Honey Bee')
  assert.equal(bee.count, 1)
  assert.equal(bee.creature.id, 'bee')
})

test('discovered species are listed ahead of undiscovered ones', () => {
  const guide = buildFieldGuide([creature({ species: 'Bos taurus', commonName: 'Cow' })], ROSTER)
  assert.equal(guide.entries[0].commonName, 'Cattle')
  for (let index = 1; index < guide.entries.length; index += 1) {
    assert.equal(guide.entries[index].count, 0, 'nothing undiscovered may appear above a sighting')
  }
})

test('an unidentifiable catch is grouped rather than dropped', () => {
  const guide = buildFieldGuide([creature({ id: 'x', species: '', commonName: '' })], ROSTER)
  assert.equal(guide.discovered, 1)
  assert.equal(guide.entries[0].count, 1)
})
