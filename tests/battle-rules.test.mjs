import assert from 'node:assert/strict'
import test from 'node:test'
import { actionDescription, ecologicalClassFor, instinctNameFor, passiveTraitIndex } from '../lib/battle-rules.ts'

function creature(overrides = {}) {
  return {
    id: 'one',
    species: 'Tyto alba',
    commonName: 'Barn Owl',
    rarity: 'rare',
    stats: { hp: 60, attack: 50, defense: 40, speed: 80 },
    note: '',
    photoUri: '',
    capturedAt: 1,
    ...overrides,
  }
}

test('ecological classes are game labels derived from affinity or species', () => {
  assert.equal(ecologicalClassFor(creature()), 'sky')
  assert.equal(ecologicalClassFor(creature({ personality: { habitatAffinity: 'night' } })), 'night')
})

test('instinct names and energy costs are understandable', () => {
  const owl = creature()
  assert.equal(instinctNameFor(owl), 'Gale Dive')
  assert.match(actionDescription('instinct', owl), /costs 2 energy/)
})

test('creatures without personality data use a neutral battle trait', () => {
  assert.equal(passiveTraitIndex(creature), 5)
})
