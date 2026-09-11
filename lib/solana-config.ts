/**
 * Public Solana config for the Expo client.
 * No secrets here — RPC URL and program id are public.
 */

export const DEFAULT_SUMMON_PROGRAM_ID = '6YdQKUGoeaT1LmuF4PJMRYMMQo1dvW7JNYzAS3CZgoeA'
export const DEFAULT_SOLANA_RPC_URL = 'https://api.devnet.solana.com'
export const DEFAULT_MAGIC_ROUTER_URL = 'https://devnet-router.magicblock.app'
/** Direct endpoint for the validator selected below. Transactions must get
 * their blockhash from the same validator that executes them. */
export const DEFAULT_EPHEMERAL_RPC_URL = 'https://devnet-us.magicblock.app'
/** US Ephemeral Rollup validator (devnet). Passed as remaining account on delegate. */
export const DEFAULT_ER_VALIDATOR = 'MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd'

export const DELEGATION_PROGRAM_ID = 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh'
export const MAGIC_PROGRAM_ID = 'Magic11111111111111111111111111111111111111'
export const MAGIC_CONTEXT_ID = 'MagicContext1111111111111111111111111111111'

export const summonProgramId = process.env.EXPO_PUBLIC_SUMMON_PROGRAM_ID ?? DEFAULT_SUMMON_PROGRAM_ID
export const solanaRpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL
export const magicRouterUrl = process.env.EXPO_PUBLIC_MAGIC_ROUTER_URL ?? DEFAULT_MAGIC_ROUTER_URL
export const ephemeralRpcUrl = process.env.EXPO_PUBLIC_EPHEMERAL_RPC_URL ?? DEFAULT_EPHEMERAL_RPC_URL
export const erValidator = process.env.EXPO_PUBLIC_ER_VALIDATOR ?? DEFAULT_ER_VALIDATOR

export function isDevnetRpc(url: string = solanaRpcUrl): boolean {
  return url.includes('devnet') || url.includes('localhost') || url.includes('127.0.0.1')
}
