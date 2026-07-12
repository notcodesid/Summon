import { collectibles } from './catalog'
import type { OwnedCollectible, PullRecord, SummonRepository, SummonSnapshot } from './types'

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
    status: 'demo',
  },
  {
    id: 'pull-1',
    collectibleId: 'ember-wisp',
    createdAt: '2026-07-10T12:32:00.000Z',
    roll: 2841,
    seed: '2b17…af08',
    signature: '9zDa…2HmQ',
    status: 'demo',
  },
]

type DemoState = { owned: OwnedCollectible[]; pulls: PullRecord[] }
const states = new Map<string, DemoState>()

function stateFor(owner: string) {
  const existing = states.get(owner)
  if (existing) return existing
  const created = {
    owned: initialOwned.map((entry) => ({ ...entry })),
    pulls: initialPulls.map((entry) => ({ ...entry })),
  }
  states.set(owner, created)
  return created
}

export const mockSummonRepository: SummonRepository = {
  mode: 'demo',
  async getSnapshot(owner): Promise<SummonSnapshot> {
    const state = stateFor(owner)
    return { owned: [...state.owned], pulls: [...state.pulls], pending: false }
  },
  async pull(owner): Promise<PullRecord> {
    const state = stateFor(owner)
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
      status: 'demo',
    }
    state.pulls = [record, ...state.pulls]
    const existing = state.owned.find((x) => x.collectibleId === item.id)
    state.owned = existing
      ? state.owned.map((x) => (x.collectibleId === item.id ? { ...x, quantity: x.quantity + 1 } : x))
      : [...state.owned, { collectibleId: item.id, quantity: 1, firstReceivedAt: record.createdAt }]
    return record
  },
}

// Temporary compatibility export while screens move to the catalog module.
export { collectibles }
