import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterCollection,
  latestDiscovery,
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

test('searches custom names, species, and notes while applying rarity filters', () => {
  const creatures = [
    creature({ id: 'dog', commonName: 'Milo', rarity: 'common' }),
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

test('weekly prompts stay stable within the same seven-day window', () => {
  const first = weeklyDiscoveryPrompt(new Date('2026-08-09T00:00:00.000Z'))
  const second = weeklyDiscoveryPrompt(new Date('2026-08-10T00:00:00.000Z'))
  assert.equal(first, second)
})
