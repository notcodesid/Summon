import type { BattleAction } from './battle-rules'
import type { Rarity } from './creatures'

type BattleWinner = 'none' | 'player' | 'opponent'

export type HapticCue = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

export function revealSoundFor(rarity: Rarity): `reveal-${Rarity}` {
  return `reveal-${rarity}`
}

export function battleActionFeedback(action: BattleAction): {
  sound: 'hit' | 'guard' | 'instinct'
  haptic: 'medium' | 'heavy'
} {
  if (action === 'guard') return { sound: 'guard', haptic: 'medium' }
  if (action === 'instinct') return { sound: 'instinct', haptic: 'heavy' }
  return { sound: 'hit', haptic: 'medium' }
}

export function battleResultFeedback(winner: BattleWinner): {
  sound: 'victory' | 'defeat'
  haptic: 'success' | 'warning'
} {
  return winner === 'player' ? { sound: 'victory', haptic: 'success' } : { sound: 'defeat', haptic: 'warning' }
}
