import { clusterApiUrl } from '@solana/web3.js'

export type SolanaCluster = {
  id: 'solana:devnet' | 'solana:testnet' | 'solana:mainnet-beta' | 'solana:localnet'
  label: string
  url: string
}

export const SUMMON_PLACEHOLDER_PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWxTWqkZL6W2BeZ7FEfcYkgMQHGk'

export class AppConfig {
  static name = 'Summon'
  static uri = 'https://summon.app'
  /** iOS bundle id / Android package — register in Privy app client */
  static bundleId = 'com.notcodesid.summon'
  static scheme = 'summon'

  static privy = {
    appId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
    clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
  }

  static summon = {
    dataSource: process.env.EXPO_PUBLIC_SUMMON_DATA_SOURCE === 'demo' ? ('demo' as const) : ('onchain' as const),
    programId: process.env.EXPO_PUBLIC_SUMMON_PROGRAM_ID ?? SUMMON_PLACEHOLDER_PROGRAM_ID,
    ephemeralRpcUrl: process.env.EXPO_PUBLIC_MAGICBLOCK_ER_RPC_URL ?? 'https://devnet-as.magicblock.app',
    ephemeralWsUrl: process.env.EXPO_PUBLIC_MAGICBLOCK_ER_WS_URL ?? 'wss://devnet-as.magicblock.app',
  }

  static networks: SolanaCluster[] = [
    {
      id: 'solana:devnet',
      label: 'Devnet',
      url: clusterApiUrl('devnet'),
    },
    {
      id: 'solana:testnet',
      label: 'Testnet',
      url: clusterApiUrl('testnet'),
    },
  ]
}
