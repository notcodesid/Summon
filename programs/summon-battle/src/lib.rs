use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod combat;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::BattleAction;

declare_id!("6YdQKUGoeaT1LmuF4PJMRYMMQo1dvW7JNYzAS3CZgoeA");

#[ephemeral]
#[program]
pub mod summon_battle {
    use super::*;

    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        instructions::initialize_player::initialize_player(ctx)
    }

    pub fn collect_creature(
        ctx: Context<CollectCreature>,
        catch_id: [u8; 16],
        args: CollectCreatureArgs,
    ) -> Result<()> {
        instructions::collect_creature::collect_creature(ctx, catch_id, args)
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
    pub fn attack(ctx: Context<PlayTurn>, action: BattleAction) -> Result<()> {
        instructions::play_turn::play_turn(ctx, action)
    }
    pub fn settle_battle(ctx: Context<SettleBattle>) -> Result<()> {
        instructions::settle_battle::settle_battle(ctx)
    }

    pub fn update_progression(ctx: Context<UpdateProgression>, battle_id: [u8; 16]) -> Result<()> {
        instructions::update_progression::update_progression(ctx, battle_id)
    }
}
