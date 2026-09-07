use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod combat;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4qAXXzaqXXREMcWtSxyDG8p7MgVFFGA34wwvZvxxZRgu");

#[ephemeral]
#[program]
pub mod summon_battle {
    use super::*;

    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        instructions::initialize_player::initialize_player(ctx)
    }

    pub fn create_battle(
        ctx: Context<CreateBattle>,
        battle_id: [u8; 16],
        args: CreateBattleArgs,
    ) -> Result<()> {
        instructions::create_battle::create_battle(ctx, battle_id, args)
    }
    pub fn delegate_battle(ctx: Context<DelegateBattle>, battle_id: [u8; 16]) -> Result<()> {
        instructions::delegate_battle::delegate_battle(ctx, battle_id)
    }
    pub fn attack(ctx: Context<PlayTurn>) -> Result<()> {
        instructions::play_turn::play_turn(ctx)
    }
    pub fn settle_battle(ctx: Context<SettleBattle>) -> Result<()> {
        instructions::settle_battle::settle_battle(ctx)
    }

    pub fn update_progression(ctx: Context<UpdateProgression>, battle_id: [u8; 16]) -> Result<()> {
        instructions::update_progression::update_progression(ctx, battle_id)
    }
}
