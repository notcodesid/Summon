/**
 * Where a creature lives in the sanctuary, derived rather than stored.
 *
 * The same creature always lands in the same place, and catching a new one
 * never moves the ones already there. This mirrors how `statsFor` derives
 * stats from the species instead of persisting them.
 *
 * Kept free of React Native imports so it can be unit tested directly.
 */
export type SanctuaryPoint = { x: number; y: number }

/** Offsets are relative to the habitat anchor, matching the screen's layout. */
export type SanctuaryBounds = {
  halfWidth: number
  top: number
  bottom: number
  /**
   * Footprint the player avatar stands in. Companions are pushed clear of it
   * so the player anchors the foreground instead of being buried in the crowd.
   */
  reserved?: { halfWidth: number; top: number; bottom: number }
}

// Cells must be at least as large as a rendered companion (~76pt) or the
// sprites collide regardless of how well-distributed the cells are.
const COLS = 4
const ROWS = 5
const CELLS = COLS * ROWS
/** Coprime with CELLS (20), so consecutive catches land far apart, not in a row. */
const STEP = 7

/** djb2, same as lib/creatures.ts — stable across runs and platforms. */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * `order` is the creature's index in oldest-first arrival order. Using arrival
 * order rather than the newest-first render order is what keeps existing
 * creatures still when a new one is added.
 */
export function homePositionFor(creatureId: string, order: number, bounds: SanctuaryBounds): SanctuaryPoint {
  const layer = Math.floor(order / CELLS)
  const cell = (order * STEP) % CELLS
  const col = cell % COLS
  const row = Math.floor(cell / COLS)

  const h = hash(creatureId)
  const jitterX = ((h >>> 0) % 1000) / 1000 - 0.5
  const jitterY = ((h >>> 10) % 1000) / 1000 - 0.5

  const cellWidth = (bounds.halfWidth * 2) / COLS
  const cellHeight = (bounds.bottom - bounds.top) / ROWS

  let x = -bounds.halfWidth + cellWidth * (col + 0.5) + jitterX * cellWidth * 0.5 + layer * 12
  const y = bounds.top + cellHeight * (row + 0.5) + jitterY * cellHeight * 0.5 + layer * 10

  const reserved = bounds.reserved
  if (reserved && y >= reserved.top && y <= reserved.bottom && Math.abs(x) < reserved.halfWidth) {
    // Displace sideways only — nudging vertically would break the row spacing
    // the grid guarantees.
    const clear = reserved.halfWidth + 10
    x = x >= 0 ? Math.min(clear, bounds.halfWidth) : Math.max(-clear, -bounds.halfWidth)
  }

  return { x, y }
}

/**
 * Keeps a stored arrangement inside the habitat.
 *
 * Saved spots are replayed verbatim on load, so a band that changes — a
 * different screen size, an orientation change, or a layout revision — would
 * otherwise strand companions off the meadow forever.
 */
export function clampToBounds(point: SanctuaryPoint, bounds: SanctuaryBounds): SanctuaryPoint {
  return {
    x: Math.min(Math.max(point.x, -bounds.halfWidth), bounds.halfWidth),
    y: Math.min(Math.max(point.y, bounds.top), bounds.bottom),
  }
}

export function isSanctuaryPoint(value: unknown): value is SanctuaryPoint {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Number.isFinite((value as SanctuaryPoint).x) &&
    Number.isFinite((value as SanctuaryPoint).y)
  )
}
