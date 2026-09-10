import { Buffer } from 'buffer'
import { getRandomBytes } from 'expo-crypto'

/** Matches on-chain CATCH_ID_LENGTH. Creature.id is this value as hex. */
export const CATCH_ID_LENGTH = 16

export function newCatchIdHex(): string {
  return catchIdToHex(getRandomBytes(CATCH_ID_LENGTH))
}

export function catchIdToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

export function catchIdBytesFromHex(id: string): Buffer {
  const hex = id.trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error('Catch id is not a 16-byte hex string.')
  }
  return Buffer.from(hex, 'hex')
}
