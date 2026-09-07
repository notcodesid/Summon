use crate::{
    combat::{damage, winner_by_health},
    constants::*,
    errors::BattleError,
    events::TurnResolved,
    state::*,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PlayTurn<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [BATTLE_SEED, player.key().as_ref(), battle.battle_id.as_ref()],
        bump = battle.bump, has_one = player @ BattleError::UnauthorizedPlayer)]
    pub battle: Account<'info, Battle>,
}

pub fn play_turn(ctx: Context<PlayTurn>) -> Result<()> {
    let battle = &mut ctx.accounts.battle;
    require!(
        battle.status == BattleStatus::Active,
        BattleError::BattleNotActive
    );
    require!(battle.turn < MAX_TURNS, BattleError::TurnLimitReached);
    let damage_to_opponent = damage(battle.player_attack, battle.opponent_defense);
    battle.opponent_hp = battle.opponent_hp.saturating_sub(damage_to_opponent);
    let mut damage_to_player = 0;
    if battle.opponent_hp == 0 {
        battle.status = BattleStatus::Finished;
        battle.winner = Winner::Player;
    } else {
        damage_to_player = damage(battle.opponent_attack, battle.player_defense);
        battle.player_hp = battle.player_hp.saturating_sub(damage_to_player);
        if battle.player_hp == 0 {
            battle.status = BattleStatus::Finished;
            battle.winner = Winner::Opponent;
        }
    }
    battle.turn = battle
        .turn
        .checked_add(1)
        .ok_or(BattleError::MathOverflow)?;
    if battle.status == BattleStatus::Active && battle.turn == MAX_TURNS {
        battle.status = BattleStatus::Finished;
        battle.winner = winner_by_health(battle);
    }
    emit!(TurnResolved {
        battle: battle.key(),
        turn: battle.turn,
        damage_to_opponent,
        damage_to_player,
        player_hp: battle.player_hp,
        opponent_hp: battle.opponent_hp,
        winner: battle.winner
    });
    Ok(())
}
