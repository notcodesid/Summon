use crate::{
    combat::{damage, winner_by_health}, constants::*, errors::BattleError, events::TurnResolved, state::*,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PlayTurn<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [BATTLE_SEED, player.key().as_ref(), battle.battle_id.as_ref()],
        bump = battle.bump, has_one = player @ BattleError::UnauthorizedPlayer)]
    pub battle: Account<'info, Battle>,
}

fn class_bonus(attacker: u8, defender: u8) -> u32 {
    if matches!((attacker, defender), (0, 4) | (1, 0) | (2, 0) | (3, 1) | (4, 5) | (5, 2)) { 120 } else { 100 }
}

fn scaled_damage(base: u16, percent: u32) -> u16 {
    u16::try_from(u32::from(base).saturating_mul(percent) / 100).unwrap_or(u16::MAX).max(1)
}

fn player_damage(battle: &Battle, action: BattleAction) -> u16 {
    let base = damage(battle.player_attack, battle.opponent_defense);
    let mut percent = class_bonus(battle.player_class, battle.opponent_class);
    if action == BattleAction::Instinct { percent = percent.saturating_add(60); }
    if (battle.player_trait == 0 && action == BattleAction::Strike)
        || (battle.player_trait == 1 && action == BattleAction::Instinct)
        || (battle.player_trait == 4 && battle.player_class == 3)
    {
        percent = percent.saturating_add(15);
    }
    scaled_damage(base, percent)
}

fn opponent_damage(battle: &Battle, guarded: bool) -> u16 {
    let base = damage(battle.opponent_attack, battle.player_defense);
    let classed = scaled_damage(base, class_bonus(battle.opponent_class, battle.player_class));
    if guarded { scaled_damage(classed, if battle.player_trait == 2 { 35 } else { 50 }) } else { classed }
}

fn finish_if_knocked_out(battle: &mut Battle) -> bool {
    if battle.opponent_hp == 0 {
        battle.status = BattleStatus::Finished;
        battle.winner = Winner::Player;
        true
    } else if battle.player_hp == 0 {
        battle.status = BattleStatus::Finished;
        battle.winner = Winner::Opponent;
        true
    } else {
        false
    }
}

pub fn play_turn(ctx: Context<PlayTurn>, action: BattleAction) -> Result<()> {
    let battle = &mut ctx.accounts.battle;
    require!(battle.status == BattleStatus::Active, BattleError::BattleNotActive);
    require!(battle.turn < MAX_TURNS, BattleError::TurnLimitReached);
    if action == BattleAction::Instinct {
        require!(battle.player_energy >= INSTINCT_COST, BattleError::InsufficientEnergy);
    }

    let guarded = action == BattleAction::Guard;
    let mut damage_to_opponent = 0;
    let mut damage_to_player = 0;
    let player_first = battle.player_speed >= battle.opponent_speed;

    if !player_first {
        damage_to_player = opponent_damage(battle, guarded);
        battle.player_hp = battle.player_hp.saturating_sub(damage_to_player);
    }
    if !finish_if_knocked_out(battle) {
        match action {
            BattleAction::Strike => {
                damage_to_opponent = player_damage(battle, action);
                battle.player_energy = battle.player_energy.saturating_add(1).min(MAX_ENERGY);
            }
            BattleAction::Guard => battle.player_energy = battle.player_energy.saturating_add(2).min(MAX_ENERGY),
            BattleAction::Instinct => {
                damage_to_opponent = player_damage(battle, action);
                battle.player_energy = battle.player_energy.saturating_sub(INSTINCT_COST);
            }
        }
        battle.opponent_hp = battle.opponent_hp.saturating_sub(damage_to_opponent);
    }
    if player_first && !finish_if_knocked_out(battle) {
        damage_to_player = opponent_damage(battle, guarded);
        battle.player_hp = battle.player_hp.saturating_sub(damage_to_player);
    }
    finish_if_knocked_out(battle);

    battle.turn = battle.turn.checked_add(1).ok_or(BattleError::MathOverflow)?;
    if battle.status == BattleStatus::Active && battle.turn == MAX_TURNS {
        battle.status = BattleStatus::Finished;
        battle.winner = winner_by_health(battle);
    }
    emit!(TurnResolved {
        battle: battle.key(), turn: battle.turn, damage_to_opponent, damage_to_player,
        player_hp: battle.player_hp, opponent_hp: battle.opponent_hp, winner: battle.winner,
        action, player_energy: battle.player_energy,
    });
    Ok(())
}
