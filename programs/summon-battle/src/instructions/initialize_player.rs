use anchor_lang::prelude::*;

use crate::constants::PLAYER_SEED;
use crate::state::PlayerProfile;

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlayerProfile::INIT_SPACE,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
    let profile = &mut ctx.accounts.player_profile;
    profile.authority = ctx.accounts.authority.key();
    profile.wins = 0;
    profile.losses = 0;
    profile.experience = 0;
    profile.bump = ctx.bumps.player_profile;
    Ok(())
}
