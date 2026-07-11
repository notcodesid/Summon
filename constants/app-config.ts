import { clusterApiUrl } from '@solana/web3.js'

export type SolanaCluster = {
  id: 'solana:devnet' | 'solana:testnet' | 'solana:mainnet-beta' | 'solana:localnet'
  label: string
  url: string
}

export class AppConfig {
  static name = 'Summon'
  static uri = 'https://summon.app'
  /** iOS bundle id / Android package — register in Privy app client */
  static bundleId = 'com.summon.app'
  static scheme = 'summon'

  static privy = {
    appId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
    clientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
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
