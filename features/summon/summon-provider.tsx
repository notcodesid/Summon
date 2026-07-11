import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { mockSummonRepository } from './mock-summon-repository'
import { OwnedCollectible, PullRecord } from './types'

type Value = { owned: OwnedCollectible[]; pulls: PullRecord[]; loading: boolean; summoning: boolean; summon: () => Promise<PullRecord> }
const SummonContext = createContext<Value | null>(null)

export function SummonProvider({ children }: PropsWithChildren) {
  const [owned, setOwned] = useState<OwnedCollectible[]>([])
  const [pulls, setPulls] = useState<PullRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [summoning, setSummoning] = useState(false)
  const refresh = useCallback(async () => {
    const [nextOwned, nextPulls] = await Promise.all([mockSummonRepository.getCollection(), mockSummonRepository.getPulls()])
    setOwned(nextOwned); setPulls(nextPulls)
  }, [])
  useEffect(() => { refresh().finally(() => setLoading(false)) }, [refresh])
  const summon = useCallback(async () => {
    setSummoning(true)
    try { const result = await mockSummonRepository.pull(); await refresh(); return result } finally { setSummoning(false) }
  }, [refresh])
  const value = useMemo(() => ({ owned, pulls, loading, summoning, summon }), [owned, pulls, loading, summoning, summon])
  return <SummonContext.Provider value={value}>{children}</SummonContext.Provider>
}

export function useSummon() {
  const value = useContext(SummonContext)
  if (!value) throw new Error('useSummon must be used within SummonProvider')
  return value
}
