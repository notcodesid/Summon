import { clusterApiUrl } from '@solana/web3.js'

export type SolanaCluster = {
  id: 'solana:devnet' | 'solana:testnet' | 'solana:mainnet-beta' | 'solana:localnet'
  label: string
  url: string
}

export const SUMMON_PLACEHOLDER_PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWxTWqkZL6W2BeZ7FEfcYkgMQHGk'
export const SUMMON_DEVNET_PROGRAM_ID = '9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ'

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

  static support = {
    email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
    privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://github.com/notcodesid/Summon/blob/main/PRIVACY.md',
  }

  static summon = {
    programId: process.env.EXPO_PUBLIC_SUMMON_PROGRAM_ID ?? SUMMON_DEVNET_PROGRAM_ID,
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
