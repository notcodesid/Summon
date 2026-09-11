import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dailyMission,
  discoveryDayKey,
  discoveryStreak,
  finishedMission,
  suggestedHabitat,
} from '../lib/expeditions.ts'

const creature = (id, species, capturedAt) => ({
  id,
  species,
  commonName: species,
  rarity: 'common',
  stats: { hp: 1, attack: 1, defense: 1, speed: 1 },
  note: '',
  photoUri: '',
  capturedAt,
})

test('daily mission only counts captures from the local calendar day', () => {
  const now = new Date(2026, 8, 12, 12)
  const result = dailyMission(
    [
      creature('today', 'Dog', new Date(2026, 8, 12, 9).getTime()),
      creature('old', 'Owl', new Date(2026, 8, 11, 9).getTime()),
    ],
    now,
  )
  assert.ok(result.current >= 0 && result.current <= result.target)
  if (result.key === 'daily-wings') assert.equal(result.current, 0)

  // Whichever variant today lands on, a catch from yesterday counts for none of them.
  const onlyOld = dailyMission([creature('old', 'Owl', new Date(2026, 8, 11, 9).getTime())], now)
  assert.equal(onlyOld.current, 0)
})

test('streak counts consecutive discovery days ending today', () => {
  const now = new Date(2026, 8, 12, 12)
  assert.equal(
    discoveryStreak(
      [
        creature('a', 'Dog', new Date(2026, 8, 12, 8).getTime()),
        creature('b', 'Cat', new Date(2026, 8, 11, 8).getTime()),
        creature('c', 'Fox', new Date(2026, 8, 9, 8).getTime()),
      ],
      now,
    ),
    2,
  )
})

test('night habitat is suggested after dark', () => {
  assert.equal(suggestedHabitat(new Date(2026, 8, 12, 22)), 'night')
})

test('an expedition is only finished once its target is met', () => {
  const now = new Date(2026, 8, 12, 12)
  assert.equal(finishedMission([], now), null)

  // A bird plus a second species, both caught today, satisfies every daily
  // variant the rotation can pick: one discovery, two different neighbours,
  // or something with wings.
  const met = finishedMission(
    [
      creature('a', 'Barn Owl', new Date(2026, 8, 12, 9).getTime()),
      creature('b', 'Dog', new Date(2026, 8, 12, 10).getTime()),
    ],
    now,
  )
  assert.ok(met, 'a met expedition must report its mission')
  assert.equal(met.current, met.target)
  assert.ok(met.rewardXp > 0, 'a finished expedition is worth XP')
})

test("yesterday's discoveries do not finish today's expedition", () => {
  const now = new Date(2026, 8, 12, 12)
  assert.equal(
    finishedMission(
      [
        creature('a', 'Barn Owl', new Date(2026, 8, 11, 9).getTime()),
        creature('b', 'Dog', new Date(2026, 8, 11, 10).getTime()),
      ],
      now,
    ),
    null,
  )
})

test('the day key is stable within a day and rolls over at midnight', () => {
  const earlyMorning = new Date(2026, 8, 12, 0, 0, 1)
  const lateNight = new Date(2026, 8, 12, 23, 59, 59)
  assert.equal(discoveryDayKey(earlyMorning), discoveryDayKey(lateNight))
  assert.equal(discoveryDayKey(earlyMorning), discoveryDayKey(earlyMorning.getTime()))
  assert.notEqual(discoveryDayKey(lateNight), discoveryDayKey(new Date(2026, 8, 13, 0, 0, 0)))
})
