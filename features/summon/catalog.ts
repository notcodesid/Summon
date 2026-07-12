import type { Collectible } from './types'

/** The index in this array is the canonical on-chain collectible index. */
export const collectibles: readonly Collectible[] = [
  {
    id: 'ember-wisp',
    name: 'Ember Wisp',
    lore: 'A small flame that remembers every hand it warmed.',
    rarity: 'Common',
    symbol: 'EW',
    accent: '#FFE4D6',
  },
  {
    id: 'mossling',
    name: 'Mossling',
    lore: 'It grows wherever forgotten wishes gather.',
    rarity: 'Common',
    symbol: 'MS',
    accent: '#DDF0D8',
  },
  {
    id: 'tide-orb',
    name: 'Tide Orb',
    lore: 'A moonlit sea held inside a single breath.',
    rarity: 'Common',
    symbol: 'TO',
    accent: '#DCEEFF',
  },
  {
    id: 'dusk-feather',
    name: 'Dusk Feather',
    lore: 'Dropped by a bird that only flies between worlds.',
    rarity: 'Common',
    symbol: 'DF',
    accent: '#E8E2F0',
  },
  {
    id: 'prism-fang',
    name: 'Prism Fang',
    lore: 'Its edge splits both light and unlucky promises.',
    rarity: 'Rare',
    symbol: 'PF',
    accent: '#DDE9FF',
  },
  {
    id: 'echo-mask',
    name: 'Echo Mask',
    lore: 'Wear it once and hear the truth behind a voice.',
    rarity: 'Rare',
    symbol: 'EM',
    accent: '#E8E0F5',
  },
  {
    id: 'astral-key',
    name: 'Astral Key',
    lore: 'No lock has admitted to belonging to it.',
    rarity: 'Rare',
    symbol: 'AK',
    accent: '#DDF2EE',
  },
  {
    id: 'void-bloom',
    name: 'Void Bloom',
    lore: 'A flower fed by the silence between stars.',
    rarity: 'Epic',
    symbol: 'VB',
    accent: '#F4E0EC',
  },
  {
    id: 'time-shard',
    name: 'Time Shard',
    lore: 'A bright second that refused to pass.',
    rarity: 'Epic',
    symbol: 'TS',
    accent: '#F2E8D8',
  },
  {
    id: 'crown-of-sol',
    name: 'Crown of Sol',
    lore: 'The first sunrise, made wearable.',
    rarity: 'Legendary',
    symbol: 'CS',
    accent: '#FFF0C9',
  },
] as const

export function collectibleAt(index: number) {
  return collectibles[index]
}
