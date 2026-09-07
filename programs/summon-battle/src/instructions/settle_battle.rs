use crate::{constants::BATTLE_SEED, errors::BattleError, state::*};
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

#[commit]
#[derive(Accounts)]
pub struct SettleBattle<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [BATTLE_SEED, player.key().as_ref(), battle.battle_id.as_ref()],
        bump = battle.bump, has_one = player @ BattleError::UnauthorizedPlayer)]
    pub battle: Account<'info, Battle>,
}

pub fn settle_battle(ctx: Context<SettleBattle>) -> Result<()> {
    require!(
        ctx.accounts.battle.status == BattleStatus::Finished,
        BattleError::BattleNotFinished
    );
    ctx.accounts.battle.exit(&crate::ID)?;
    MagicIntentBundleBuilder::new(
        ctx.accounts.player.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.battle.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
