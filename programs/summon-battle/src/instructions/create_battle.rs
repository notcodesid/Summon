use crate::{combat::validate_stats, constants::*, events::BattleCreated, state::*};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct CreateBattleArgs {
    pub creature_hash: [u8; 32],
    pub player_hp: u16,
    pub player_attack: u16,
    pub player_defense: u16,
    pub opponent_hp: u16,
    pub opponent_attack: u16,
    pub opponent_defense: u16,
}

#[derive(Accounts)]
#[instruction(battle_id: [u8; BATTLE_ID_LENGTH])]
pub struct CreateBattle<'info> {
    #[account(init, payer = player, space = 8 + Battle::INIT_SPACE,
        seeds = [BATTLE_SEED, player.key().as_ref(), battle_id.as_ref()], bump)]
    pub battle: Account<'info, Battle>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_battle(
    ctx: Context<CreateBattle>,
    battle_id: [u8; BATTLE_ID_LENGTH],
    args: CreateBattleArgs,
) -> Result<()> {
    validate_stats(args.player_hp, args.player_attack, args.player_defense)?;
    validate_stats(
        args.opponent_hp,
        args.opponent_attack,
        args.opponent_defense,
    )?;
    let battle = &mut ctx.accounts.battle;
    **battle = Battle {
        battle_id,
        player: ctx.accounts.player.key(),
        creature_hash: args.creature_hash,
        player_hp: args.player_hp,
        player_max_hp: args.player_hp,
        player_attack: args.player_attack,
        player_defense: args.player_defense,
        opponent_hp: args.opponent_hp,
        opponent_max_hp: args.opponent_hp,
        opponent_attack: args.opponent_attack,
        opponent_defense: args.opponent_defense,
        turn: 0,
        status: BattleStatus::Active,
        winner: Winner::None,
        progression_recorded: false,
        bump: ctx.bumps.battle,
    };
    emit!(BattleCreated {
        battle: battle.key(),
        player: battle.player,
        battle_id
    });
    Ok(())
}
