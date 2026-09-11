import { Buffer } from 'buffer'
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { catchIdBytesFromHex } from '@/lib/catch-id'
import type { Creature, Rarity } from '@/lib/creatures'
import { withRpcRetry, type SignAndSendProvider } from '@/lib/onchain-player'
import { simulateBeforeSend } from '@/lib/transaction-safety'
import { solanaRpcUrl, summonProgramId } from '@/lib/solana-config'

const CREATURE_SEED = 'creature'

/** First 8 bytes of sha256("global:collect_creature"). */
const COLLECT_CREATURE_DISCRIMINATOR = Buffer.from([87, 15, 112, 29, 20, 182, 216, 18])

/** 8 disc + Creature::INIT_SPACE (234). Used only for a rent check. */
export const CREATURE_ACCOUNT_SPACE = 242

const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

export type CollectOnchainResult = {
  pda: string
  signature: string | null
  created: boolean
}

export function creaturePdaFor(walletAddress: string, catchIdHex: string): PublicKey {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(walletAddress)
  const catchId = catchIdBytesFromHex(catchIdHex)
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from(CREATURE_SEED), wallet.toBuffer(), catchId], program)
  return pda
}

export async function hasOnchainCreature(
  connection: Connection,
  walletAddress: string,
  catchIdHex: string,
): Promise<{ exists: boolean; pda: string }> {
  const pda = creaturePdaFor(walletAddress, catchIdHex)
  const info = await withRpcRetry('getAccountInfo', () => connection.getAccountInfo(pda))
  return { exists: info !== null, pda: pda.toBase58() }
}

function encodeString(value: string): Buffer {
  const body = Buffer.from(value, 'utf8')
  const out = Buffer.alloc(4 + body.length)
  out.writeUInt32LE(body.length, 0)
  body.copy(out, 4)
  return out
}

function encodeU16(value: number): Buffer {
  const out = Buffer.alloc(2)
  out.writeUInt16LE(value, 0)
  return out
}

function encodeI64(value: number): Buffer {
  const out = Buffer.alloc(8)
  out.writeBigInt64LE(BigInt(Math.trunc(value)), 0)
  return out
}

export function buildCollectCreatureInstruction(args: {
  walletAddress: string
  creature: Creature
  photoHash: Uint8Array
}): { instruction: TransactionInstruction; pda: PublicKey } {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(args.walletAddress)
  const catchId = catchIdBytesFromHex(args.creature.id)
  const pda = creaturePdaFor(args.walletAddress, args.creature.id)
  const photoHash = Buffer.from(args.photoHash)
  if (photoHash.length !== 32) {
    throw new Error('Photo hash must be 32 bytes.')
  }

  const species = args.creature.species.trim()
  const commonName = args.creature.commonName.trim()
  const data = Buffer.concat([
    COLLECT_CREATURE_DISCRIMINATOR,
    catchId,
    encodeString(species),
    encodeString(commonName),
    Buffer.from([RARITY_INDEX[args.creature.rarity]]),
    encodeU16(args.creature.stats.hp),
    encodeU16(args.creature.stats.attack),
    encodeU16(args.creature.stats.defense),
    encodeU16(args.creature.stats.speed),
    photoHash,
    encodeI64(args.creature.capturedAt),
  ])

  return {
    pda,
    instruction: new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: wallet, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    }),
  }
}

export async function collectCreatureOnchain(args: {
  walletAddress: string
  creature: Creature
  photoHash: Uint8Array
  getProvider: () => Promise<SignAndSendProvider>
  connection?: Connection
}): Promise<CollectOnchainResult> {
  const connection = args.connection ?? new Connection(solanaRpcUrl, 'confirmed')
  const existing = await hasOnchainCreature(connection, args.walletAddress, args.creature.id)
  if (existing.exists) {
    return { pda: existing.pda, signature: null, created: false }
  }

  const wallet = new PublicKey(args.walletAddress)
  const { instruction, pda } = buildCollectCreatureInstruction({
    walletAddress: args.walletAddress,
    creature: args.creature,
    photoHash: args.photoHash,
  })

  const { blockhash } = await withRpcRetry('getLatestBlockhash', () => connection.getLatestBlockhash('confirmed'))
  const transaction = new Transaction({
    feePayer: wallet,
    recentBlockhash: blockhash,
  }).add(instruction)

  const { signature } = await simulateBeforeSend({
    simulate: () => withRpcRetry('simulateTransaction', () => connection.simulateTransaction(transaction)),
    send: async () => {
      const provider = await args.getProvider()
      return provider.request({
        method: 'signAndSendTransaction',
        params: { transaction, connection, options: { commitment: 'confirmed' } },
      })
    },
  })

  return { pda: pda.toBase58(), signature, created: true }
}
