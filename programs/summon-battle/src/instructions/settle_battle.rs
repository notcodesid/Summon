use anchor_lang::{prelude::*, InstructionData};
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{CallHandler, FoldableIntentBuilder, MagicIntentBundleBuilder},
    ActionArgs, ShortAccountMeta,
};

use crate::{
    constants::{BATTLE_ID_LENGTH, BATTLE_SEED, PLAYER_SEED},
    errors::BattleError,
    state::{Battle, BattleStatus},
};

#[commit]
#[derive(Accounts)]
pub struct SettleBattle<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [BATTLE_SEED, player.key().as_ref(), battle.battle_id.as_ref()],
        bump = battle.bump,
        has_one = player @ BattleError::UnauthorizedPlayer
    )]
    pub battle: Account<'info, Battle>,
    /// CHECK: Base-layer profile updated by the authenticated post-commit action.
    #[account(seeds = [PLAYER_SEED, player.key().as_ref()], bump)]
    pub player_profile: UncheckedAccount<'info>,
    /// CHECK: The scheduled action can only target this program.
    #[account(address = crate::ID)]
    pub program_id: UncheckedAccount<'info>,
}

pub fn settle_battle(ctx: Context<SettleBattle>) -> Result<()> {
    require!(
        ctx.accounts.battle.status == BattleStatus::Finished,
        BattleError::BattleNotFinished
    );
    ctx.accounts.battle.exit(&crate::ID)?;

    let battle_id: [u8; BATTLE_ID_LENGTH] = ctx.accounts.battle.battle_id;
    let instruction_data = crate::instruction::UpdateProgression { battle_id }.data();
    let action = CallHandler {
        destination_program: crate::ID,
        accounts: vec![
            ShortAccountMeta {
                pubkey: ctx.accounts.player_profile.key().to_bytes().into(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: ctx.accounts.battle.key().to_bytes().into(),
                is_writable: true,
            },
        ],
        args: ActionArgs::new(instruction_data),
        escrow_authority: ctx.accounts.player.to_account_info(),
        compute_units: 200_000,
    };

    MagicIntentBundleBuilder::new(
        ctx.accounts.player.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.battle.to_account_info()])
    .add_post_commit_actions([action])
    .build_and_invoke()?;
    Ok(())
}
