import { Buffer } from 'buffer'
import { digest, CryptoDigestAlgorithm, getRandomBytes } from 'expo-crypto'
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { cannedOpponentFor } from '@/lib/canned-opponent'
import { ECOLOGICAL_CLASSES, ecologicalClassFor, passiveTraitIndex, type BattleAction } from '@/lib/battle-rules'
import type { Creature } from '@/lib/creatures'
import {
  ensureOnchainPlayer,
  fetchPlayerProgression,
  playerPdaFor,
  withRpcRetry,
  type PlayerProgression,
  type SignAndSendProvider,
} from '@/lib/onchain-player'
import { requestSponsorDrip } from '@/lib/sponsor'
import {
  DELEGATION_PROGRAM_ID,
  DEFAULT_SOLANA_RPC_URL,
  ephemeralRpcUrl,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  erValidator,
  isDevnetRpc,
  solanaRpcUrl,
  summonProgramId,
} from '@/lib/solana-config'
import { simulateBeforeSend } from '@/lib/transaction-safety'

const BATTLE_SEED = 'battle'
const BATTLE_ID_LENGTH = 16

/** First 8 bytes of sha256("global:create_battle" | delegate_battle | attack | settle_battle). */
const CREATE_BATTLE_DISCRIMINATOR = Buffer.from([2, 249, 54, 216, 42, 99, 187, 102])
const DELEGATE_BATTLE_DISCRIMINATOR = Buffer.from([62, 10, 250, 88, 180, 36, 120, 74])
const ATTACK_DISCRIMINATOR = Buffer.from([197, 26, 63, 242, 77, 247, 101, 119])
const SETTLE_BATTLE_DISCRIMINATOR = Buffer.from([4, 146, 32, 157, 82, 216, 214, 28])

/** 8 disc + Battle::INIT_SPACE. */
export const BATTLE_ACCOUNT_SPACE = 117

export type BattleWinner = 'none' | 'player' | 'opponent'

export type OnchainBattle = {
  battleId: Buffer
  pda: string
  playerHp: number
  playerMaxHp: number
  playerAttack: number
  playerDefense: number
  playerSpeed: number
  playerEnergy: number
  playerClass: number
  playerTrait: number
  opponentHp: number
  opponentMaxHp: number
  opponentAttack: number
  opponentDefense: number
  opponentSpeed: number
  opponentClass: number
  turn: number
  status: 'active' | 'finished'
  winner: BattleWinner
}

export type BattleTurnLog = {
  turn: number
  playerHp: number
  opponentHp: number
  winner: BattleWinner
  latencyMs: number
  action?: BattleAction
  playerDamage?: number
  opponentDamage?: number
}

function encodeU16(value: number): Buffer {
  const out = Buffer.alloc(2)
  out.writeUInt16LE(value, 0)
  return out
}

export function baseBattleConnection(): Connection {
  return new Connection(solanaRpcUrl, 'confirmed')
}

export function ephemeralBattleConnection(): Connection {
  return new Connection(ephemeralRpcUrl, 'confirmed')
}

/**
 * React Native occasionally reports a transport-level failure for a dedicated
 * RPC even though iOS itself can reach it. Probe the configured endpoint with
 * a real account read and fall back to public devnet for this battle only.
 * Once selected, every base transaction keeps using the same connection for
 * its blockhash, send, confirmation, and subsequent reads.
 */
async function availableBaseBattleConnection(): Promise<Connection> {
  const primary = baseBattleConnection()
  const candidates = [primary]
  if (primary.rpcEndpoint !== DEFAULT_SOLANA_RPC_URL) {
    candidates.push(new Connection(DEFAULT_SOLANA_RPC_URL, 'confirmed'))
  }

  let lastError: unknown
  for (const connection of candidates) {
    try {
      const program = await connection.getAccountInfo(new PublicKey(summonProgramId), 'confirmed')
      if (!program?.executable) {
        throw new Error(`Summon program is not deployed on ${connection.rpcEndpoint}`)
      }
      return connection
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No Solana devnet RPC is reachable')
}

export function battlePdaFor(walletAddress: string, battleId: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(BATTLE_SEED), new PublicKey(walletAddress).toBuffer(), battleId],
    new PublicKey(summonProgramId),
  )
  return pda
}

function delegationPdas(battlePda: PublicKey): {
  buffer: PublicKey
  record: PublicKey
  metadata: PublicKey
} {
  const program = new PublicKey(summonProgramId)
  const dlp = new PublicKey(DELEGATION_PROGRAM_ID)
  const [buffer] = PublicKey.findProgramAddressSync([Buffer.from('buffer'), battlePda.toBuffer()], program)
  const [record] = PublicKey.findProgramAddressSync([Buffer.from('delegation'), battlePda.toBuffer()], dlp)
  const [metadata] = PublicKey.findProgramAddressSync([Buffer.from('delegation-metadata'), battlePda.toBuffer()], dlp)
  return { buffer, record, metadata }
}

export function decodeBattle(data: Buffer): Omit<OnchainBattle, 'pda'> {
  let offset = 8
  const battleId = Buffer.from(data.subarray(offset, offset + 16))
  offset += 16
  offset += 32 // player
  offset += 32 // creature_hash
  const playerHp = data.readUInt16LE(offset)
  offset += 2
  const playerMaxHp = data.readUInt16LE(offset)
  offset += 2
  const playerAttack = data.readUInt16LE(offset)
  offset += 2
  const playerDefense = data.readUInt16LE(offset)
  offset += 2
  const playerSpeed = data.readUInt16LE(offset)
  offset += 2
  const playerEnergy = data.readUInt8(offset)
  offset += 1
  const playerClass = data.readUInt8(offset)
  offset += 1
  const playerTrait = data.readUInt8(offset)
  offset += 1
  const opponentHp = data.readUInt16LE(offset)
  offset += 2
  const opponentMaxHp = data.readUInt16LE(offset)
  offset += 2
  const opponentAttack = data.readUInt16LE(offset)
  offset += 2
  const opponentDefense = data.readUInt16LE(offset)
  offset += 2
  const opponentSpeed = data.readUInt16LE(offset)
  offset += 2
  const opponentClass = data.readUInt8(offset)
  offset += 1
  const turn = data.readUInt8(offset)
  offset += 1
  const status = data.readUInt8(offset) === 1 ? 'finished' : 'active'
  offset += 1
  const winnerRaw = data.readUInt8(offset)
  const winner: BattleWinner = winnerRaw === 1 ? 'player' : winnerRaw === 2 ? 'opponent' : 'none'

  return {
    battleId,
    playerHp,
    playerMaxHp,
    playerAttack,
    playerDefense,
    playerSpeed,
    playerEnergy,
    playerClass,
    playerTrait,
    opponentHp,
    opponentMaxHp,
    opponentAttack,
    opponentDefense,
    opponentSpeed,
    opponentClass,
    turn,
    status,
    winner,
  }
}

async function fetchBattle(connection: Connection, pda: PublicKey): Promise<OnchainBattle | null> {
  const info = await withRpcRetry('getAccountInfo', () => connection.getAccountInfo(pda))
  if (!info?.data) return null
  return { ...decodeBattle(Buffer.from(info.data)), pda: pda.toBase58() }
}

async function signAndSend(args: {
  connection: Connection
  walletAddress: string
  instruction: TransactionInstruction
  getProvider: () => Promise<SignAndSendProvider>
}): Promise<string> {
  const wallet = new PublicKey(args.walletAddress)
  let lastError: unknown

  // Signing on mobile can outlive a recent blockhash. Rebuild once with a
  // blockhash from the exact RPC that will execute the instruction.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { blockhash } = await withRpcRetry('getLatestBlockhash', () =>
        args.connection.getLatestBlockhash('confirmed'),
      )
      const transaction = new Transaction({
        feePayer: wallet,
        recentBlockhash: blockhash,
      }).add(args.instruction)
      const { signature } = await simulateBeforeSend({
        simulate: () => withRpcRetry('simulateTransaction', () => args.connection.simulateTransaction(transaction)),
        send: async () => {
          const provider = await args.getProvider()
          return provider.request({
            method: 'signAndSendTransaction',
            params: {
              transaction,
              connection: args.connection,
              options: { commitment: 'confirmed' },
            },
          })
        },
      })
      return signature
    } catch (error) {
      lastError = error
      const raw = error instanceof Error ? error.message : ''
      if (!/blockhash not found|block height exceeded|transaction expired/i.test(raw)) throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Transaction blockhash expired')
}

async function waitForDelegatedBattle(connection: Connection, pda: PublicKey): Promise<OnchainBattle | null> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const battle = await fetchBattle(connection, pda).catch(() => null)
    if (battle) return battle
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

async function creatureHashFor(creature: Creature): Promise<Buffer> {
  const digestBuffer = await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(creature.id))
  return Buffer.from(digestBuffer)
}

function buildCreateBattleInstruction(args: {
  walletAddress: string
  battleId: Buffer
  creatureHash: Buffer
  playerHp: number
  playerAttack: number
  playerDefense: number
  playerSpeed: number
  playerClass: number
  playerTrait: number
  opponentHp: number
  opponentAttack: number
  opponentDefense: number
  opponentSpeed: number
  opponentClass: number
}): TransactionInstruction {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(args.walletAddress)
  const pda = battlePdaFor(args.walletAddress, args.battleId)
  const data = Buffer.concat([
    CREATE_BATTLE_DISCRIMINATOR,
    args.battleId,
    args.creatureHash,
    encodeU16(args.playerHp),
    encodeU16(args.playerAttack),
    encodeU16(args.playerDefense),
    encodeU16(args.playerSpeed),
    Buffer.from([args.playerClass, args.playerTrait]),
    encodeU16(args.opponentHp),
    encodeU16(args.opponentAttack),
    encodeU16(args.opponentDefense),
    encodeU16(args.opponentSpeed),
    Buffer.from([args.opponentClass]),
  ])
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

function buildDelegateBattleInstruction(args: { walletAddress: string; battleId: Buffer }): TransactionInstruction {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(args.walletAddress)
  const pda = battlePdaFor(args.walletAddress, args.battleId)
  const { buffer, record, metadata } = delegationPdas(pda)
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: record, isSigner: false, isWritable: true },
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: program, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(DELEGATION_PROGRAM_ID), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(erValidator), isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DELEGATE_BATTLE_DISCRIMINATOR, args.battleId]),
  })
}

function buildAttackInstruction(args: {
  walletAddress: string
  battleId: Buffer
  action?: BattleAction
}): TransactionInstruction {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(args.walletAddress)
  const pda = battlePdaFor(args.walletAddress, args.battleId)
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: false },
      { pubkey: pda, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      ATTACK_DISCRIMINATOR,
      Buffer.from([args.action === 'guard' ? 1 : args.action === 'instinct' ? 2 : 0]),
    ]),
  })
}

function buildSettleBattleInstruction(args: { walletAddress: string; battleId: Buffer }): TransactionInstruction {
  const program = new PublicKey(summonProgramId)
  const wallet = new PublicKey(args.walletAddress)
  const pda = battlePdaFor(args.walletAddress, args.battleId)
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: playerPdaFor(args.walletAddress), isSigner: false, isWritable: false },
      { pubkey: program, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(MAGIC_PROGRAM_ID), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(MAGIC_CONTEXT_ID), isSigner: false, isWritable: true },
    ],
    data: SETTLE_BATTLE_DISCRIMINATOR,
  })
}

export type ErBattleResult = {
  winner: BattleWinner
  turns: BattleTurnLog[]
  pda: string
  finalBattle: OnchainBattle
  settlementSignature: string
  progression: PlayerProgression | null
  progressionVerified: boolean
}

async function waitForProgression(args: {
  connection: Connection
  walletAddress: string
  before: PlayerProgression | null
  winner: BattleWinner
}): Promise<{ progression: PlayerProgression | null; verified: boolean }> {
  const expectedWins = (args.before?.wins ?? 0) + (args.winner === 'player' ? 1 : 0)
  const expectedLosses = (args.before?.losses ?? 0) + (args.winner === 'opponent' ? 1 : 0)
  const expectedXp = (args.before?.experience ?? 0) + (args.winner === 'player' ? 100 : 25)

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const progression = await fetchPlayerProgression(args.connection, args.walletAddress).catch(() => null)
    if (
      progression &&
      progression.wins >= expectedWins &&
      progression.losses >= expectedLosses &&
      progression.experience >= expectedXp
    ) {
      return { progression, verified: true }
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
  return {
    progression: await fetchPlayerProgression(args.connection, args.walletAddress).catch(() => null),
    verified: false,
  }
}

export type InteractiveBattleSession = {
  walletAddress: string
  battleId: Buffer
  pda: string
  battle: OnchainBattle
  turns: BattleTurnLog[]
  baseConnection: Connection
  ephemeralConnection: Connection
  progressionBefore: PlayerProgression | null
  getProvider: () => Promise<SignAndSendProvider>
}

async function fundForBattle(connection: Connection, destination: PublicKey): Promise<boolean> {
  if (await requestSponsorDrip(destination.toBase58())) return true
  if (!isDevnetRpc(connection.rpcEndpoint) && !connection.rpcEndpoint.includes('magicblock')) return false
  try {
    await connection.requestAirdrop(destination, 100_000_000)
    return true
  } catch {
    return false
  }
}

export async function prepareInteractiveBattle(args: {
  walletAddress: string
  creature: Creature
  getProvider: () => Promise<SignAndSendProvider>
}): Promise<InteractiveBattleSession> {
  const baseConnection = await availableBaseBattleConnection()
  const ephemeralConnection = ephemeralBattleConnection()
  const player = await ensureOnchainPlayer({
    walletAddress: args.walletAddress,
    getProvider: args.getProvider,
    connection: baseConnection,
    fundWallet: fundForBattle,
  })
  if (player.funded === false) throw new Error('Need a little SOL to start a fight. Try again in a moment.')

  const wallet = new PublicKey(args.walletAddress)
  const rent = await baseConnection.getMinimumBalanceForRentExemption(BATTLE_ACCOUNT_SPACE).catch(() => 0)
  let balance = await baseConnection.getBalance(wallet).catch(() => 0)
  if (balance < rent && (await fundForBattle(baseConnection, wallet))) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    balance = await baseConnection.getBalance(wallet).catch(() => 0)
  }
  if (balance < rent) throw new Error('Need a little SOL to start a fight. Try again in a moment.')

  const progressionBefore = await fetchPlayerProgression(baseConnection, args.walletAddress)
  const battleId = Buffer.from(getRandomBytes(BATTLE_ID_LENGTH))
  const creatureHash = await creatureHashFor(args.creature)
  const opponent = cannedOpponentFor(args.creature)
  const pda = battlePdaFor(args.walletAddress, battleId)

  await signAndSend({
    connection: baseConnection,
    walletAddress: args.walletAddress,
    getProvider: args.getProvider,
    instruction: buildCreateBattleInstruction({
      walletAddress: args.walletAddress,
      battleId,
      creatureHash,
      playerHp: args.creature.stats.hp,
      playerAttack: args.creature.stats.attack,
      playerDefense: args.creature.stats.defense,
      playerSpeed: args.creature.stats.speed,
      playerClass: ECOLOGICAL_CLASSES.indexOf(ecologicalClassFor(args.creature)),
      playerTrait: passiveTraitIndex(args.creature),
      opponentHp: opponent.hp,
      opponentAttack: opponent.attack,
      opponentDefense: opponent.defense,
      opponentSpeed: opponent.speed,
      opponentClass: opponent.ecologicalClass,
    }),
  })
  await signAndSend({
    connection: baseConnection,
    walletAddress: args.walletAddress,
    getProvider: args.getProvider,
    instruction: buildDelegateBattleInstruction({ walletAddress: args.walletAddress, battleId }),
  })
  const battle = await waitForDelegatedBattle(ephemeralConnection, pda)
  if (!battle) throw new Error('The rollup did not receive the match. Please try again.')
  return {
    walletAddress: args.walletAddress,
    battleId,
    pda: pda.toBase58(),
    battle,
    turns: [],
    baseConnection,
    ephemeralConnection,
    progressionBefore,
    getProvider: args.getProvider,
  }
}

export async function playInteractiveTurn(
  session: InteractiveBattleSession,
  action: BattleAction,
): Promise<InteractiveBattleSession> {
  if (action === 'instinct' && session.battle.playerEnergy < 2) throw new Error('Instinct needs two energy.')
  const before = session.battle
  const startedAt = Date.now()
  await signAndSend({
    connection: session.ephemeralConnection,
    walletAddress: session.walletAddress,
    getProvider: session.getProvider,
    instruction: buildAttackInstruction({ walletAddress: session.walletAddress, battleId: session.battleId, action }),
  })
  const battle = await fetchBattle(session.ephemeralConnection, new PublicKey(session.pda))
  if (!battle) throw new Error('The rollup did not return this turn.')
  const turn: BattleTurnLog = {
    turn: battle.turn,
    playerHp: battle.playerHp,
    opponentHp: battle.opponentHp,
    winner: battle.winner,
    latencyMs: Date.now() - startedAt,
    action,
    playerDamage: Math.max(0, before.playerHp - battle.playerHp),
    opponentDamage: Math.max(0, before.opponentHp - battle.opponentHp),
  }
  return { ...session, battle, turns: [...session.turns, turn] }
}

export async function settleInteractiveBattle(session: InteractiveBattleSession): Promise<ErBattleResult> {
  if (session.battle.status !== 'finished') throw new Error('The battle is not finished yet.')
  const settlementSignature = await signAndSend({
    connection: session.ephemeralConnection,
    walletAddress: session.walletAddress,
    getProvider: session.getProvider,
    instruction: buildSettleBattleInstruction({ walletAddress: session.walletAddress, battleId: session.battleId }),
  })
  const progressionResult = await waitForProgression({
    connection: session.baseConnection,
    walletAddress: session.walletAddress,
    before: session.progressionBefore,
    winner: session.battle.winner,
  })
  return {
    winner: session.battle.winner,
    turns: session.turns,
    pda: session.pda,
    finalBattle: session.battle,
    settlementSignature,
    progression: progressionResult.progression,
    progressionVerified: progressionResult.verified,
  }
}
