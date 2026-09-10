import type { Creature } from '@/lib/creatures'

let pending: Creature | null = null

export function setPendingBattle(creature: Creature): void {
  pending = creature
}

export function takePendingBattle(): Creature | null {
  const next = pending
  pending = null
  return next
}
