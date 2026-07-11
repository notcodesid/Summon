import { Collectible, OwnedCollectible, PullRecord } from './types'

/** Collectibles use monogram marks (no emoji). */
export const collectibles: Collectible[] = [
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
]

const initialOwned: OwnedCollectible[] = [
  { collectibleId: 'ember-wisp', quantity: 2, firstReceivedAt: '2026-07-10T12:32:00.000Z' },
  { collectibleId: 'prism-fang', quantity: 1, firstReceivedAt: '2026-07-11T08:14:00.000Z' },
]

const initialPulls: PullRecord[] = [
  {
    id: 'pull-2',
    collectibleId: 'prism-fang',
    createdAt: '2026-07-11T08:14:00.000Z',
    roll: 7421,
    seed: '8f2a…31ce',
    signature: '4cYp…k91V',
    status: 'verified',
  },
  {
    id: 'pull-1',
    collectibleId: 'ember-wisp',
    createdAt: '2026-07-10T12:32:00.000Z',
    roll: 2841,
    seed: '2b17…af08',
    signature: '9zDa…2HmQ',
    status: 'verified',
  },
]

let owned = [...initialOwned]
let pulls = [...initialPulls]

export const mockSummonRepository = {
  async getCollection() {
    return [...owned]
  },
  async getPulls() {
    return [...pulls]
  },
  async pull(): Promise<PullRecord> {
    await new Promise((resolve) => setTimeout(resolve, 900))
    const roll = Math.floor(Math.random() * 10_000)
    const pool =
      roll >= 9900
        ? collectibles.filter((x) => x.rarity === 'Legendary')
        : roll >= 9000
          ? collectibles.filter((x) => x.rarity === 'Epic')
          : roll >= 6000
            ? collectibles.filter((x) => x.rarity === 'Rare')
            : collectibles.filter((x) => x.rarity === 'Common')
    const item = pool[Math.floor(Math.random() * pool.length)]
    const record: PullRecord = {
      id: `pull-${Date.now()}`,
      collectibleId: item.id,
      createdAt: new Date().toISOString(),
      roll,
      seed: `${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
      signature: `${Math.random().toString(36).slice(2, 6)}…${Math.random().toString(36).slice(2, 6)}`,
      status: 'verified',
    }
    pulls = [record, ...pulls]
    const existing = owned.find((x) => x.collectibleId === item.id)
    owned = existing
      ? owned.map((x) =>
          x.collectibleId === item.id ? { ...x, quantity: x.quantity + 1 } : x,
        )
      : [...owned, { collectibleId: item.id, quantity: 1, firstReceivedAt: record.createdAt }]
    return record
  },
}
