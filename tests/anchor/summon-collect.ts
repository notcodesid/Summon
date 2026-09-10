import * as anchor from '@coral-xyz/anchor'
import assert from 'node:assert/strict'

import type { SummonBattle } from '../../target/types/summon_battle'

const CREATURE_SEED = Buffer.from('creature')

type AnchorErrorLike = {
  error?: { errorCode?: { code?: string } }
  logs?: string[]
  message?: string
  simulationResponse?: { logs?: string[] }
}

async function expectAnchorError(action: () => Promise<unknown>, code: string): Promise<void> {
  let caught: AnchorErrorLike | undefined
  try {
    await action()
  } catch (error) {
    caught = error as AnchorErrorLike
  }

  assert.ok(caught, `Expected Anchor error ${code}`)
  const logs = [...(caught.logs ?? []), ...(caught.simulationResponse?.logs ?? [])]
  const details = [caught.message ?? '', ...logs].join('\n')
  assert.ok(
    caught.error?.errorCode?.code === code ||
      details.includes(`Error Code: ${code}`) ||
      details.includes(`Error Code: ${code}.`),
    `Expected Anchor error ${code}, received:\n${details}`,
  )
}

describe('summon collect creature', () => {
  const catchId = Buffer.from('catch-test-00001')
  const photoHash = Array.from(Buffer.alloc(32, 9))
  let provider: anchor.AnchorProvider
  let program: anchor.Program<SummonBattle>
  let owner: anchor.web3.PublicKey
  let creature: anchor.web3.PublicKey

  before(() => {
    provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)
    program = anchor.workspace.SummonBattle as anchor.Program<SummonBattle>
    owner = provider.wallet.publicKey
    ;[creature] = anchor.web3.PublicKey.findProgramAddressSync(
      [CREATURE_SEED, owner.toBuffer(), catchId],
      program.programId,
    )
  })

  async function simulateAndSend(builder: { simulate(): Promise<unknown>; rpc(): Promise<string> }): Promise<string> {
    await builder.simulate()
    return builder.rpc()
  }

  const validArgs = {
    species: 'Vulpes vulpes',
    commonName: 'red fox',
    rarity: 2,
    hp: 80,
    attack: 55,
    defense: 40,
    speed: 62,
    photoHash,
    capturedAt: new anchor.BN(1_700_000_000_000),
  }

  it('records a caught animal on the owner wallet', async () => {
    await simulateAndSend(
      program.methods.collectCreature(Array.from(catchId), validArgs).accounts({ owner }),
    )

    const account = await program.account.creature.fetch(creature)
    assert.equal(account.owner.equals(owner), true)
    assert.equal(account.species, 'Vulpes vulpes')
    assert.equal(account.commonName, 'red fox')
    assert.equal(account.rarity, 2)
    assert.equal(account.hp, 80)
    assert.equal(account.attack, 55)
    assert.equal(account.defense, 40)
    assert.equal(account.speed, 62)
    assert.deepEqual(Array.from(account.catchId), Array.from(catchId))
    assert.deepEqual(Array.from(account.photoHash), photoHash)
  })

  it('rejects a second collect with the same catch id', async () => {
    const before = await program.account.creature.fetch(creature)

    await assert.rejects(() =>
      program.methods.collectCreature(Array.from(catchId), validArgs).accounts({ owner }).simulate(),
    )

    const after = await program.account.creature.fetch(creature)
    assert.deepEqual(after, before)
  })

  it('rejects empty species without creating an account', async () => {
    const invalidCatchId = Buffer.from('catch-invalid001')
    const [invalidCreature] = anchor.web3.PublicKey.findProgramAddressSync(
      [CREATURE_SEED, owner.toBuffer(), invalidCatchId],
      program.programId,
    )

    await expectAnchorError(
      () =>
        program.methods
          .collectCreature(Array.from(invalidCatchId), { ...validArgs, species: '   ' })
          .accounts({ owner })
          .simulate(),
      'InvalidSpecies',
    )

    assert.equal(await provider.connection.getAccountInfo(invalidCreature), null)
  })

  it('rejects out-of-range rarity', async () => {
    const invalidCatchId = Buffer.from('catch-invalid002')

    await expectAnchorError(
      () =>
        program.methods
          .collectCreature(Array.from(invalidCatchId), { ...validArgs, rarity: 5 })
          .accounts({ owner })
          .simulate(),
      'InvalidRarity',
    )
  })

  it('rejects a zero photo hash', async () => {
    const invalidCatchId = Buffer.from('catch-invalid003')

    await expectAnchorError(
      () =>
        program.methods
          .collectCreature(Array.from(invalidCatchId), {
            ...validArgs,
            photoHash: Array.from(Buffer.alloc(32, 0)),
          })
          .accounts({ owner })
          .simulate(),
      'InvalidPhotoHash',
    )
  })
})
