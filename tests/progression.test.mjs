import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureXpFor,
  explorerProgress,
  MAX_LEVEL,
  nextUnlock,
  unlockedAt,
  unlockedDecorations,
  unlocksBetween,
  xpToReachLevel,
} from '../lib/progression.ts'

const creature = (overrides = {}) => ({
  id: 'catch',
  species: 'Vulpes vulpes',
  commonName: 'Red Fox',
  rarity: 'rare',
  stats: { hp: 60, attack: 50, defense: 40, speed: 80 },
  note: '',
  photoUri: '',
  capturedAt: 1,
  ...overrides,
})

test('the level curve is monotonic and starts free', () => {
  assert.equal(xpToReachLevel(1), 0)
  assert.equal(xpToReachLevel(2), 100)
  assert.equal(xpToReachLevel(3), 300)
  assert.equal(xpToReachLevel(4), 600)
  assert.equal(xpToReachLevel(5), 1000)

  for (let level = 1; level < 40; level += 1) {
    assert.ok(
      xpToReachLevel(level + 1) > xpToReachLevel(level),
      `level ${level + 1} must cost more than level ${level}`,
    )
  }
})

test('each level spans exactly 100 XP more than the last', () => {
  for (let level = 2; level < 20; level += 1) {
    const span = xpToReachLevel(level) - xpToReachLevel(level - 1)
    assert.equal(span, 100 * (level - 1))
  }
})

test('a fresh explorer starts at level 1 with nothing earned', () => {
  const progress = explorerProgress(0)
  assert.equal(progress.level, 1)
  assert.equal(progress.xpIntoLevel, 0)
  assert.equal(progress.xpForLevel, 100)
  assert.equal(progress.progress, 0)
  assert.equal(progress.xpToNextLevel, 100)
})

test('exactly enough XP reaches the level, one less does not', () => {
  assert.equal(explorerProgress(99).level, 1)
  assert.equal(explorerProgress(100).level, 2)
  assert.equal(explorerProgress(299).level, 2)
  assert.equal(explorerProgress(300).level, 3)
  assert.equal(explorerProgress(1000).level, 5)
})

test('progress through a level is a fraction of that level and never exceeds it', () => {
  // Level 2 spans 100..300, so 250 XP sits three quarters of the way through it.
  const progress = explorerProgress(250)
  assert.equal(progress.level, 2)
  assert.equal(progress.xpIntoLevel, 150)
  assert.equal(progress.xpForLevel, 200)
  assert.equal(progress.progress, 0.75)
  assert.equal(progress.xpToNextLevel, 50)

  for (const xp of [0, 1, 137, 999, 10_000, 500_000]) {
    const p = explorerProgress(xp)
    assert.ok(p.progress >= 0 && p.progress <= 1, `progress out of range at ${xp} XP`)
  }
})

test('the level is capped so the curve cannot run away', () => {
  const progress = explorerProgress(50_000_000)
  assert.equal(progress.level, MAX_LEVEL)
  assert.equal(progress.xpToNextLevel, 0)
})

test('nonsense XP is treated as zero rather than crashing the profile', () => {
  for (const input of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const progress = explorerProgress(input)
    assert.equal(progress.level, 1)
    assert.equal(progress.totalXp, 0)
  }
})

test('capture XP is the sum of framing grades, with ungraded catches worth nothing', () => {
  assert.equal(captureXpFor([]), 0)
  assert.equal(captureXpFor([creature(), creature({ id: 'b' })]), 0)
  assert.equal(
    captureXpFor([creature({ captureBonusXp: 50 }), creature({ id: 'b', captureBonusXp: 25 }), creature({ id: 'c' })]),
    75,
  )
})

test('decorations unlock by level, in order, and stay unlocked', () => {
  assert.equal(unlockedDecorations(1).length, 0)
  assert.deepEqual(
    unlockedDecorations(2).map((item) => item.key),
    ['birdbath'],
  )
  assert.deepEqual(
    unlockedDecorations(3).map((item) => item.key),
    ['birdbath', 'lantern'],
  )
  assert.equal(unlockedDecorations(4).length, 3)
  assert.equal(unlockedDecorations(60).length, 3)
  assert.deepEqual(
    unlockedDecorations(60).map((item) => item.key),
    unlockedAt(60).map((item) => item.key),
  )
})

test('a level-up banner only announces what that level actually crossed', () => {
  assert.deepEqual(unlocksBetween(1, 1), [])
  assert.deepEqual(
    unlocksBetween(1, 2).map((unlock) => unlock.key),
    ['birdbath'],
  )
  assert.deepEqual(
    unlocksBetween(2, 4).map((unlock) => unlock.key),
    ['lantern', 'picnic'],
  )
  assert.deepEqual(unlocksBetween(4, 9), [])
  // Levels never go backwards, so neither may the announced unlocks.
  assert.deepEqual(unlocksBetween(5, 2), [])
})

test('next unlock points forward and runs out once everything is earned', () => {
  assert.equal(nextUnlock(1)?.key, 'birdbath')
  assert.equal(nextUnlock(2)?.key, 'lantern')
  assert.equal(nextUnlock(3)?.key, 'picnic')
  assert.equal(nextUnlock(4), null)
  assert.equal(nextUnlock(99), null)
})
