use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::action;

use crate::constants::{ACTION_ESCROW_INDEX, BATTLE_ID_LENGTH, BATTLE_SEED, PLAYER_SEED};
use crate::errors::BattleError;
use crate::state::{Battle, PlayerProfile};

#[action]
#[derive(Accounts)]
#[instruction(battle_id: [u8; BATTLE_ID_LENGTH])]
pub struct UpdateProgression<'info> {
    #[account(
        mut,
        seeds = [PLAYER_SEED, player_profile.authority.as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    /// CHECK: The account is manually owner-checked and deserialized because a
    /// committed account can transition ownership during the action pipeline.
    #[account(
        mut,
        seeds = [BATTLE_SEED, player_profile.authority.as_ref(), battle_id.as_ref()],
        bump
    )]
    pub battle: UncheckedAccount<'info>,
    /// CHECK: Bound to the profile owner so a foreign program cannot schedule
    /// this handler using a different escrow authority.
    #[account(address = player_profile.authority)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: Only MagicBlock's delegation program can sign for this PDA.
    #[account(
        signer,
        address = ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer(
            &escrow_auth.key(),
            ACTION_ESCROW_INDEX,
        )
    )]
    pub escrow: UncheckedAccount<'info>,
}

pub fn update_progression(
    ctx: Context<UpdateProgression>,
    _battle_id: [u8; BATTLE_ID_LENGTH],
) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.battle.owner,
        crate::ID,
        BattleError::InvalidBattleOwner
    );

    let battle_info = ctx.accounts.battle.to_account_info();
    let mut data = battle_info.try_borrow_mut_data()?;
    let mut read_slice: &[u8] = &data;
    let mut battle = Battle::try_deserialize(&mut read_slice)?;

    require_keys_eq!(
        battle.player,
        ctx.accounts.player_profile.authority,
        BattleError::UnauthorizedPlayer
    );

    let winner = battle.claim_progression()?;
    ctx.accounts.player_profile.record_result(winner)?;
    battle.try_serialize(&mut &mut data[..])?;
    Ok(())
}
