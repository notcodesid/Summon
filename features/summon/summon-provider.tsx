import { type Idl } from '@anchor-lang/core'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { Connection } from '@solana/web3.js'
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AppConfig, SUMMON_PLACEHOLDER_PROGRAM_ID } from '@/constants/app-config'
import { useNetwork } from '@/features/network/use-network'
import summonIdl from './idl/summon.json'
import { createOnchainSummonRepository } from './onchain-summon-repository'
import type { PrivySolanaWallet } from './privy-transaction-sender'
import { OwnedCollectible, PullRecord } from './types'

type Value = {
  owned: OwnedCollectible[]
  pulls: PullRecord[]
  loading: boolean
  summoning: boolean
  pending: boolean
  error: string | null
  summon: () => Promise<PullRecord>
}
const SummonContext = createContext<Value | null>(null)

export function SummonProvider({ children }: PropsWithChildren) {
  const solana = useEmbeddedSolanaWallet()
  const { selectedNetwork } = useNetwork()
  const wallet = solana.wallets?.[0] as PrivySolanaWallet | undefined
  const [owned, setOwned] = useState<OwnedCollectible[]>([])
  const [pulls, setPulls] = useState<PullRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [summoning, setSummoning] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configurationError = useMemo(() => {
    if (!wallet) return null
    if (selectedNetwork.id !== 'solana:devnet') {
      return 'Summon on-chain pulls currently require Solana Devnet.'
    }
    if (summonIdl.instructions.length === 0) {
      return 'The Summon program IDL has not been built yet. Run npm run program:build.'
    }
    if (AppConfig.summon.programId === SUMMON_PLACEHOLDER_PROGRAM_ID) {
      return 'The Summon contract is connected, but it must be deployed to Devnet and configured with its real program ID before on-chain pulls can run.'
    }
    return null
  }, [selectedNetwork.id, wallet])
  const repository = useMemo(() => {
    if (!wallet || configurationError) return null
    const baseConnection = new Connection(selectedNetwork.url, 'confirmed')
    const ephemeralConnection = new Connection(AppConfig.summon.ephemeralRpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: AppConfig.summon.ephemeralWsUrl,
    })
    return createOnchainSummonRepository({
      idl: summonIdl as Idl,
      baseConnection,
      ephemeralConnection,
      wallet,
      configuredProgramId: AppConfig.summon.programId,
      networkId: selectedNetwork.id,
    })
  }, [configurationError, selectedNetwork.id, selectedNetwork.url, wallet])
  const owner = wallet?.address ?? null

  const refresh = useCallback(async () => {
    if (!repository || !owner) {
      setOwned([])
      setPulls([])
      setPending(false)
      return
    }
    const snapshot = await repository.getSnapshot(owner)
    setOwned(snapshot.owned)
    setPulls(snapshot.pulls)
    setPending(snapshot.pending)
  }, [owner, repository])
  useEffect(() => {
    setLoading(true)
    setError(configurationError)
    if (configurationError) {
      setLoading(false)
      return
    }
    refresh()
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false))
  }, [configurationError, refresh])
  useEffect(() => {
    if (!pending || !repository || !owner) return
    const interval = setInterval(() => {
      refresh().catch((cause) => setError(errorMessage(cause)))
    }, 1_000)
    return () => clearInterval(interval)
  }, [owner, pending, refresh, repository])
  const summon = useCallback(async () => {
    if (!repository || !owner) throw new Error('Sign in to summon with your Privy wallet')
    setSummoning(true)
    setError(null)
    try {
      const result = await repository.pull(owner)
      await refresh()
      return result
    } catch (cause) {
      setError(errorMessage(cause))
      await refresh().catch(() => undefined)
      throw cause
    } finally {
      setSummoning(false)
    }
  }, [owner, refresh, repository])
  const value = useMemo(
    () => ({
      owned,
      pulls,
      loading,
      summoning,
      pending,
      error,
      summon,
    }),
    [owned, pulls, loading, summoning, pending, error, summon],
  )
  return <SummonContext.Provider value={value}>{children}</SummonContext.Provider>
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

export function useSummon() {
  const value = useContext(SummonContext)
  if (!value) throw new Error('useSummon must be used within SummonProvider')
  return value
}
