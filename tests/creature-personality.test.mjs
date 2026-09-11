import assert from 'node:assert/strict'
import test from 'node:test'
import { personalityFor } from '../lib/creature-personality.ts'

test('personality is stable for the same individual', () => {
  const input = { captureId: 'one', species: 'Canis familiaris', captureGrade: 'great' }
  assert.deepEqual(personalityFor(input), personalityFor(input))
})

test('different captures of the same species can become different individuals', () => {
  const first = personalityFor({ captureId: 'one', species: 'Canis familiaris', captureGrade: 'great' })
  const second = personalityFor({ captureId: 'two', species: 'Canis familiaris', captureGrade: 'great' })
  assert.notDeepEqual(first, second)
})

test('capture quality only selects from the matching cosmetic finishes', () => {
  const perfect = personalityFor({ captureId: 'three', species: 'Canis familiaris', captureGrade: 'perfect' })
  assert.ok(['blue hour', 'violet dusk', 'golden light'].includes(perfect.cardVariation))
})
