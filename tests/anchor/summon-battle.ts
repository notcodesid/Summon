import * as anchor from '@coral-xyz/anchor'
import { expect } from 'chai'

import type { SummonBattle } from '../../target/types/summon_battle'

const PLAYER_SEED = Buffer.from('player')
const BATTLE_SEED = Buffer.from('battle')

describe('summon-battle base lifecycle', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SummonBattle as anchor.Program<SummonBattle>
  const authority = provider.wallet.publicKey
  const battleId = Buffer.from('battle-test-0001')
  const creatureHash = Array.from(Buffer.alloc(32, 7))

  const [playerProfile] = anchor.web3.PublicKey.findProgramAddressSync(
    [PLAYER_SEED, authority.toBuffer()],
    program.programId,
  )
  const [battle] = anchor.web3.PublicKey.findProgramAddressSync(
    [BATTLE_SEED, authority.toBuffer(), battleId],
    program.programId,
  )

  async function simulateAndSend(builder: { simulate(): Promise<unknown>; rpc(): Promise<string> }): Promise<string> {
    await builder.simulate()
    return builder.rpc()
  }

  it('initializes a player profile', async () => {
    await simulateAndSend(program.methods.initializePlayer().accounts({ authority }))
    const profile = await program.account.playerProfile.fetch(playerProfile)
    expect(profile.authority.equals(authority)).to.equal(true)
    expect(profile.wins).to.equal(0)
    expect(profile.losses).to.equal(0)
    expect(profile.experience).to.equal(0)
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
    expect(account.player.equals(authority)).to.equal(true)
    expect(account.turn).to.equal(0)
    expect(account.playerHp).to.equal(120)
    expect(account.opponentHp).to.equal(100)
    expect(account.progressionRecorded).to.equal(false)
  })

  it('resolves deterministic turns to a final winner', async () => {
    let account = await program.account.battle.fetch(battle)
    while ('active' in account.status) {
      await simulateAndSend(program.methods.attack().accountsPartial({ player: authority, battle }))
      account = await program.account.battle.fetch(battle)
    }

    expect(account.turn).to.be.greaterThan(0)
    expect(account.turn).to.be.at.most(5)
    expect('none' in account.winner).to.equal(false)
  })
})
