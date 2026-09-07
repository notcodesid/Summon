use crate::constants::*;
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

#[delegate]
#[derive(Accounts)]
#[instruction(battle_id: [u8; BATTLE_ID_LENGTH])]
pub struct DelegateBattle<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    /// CHECK: PDA seeds bind the battle to the signing player.
    #[account(mut, del, seeds = [BATTLE_SEED, player.key().as_ref(), battle_id.as_ref()], bump)]
    pub pda: UncheckedAccount<'info>,
}

pub fn delegate_battle(
    ctx: Context<DelegateBattle>,
    battle_id: [u8; BATTLE_ID_LENGTH],
) -> Result<()> {
    ctx.accounts.delegate_pda(
        &ctx.accounts.player,
        &[BATTLE_SEED, ctx.accounts.player.key.as_ref(), &battle_id],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|a| a.key()),
            ..Default::default()
        },
    )?;
    Ok(())
}
