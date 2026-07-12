import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Program } from '@anchor-lang/core'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'

const idlPath = resolve('features/summon/idl/summon.json')
const idl = JSON.parse(await readFile(idlPath, 'utf8'))

const requiredInstructions = [
  'initialize',
  'delegate_player',
  'request_pull',
  'resolve_pull',
  'commit_player',
  'commit_and_undelegate_player',
]
const instructionNames = new Set(idl.instructions?.map((instruction) => instruction.name))
for (const name of requiredInstructions) {
  if (!instructionNames.has(name)) throw new Error(`Generated IDL is missing instruction ${name}`)
}

const accountNames = new Set(idl.accounts?.map((account) => account.name.toLowerCase()))
if (!accountNames.has('playerstate')) throw new Error('Generated IDL is missing PlayerState')

const eventNames = new Set(idl.events?.map((event) => event.name.toLowerCase()))
for (const event of ['playerinitialized', 'playerdelegated', 'playercommitted', 'pullrequested', 'pullresolved']) {
  if (!eventNames.has(event)) throw new Error(`Generated IDL is missing event ${event}`)
}

if (!idl.address || idl.address === '11111111111111111111111111111111') {
  throw new Error('Generated IDL has an invalid program address')
}

const connection = new Connection('http://127.0.0.1:8899')
const payer = new PublicKey('7v91N7iZsL7ykCqCnEWEvHhQqPSRCr4dVdpqU1iK1Y6G')
const program = new Program(idl, { connection, publicKey: payer })
const [player] = PublicKey.findProgramAddressSync(
  [Buffer.from('player'), payer.toBytes()],
  program.programId,
)
const queue = new PublicKey('5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc')
const instructions = [
  await program.methods
    .initialize()
    .accountsPartial({ authority: payer, player, systemProgram: SystemProgram.programId })
    .instruction(),
  await program.methods.delegatePlayer().accountsPartial({ payer, pda: player }).instruction(),
  await program.methods
    .requestPull(Array(32).fill(7))
    .accountsPartial({ payer, player, oracleQueue: queue })
    .instruction(),
  await program.methods.commitPlayer().accountsPartial({ payer, player }).instruction(),
]
for (const instruction of instructions) {
  if (!instruction.programId.equals(program.programId)) {
    throw new Error('Generated client instruction targets the wrong program')
  }
}

console.log(
  `Verified Summon IDL ${idl.address}: ${requiredInstructions.length} instructions, PlayerState, events, and account resolution`,
)
