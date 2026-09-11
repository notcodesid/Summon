import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterCollection,
  latestDiscovery,
  nextSpeciesMilestone,
  uniqueSpeciesCount,
  weeklyDiscoveryPrompt,
} from '../lib/discovery-library.ts'

function creature(overrides = {}) {
  return {
    id: '1',
    species: 'Canis familiaris',
    commonName: 'Milo',
    rarity: 'common',
    stats: { hp: 1, attack: 1, defense: 1, speed: 1 },
    note: 'A friendly neighborhood dog.',
    photoUri: 'file:///dog.jpg',
    capturedAt: 1,
    ...overrides,
  }
}

test('counts species without treating duplicate captures as unique species', () => {
  assert.equal(
    uniqueSpeciesCount([
      creature({ id: '1', commonName: 'Milo' }),
      creature({ id: '2', commonName: 'Pepper' }),
      creature({ id: '3', species: 'Felis catus', commonName: 'Luna' }),
    ]),
    2,
  )
})

test('returns the newest discovery regardless of array order', () => {
  const newest = creature({ id: 'new', capturedAt: 30 })
  assert.equal(
    latestDiscovery([creature({ id: 'old', capturedAt: 10 }), newest, creature({ id: 'middle', capturedAt: 20 })])?.id,
    'new',
  )
})

test('advances species milestones without counting duplicate captures', () => {
  const milestone = nextSpeciesMilestone([
    creature({ id: 'dog-1', commonName: 'Milo' }),
    creature({ id: 'dog-2', commonName: 'Pepper' }),
    creature({ id: 'cat', species: 'Felis catus', commonName: 'Luna' }),
  ])

  assert.deepEqual(milestone, {
    current: 2,
    target: 3,
    remaining: 1,
    progress: 2 / 3,
  })
})

test('moves to the next milestone after a target is reached', () => {
  const milestone = nextSpeciesMilestone([
    creature({ id: 'dog' }),
    creature({ id: 'cat', species: 'Felis catus' }),
    creature({ id: 'fox', species: 'Vulpes vulpes' }),
  ])

  assert.equal(milestone.target, 5)
  assert.equal(milestone.remaining, 2)
})

test('searches custom names, species, and notes while applying rarity filters', () => {
  const creatures = [
    creature({ id: 'dog', commonName: 'Dog', nickname: 'Milo', rarity: 'common' }),
    creature({ id: 'dog-2', commonName: 'Pepper', rarity: 'common' }),
    creature({
      id: 'fox',
      species: 'Vulpes vulpes',
      commonName: 'Ember',
      rarity: 'rare',
      note: 'Seen near the woodland edge.',
    }),
  ]

  assert.deepEqual(
    filterCollection(creatures, 'milo', 'all').map((item) => item.id),
    ['dog'],
  )
  assert.deepEqual(
    filterCollection(creatures, 'ember', 'all').map((item) => item.id),
    ['fox'],
  )
  assert.deepEqual(
    filterCollection(creatures, 'woodland', 'rare').map((item) => item.id),
    ['fox'],
  )
  assert.deepEqual(
    filterCollection(creatures, '', 'common').map((item) => item.id),
    ['dog', 'dog-2'],
  )
})

test('weekly prompts follow Monday-to-Sunday calendar weeks', () => {
  const monday = weeklyDiscoveryPrompt(new Date(2026, 7, 10, 12))
  const sunday = weeklyDiscoveryPrompt(new Date(2026, 7, 16, 12))
  const nextMonday = weeklyDiscoveryPrompt(new Date(2026, 7, 17, 12))

  assert.equal(monday, sunday)
  assert.notEqual(monday, nextMonday)
})
