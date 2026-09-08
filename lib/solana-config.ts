/**
 * Public Solana config for the Expo client.
 * No secrets here — RPC URL and program id are public.
 */

export const DEFAULT_SUMMON_PROGRAM_ID = '31PMrc54Z6aZ8YHbm47FugFKpzUc6PJ92vNJtinBUPxN'
export const DEFAULT_SOLANA_RPC_URL = 'https://api.devnet.solana.com'

export const summonProgramId = process.env.EXPO_PUBLIC_SUMMON_PROGRAM_ID ?? DEFAULT_SUMMON_PROGRAM_ID
export const solanaRpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL

export function isDevnetRpc(url: string = solanaRpcUrl): boolean {
  return url.includes('devnet') || url.includes('localhost') || url.includes('127.0.0.1')
}
