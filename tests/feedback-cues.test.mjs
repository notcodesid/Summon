import assert from 'node:assert/strict'
import test from 'node:test'
import { battleActionFeedback, battleResultFeedback, revealSoundFor } from '../lib/feedback-cues.ts'

test('every reveal rarity dispatches its matching sound', () => {
  for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
    assert.equal(revealSoundFor(rarity), `reveal-${rarity}`)
  }
})

test('battle actions keep sound and haptic weight synchronized', () => {
  assert.deepEqual(battleActionFeedback('strike'), { sound: 'hit', haptic: 'medium' })
  assert.deepEqual(battleActionFeedback('guard'), { sound: 'guard', haptic: 'medium' })
  assert.deepEqual(battleActionFeedback('instinct'), { sound: 'instinct', haptic: 'heavy' })
})

test('battle results distinguish victory from defeat without extra cues', () => {
  assert.deepEqual(battleResultFeedback('player'), { sound: 'victory', haptic: 'success' })
  assert.deepEqual(battleResultFeedback('opponent'), { sound: 'defeat', haptic: 'warning' })
  assert.deepEqual(battleResultFeedback('none'), { sound: 'defeat', haptic: 'warning' })
})
