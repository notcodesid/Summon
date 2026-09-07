import * as anchor from '@coral-xyz/anchor'
import assert from 'node:assert/strict'

import type { SummonBattle } from '../../target/types/summon_battle'

const PLAYER_SEED = Buffer.from('player')
const BATTLE_SEED = Buffer.from('battle')

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

describe('summon-battle base lifecycle', () => {
  const battleId = Buffer.from('battle-test-0001')
  const creatureHash = Array.from(Buffer.alloc(32, 7))
  let provider: anchor.AnchorProvider
  let program: anchor.Program<SummonBattle>
  let authority: anchor.web3.PublicKey
  let playerProfile: anchor.web3.PublicKey
  let battle: anchor.web3.PublicKey

  before(() => {
    provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)
    program = anchor.workspace.SummonBattle as anchor.Program<SummonBattle>
    authority = provider.wallet.publicKey
    ;[playerProfile] = anchor.web3.PublicKey.findProgramAddressSync(
      [PLAYER_SEED, authority.toBuffer()],
      program.programId,
    )
    ;[battle] = anchor.web3.PublicKey.findProgramAddressSync(
      [BATTLE_SEED, authority.toBuffer(), battleId],
      program.programId,
    )
  })

  async function simulateAndSend(builder: { simulate(): Promise<unknown>; rpc(): Promise<string> }): Promise<string> {
    await builder.simulate()
    return builder.rpc()
  }

  it('initializes a player profile', async () => {
    await simulateAndSend(program.methods.initializePlayer().accounts({ authority }))
    const profile = await program.account.playerProfile.fetch(playerProfile)
    assert.equal(profile.authority.equals(authority), true)
    assert.equal(profile.wins, 0)
    assert.equal(profile.losses, 0)
    assert.equal(profile.experience, 0)
  })

  it('creates a battle with bounded stats', async () => {
    await simulateAndSend(
      program.methods
        .createBattle(Array.from(battleId), {
          creatureHash,
          playerHp: 120,
          playerAttack: 90,
          playerDefense: 45,
          opponentHp: 100,
          opponentAttack: 60,
          opponentDefense: 30,
        })
        .accounts({ player: authority }),
    )

    const account = await program.account.battle.fetch(battle)
    assert.equal(account.player.equals(authority), true)
    assert.equal(account.turn, 0)
    assert.equal(account.playerHp, 120)
    assert.equal(account.opponentHp, 100)
    assert.equal(account.progressionRecorded, false)
  })

  it('rejects out-of-range battle stats', async () => {
    const invalidBattleId = Buffer.from('battle-invalid01')

    await expectAnchorError(
      () =>
        program.methods
          .createBattle(Array.from(invalidBattleId), {
            creatureHash,
            playerHp: 0,
            playerAttack: 90,
            playerDefense: 45,
            opponentHp: 100,
            opponentAttack: 60,
            opponentDefense: 30,
          })
          .accounts({ player: authority })
          .simulate(),
      'InvalidHitPoints',
    )

    const [invalidBattle] = anchor.web3.PublicKey.findProgramAddressSync(
      [BATTLE_SEED, authority.toBuffer(), invalidBattleId],
      program.programId,
    )
    assert.equal(await provider.connection.getAccountInfo(invalidBattle), null)
  })

  it('resolves deterministic turns to a final winner', async () => {
    let account = await program.account.battle.fetch(battle)
    while ('active' in account.status) {
      await simulateAndSend(program.methods.attack().accountsPartial({ player: authority, battle }))
      account = await program.account.battle.fetch(battle)
    }

    assert.ok(account.turn > 0)
    assert.ok(account.turn <= 5)
    assert.equal('none' in account.winner, false)
  })

  it('rejects turns after a battle finishes without mutating state', async () => {
    const before = await program.account.battle.fetch(battle)

    await expectAnchorError(
      () => program.methods.attack().accountsPartial({ player: authority, battle }).simulate(),
      'BattleNotActive',
    )

    const after = await program.account.battle.fetch(battle)
    assert.deepEqual(after, before)
  })
})
