import assert from 'node:assert/strict'
import test from 'node:test'

import { clampToBounds, homePositionFor, isSanctuaryPoint } from '../lib/sanctuary-position.ts'

// Mirrors the band app/(app)/(tabs)/index.tsx passes at iPhone width.
const BOUNDS = { halfWidth: 152, top: -10, bottom: 235 }

test('a creature always lands in the same place', () => {
  const a = homePositionFor('creature-1', 3, BOUNDS)
  const b = homePositionFor('creature-1', 3, BOUNDS)
  assert.deepEqual(a, b)
})

test('catching a new creature does not move the ones already there', () => {
  // Arrival order is oldest-first, so existing creatures keep their index when
  // a newer one is appended. This is the whole point of the derived layout.
  const before = ['a', 'b', 'c'].map((id, i) => homePositionFor(id, i, BOUNDS))
  const after = ['a', 'b', 'c', 'd'].map((id, i) => homePositionFor(id, i, BOUNDS))

  assert.deepEqual(after.slice(0, 3), before)
})

test('different creatures get different spots', () => {
  const seen = new Set()
  for (let i = 0; i < 30; i += 1) {
    const p = homePositionFor(`creature-${i}`, i, BOUNDS)
    const key = `${Math.round(p.x)}:${Math.round(p.y)}`
    assert.equal(seen.has(key), false, `duplicate spot at order ${i}`)
    seen.add(key)
  }
})

test('companions at the same height never stack on top of each other', () => {
  // Partial overlap is fine and reads as depth once drawn back-to-front; what
  // must never happen is two companions sharing a spot. Jitter is capped at
  // half a cell, so adjacent columns are guaranteed at least half a cell apart.
  const COLS = 4
  const minGap = ((BOUNDS.halfWidth * 2) / COLS) * 0.5
  const points = Array.from({ length: 20 }, (_, i) => homePositionFor(`creature-${i}`, i, BOUNDS))

  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      if (Math.abs(points[a].y - points[b].y) > 40) continue
      const gap = Math.abs(points[a].x - points[b].x)
      assert.ok(gap >= minGap, `companions ${a} and ${b} too close (gap ${gap.toFixed(1)} < ${minGap})`)
    }
  }
})

test('consecutive catches are not placed adjacent to each other', () => {
  // A coprime cell step spreads arrivals around rather than filling rows.
  const first = homePositionFor('one', 0, BOUNDS)
  const second = homePositionFor('two', 1, BOUNDS)
  const distance = Math.hypot(second.x - first.x, second.y - first.y)
  assert.ok(distance > 40, `expected spread, got ${distance.toFixed(1)}`)
})

test('positions stay inside the habitat bounds for a full grid', () => {
  // The grid holds 20; beyond that a layer offset intentionally nudges
  // companions outside the base band so they do not stack exactly.
  for (let i = 0; i < 20; i += 1) {
    const { x, y } = homePositionFor(`creature-${i}`, i, BOUNDS)
    assert.ok(x >= -BOUNDS.halfWidth && x <= BOUNDS.halfWidth, `x out of bounds at ${i}: ${x}`)
    assert.ok(y >= BOUNDS.top && y <= BOUNDS.bottom, `y out of bounds at ${i}: ${y}`)
  }
})

test('a collection larger than the grid still resolves to a point', () => {
  const p = homePositionFor('creature-42', 42, BOUNDS)
  assert.equal(isSanctuaryPoint(p), true)
})

test('rejects malformed stored points', () => {
  assert.equal(isSanctuaryPoint({ x: 1, y: 2 }), true)
  assert.equal(isSanctuaryPoint({ x: 'a', y: 2 }), false)
  assert.equal(isSanctuaryPoint({ x: NaN, y: 2 }), false)
  assert.equal(isSanctuaryPoint(null), false)
})

test('a stored spot outside the habitat is pulled back onto the meadow', () => {
  // Guards against a band change (screen size, rotation, layout revision)
  // stranding a dragged companion off-screen forever.
  const stranded = { x: -900, y: -400 }
  const fixed = clampToBounds(stranded, BOUNDS)
  assert.equal(fixed.x, -BOUNDS.halfWidth)
  assert.equal(fixed.y, BOUNDS.top)
})

test('a stored spot already inside the habitat is left alone', () => {
  const inside = { x: 12, y: 120 }
  assert.deepEqual(clampToBounds(inside, BOUNDS), inside)
})

test('companions keep clear of the space the player stands in', () => {
  const withPlayer = { ...BOUNDS, reserved: { halfWidth: 88, top: 80, bottom: 175 } }
  for (let i = 0; i < 20; i += 1) {
    const { x, y } = homePositionFor(`creature-${i}`, i, withPlayer)
    const insideBand = y >= withPlayer.reserved.top && y <= withPlayer.reserved.bottom
    if (insideBand) {
      assert.ok(
        Math.abs(x) >= withPlayer.reserved.halfWidth,
        `companion ${i} is standing inside the player at x=${x.toFixed(1)}`,
      )
    }
  }
})

test('reserving space does not move companions outside the habitat', () => {
  const withPlayer = { ...BOUNDS, reserved: { halfWidth: 88, top: 80, bottom: 175 } }
  for (let i = 0; i < 20; i += 1) {
    const { x } = homePositionFor(`creature-${i}`, i, withPlayer)
    assert.ok(Math.abs(x) <= BOUNDS.halfWidth, `companion ${i} pushed off the meadow: ${x}`)
  }
})
