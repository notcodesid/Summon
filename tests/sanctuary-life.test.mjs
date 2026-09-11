import assert from 'node:assert/strict'
import test from 'node:test'
import { daysTogether, interactionMessage, sanctuaryBehavior } from '../lib/sanctuary-life.ts'

const creature = {
  id: 'catch-one',
  species: 'Canis familiaris',
  commonName: 'Dog',
  nickname: 'Milo',
  personality: { temperament: 'playful' },
}

test('creatures sleep during late-night sanctuary hours', () => {
  const behavior = sanctuaryBehavior(creature, new Date(2026, 8, 11, 23, 0))
  assert.deepEqual(behavior, { activity: 'sleeping', mood: 'sleepy' })
})

test('tap reactions use the nickname and safe game temperament', () => {
  assert.equal(interactionMessage(creature), 'Milo bounds around happily.')
})

test('days together counts distinct days, not taps', () => {
  const life = {
    interactionDays: {
      '2026-9-11': ['catch-one', 'catch-two'],
      '2026-9-12': ['catch-one'],
      '2026-9-13': ['catch-two'],
    },
  }
  assert.equal(daysTogether(life, 'catch-one'), 2)
  assert.equal(daysTogether(life, 'catch-two'), 2)
  assert.equal(daysTogether(life, 'never-met'), 0)
  assert.equal(daysTogether({ interactionDays: {} }, 'catch-one'), 0)
})
