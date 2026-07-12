#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_vrf_sdk::anchor::{vrf, vrf_callback};
use ephemeral_vrf_sdk::instructions::{
    create_request_high_priority_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use solana_sha256_hasher::hashv;

declare_id!("9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ");

pub const PLAYER_STATE_SEED: &[u8] = b"player";
pub const COLLECTIBLE_COUNT: usize = 10;
pub const HISTORY_CAPACITY: usize = 16;

#[ephemeral]
#[program]
pub mod summon {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        let authority = ctx.accounts.authority.key();

        if player.authority == Pubkey::default() {
            player.authority = authority;
            player.bump = ctx.bumps.player;
            emit!(PlayerInitialized {
                authority,
                player: player.key(),
            });
        } else {
            require_keys_eq!(
                player.authority,
                authority,
                SummonError::UnauthorizedAuthority
            );
        }

        Ok(())
    }

    pub fn delegate_player(ctx: Context<DelegatePlayer>) -> Result<()> {
        let authority = ctx.accounts.payer.key();
        let signer_seeds: &[&[u8]] = &[PLAYER_STATE_SEED, authority.as_ref()];

        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            signer_seeds,
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|account| account.key()),
                ..Default::default()
            },
        )?;

        emit!(PlayerDelegated {
            authority,
            player: ctx.accounts.pda.key(),
        });
        Ok(())
    }

    pub fn request_pull(ctx: Context<RequestPull>, client_seed: [u8; 32]) -> Result<()> {
        let clock = Clock::get()?;
        let authority = ctx.accounts.payer.key();
        let player_key = ctx.accounts.player.key();
        let nonce = ctx
            .accounts
            .player
            .request_nonce
            .checked_add(1)
            .ok_or(SummonError::ArithmeticOverflow)?;
        let nonce_bytes = nonce.to_le_bytes();
        let slot_bytes = clock.slot.to_le_bytes();
        let caller_seed = hashv(&[
            b"summon-pull-v1",
            authority.as_ref(),
            &nonce_bytes,
            &slot_bytes,
            &client_seed,
        ])
        .to_bytes();

        {
            let player = &mut ctx.accounts.player;
            require!(!player.pending, SummonError::PullAlreadyPending);
            player.request_nonce = nonce;
            player.pending_nonce = nonce;
            player.pending_caller_seed = caller_seed;
            player.pending = true;
        }

        let ix = create_request_high_priority_scoped_randomness_ix(RequestRandomnessParams {
            payer: authority,
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::ResolvePull::DISCRIMINATOR.to_vec(),
            caller_seed,
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: player_key,
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;

        emit!(PullRequested {
            authority,
            player: player_key,
            nonce,
            caller_seed,
        });
        Ok(())
    }

    pub fn resolve_pull(ctx: Context<ResolvePull>, randomness: [u8; 32]) -> Result<()> {
        let player = &mut ctx.accounts.player;
        let entry = player.apply_resolution(randomness, Clock::get()?.unix_timestamp)?;

        emit!(PullResolved {
            authority: player.authority,
            player: player.key(),
            nonce: entry.nonce,
            collectible_index: entry.collectible_index,
            roll: entry.roll,
            randomness,
        });
        Ok(())
    }

    pub fn commit_player(ctx: Context<CommitPlayer>) -> Result<()> {
        ctx.accounts.player.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.player.to_account_info()])
        .build_and_invoke()?;
        emit!(PlayerCommitted {
            authority: ctx.accounts.payer.key(),
            player: ctx.accounts.player.key(),
            undelegated: false,
        });
        Ok(())
    }

    pub fn commit_and_undelegate_player(ctx: Context<CommitPlayer>) -> Result<()> {
        ctx.accounts.player.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.player.to_account_info()])
        .build_and_invoke()?;
        emit!(PlayerCommitted {
            authority: ctx.accounts.payer.key(),
            player: ctx.accounts.player.key(),
            undelegated: true,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PlayerState::INIT_SPACE,
        seeds = [PLAYER_STATE_SEED, authority.key().as_ref()],
        bump
    )]
    // PlayerState includes the fixed proof-history ring buffer. Keep it on the
    // heap so Anchor's generated account validation stays below Solana's 4 KiB
    // stack-frame limit.
    pub player: Box<Account<'info, PlayerState>>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The delegation macro validates and delegates this program PDA.
    #[account(
        mut,
        del,
        seeds = [PLAYER_STATE_SEED, payer.key().as_ref()],
        bump
    )]
    pub pda: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestPull<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_STATE_SEED, payer.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == payer.key() @ SummonError::UnauthorizedAuthority
    )]
    pub player: Box<Account<'info, PlayerState>>,
    /// CHECK: Address constraint pins the queue to MagicBlock's delegated VRF queue.
    #[account(
        mut,
        address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE
    )]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct ResolvePull<'info> {
    #[account(mut)]
    pub player: Box<Account<'info, PlayerState>>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitPlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_STATE_SEED, payer.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == payer.key() @ SummonError::UnauthorizedAuthority
    )]
    pub player: Box<Account<'info, PlayerState>>,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerState {
    pub authority: Pubkey,
    pub inventory: [u16; COLLECTIBLE_COUNT],
    pub total_pulls: u64,
    pub request_nonce: u64,
    pub pending: bool,
    pub pending_nonce: u64,
    pub pending_caller_seed: [u8; 32],
    pub history_len: u8,
    pub history_cursor: u8,
    pub bump: u8,
    pub history: [PullEntry; HISTORY_CAPACITY],
}

impl PlayerState {
    fn apply_resolution(&mut self, randomness: [u8; 32], resolved_at: i64) -> Result<PullEntry> {
        require!(self.pending, SummonError::NoPullPending);
        require!(
            self.pending_nonce == self.request_nonce,
            SummonError::InvalidPendingRequest
        );

        let roll = sample_below(&randomness, 10_000, b"rarity")?;
        let collectible_index = collectible_for_roll(roll, &randomness)?;
        let inventory_slot = self
            .inventory
            .get_mut(usize::from(collectible_index))
            .ok_or(SummonError::InvalidCollectible)?;
        *inventory_slot = inventory_slot
            .checked_add(1)
            .ok_or(SummonError::ArithmeticOverflow)?;
        self.total_pulls = self
            .total_pulls
            .checked_add(1)
            .ok_or(SummonError::ArithmeticOverflow)?;

        let entry = PullEntry {
            nonce: self.pending_nonce,
            collectible_index,
            roll,
            resolved_at,
            randomness,
        };
        self.push_history(entry);
        self.pending = false;
        self.pending_nonce = 0;
        self.pending_caller_seed = [0; 32];
        Ok(entry)
    }

    fn push_history(&mut self, entry: PullEntry) {
        let cursor = usize::from(self.history_cursor);
        self.history[cursor] = entry;
        self.history_cursor = ((cursor + 1) % HISTORY_CAPACITY) as u8;
        self.history_len = self
            .history_len
            .saturating_add(1)
            .min(HISTORY_CAPACITY as u8);
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct PullEntry {
    pub nonce: u64,
    pub collectible_index: u8,
    pub roll: u16,
    pub resolved_at: i64,
    pub randomness: [u8; 32],
}

fn collectible_for_roll(roll: u16, randomness: &[u8; 32]) -> Result<u8> {
    let (start, count) = match roll {
        0..=5_999 => (0_u8, 4_u16),
        6_000..=8_999 => (4_u8, 3_u16),
        9_000..=9_899 => (7_u8, 2_u16),
        9_900..=9_999 => (9_u8, 1_u16),
        _ => return err!(SummonError::InvalidRoll),
    };
    let offset = sample_below(randomness, count, b"collectible")? as u8;
    start
        .checked_add(offset)
        .ok_or_else(|| error!(SummonError::ArithmeticOverflow))
}

/// Rejection sampling avoids modulo bias. Each retry hashes the previous entropy with
/// a domain separator; exhausting every candidate is cryptographically negligible and
/// fails closed instead of returning a biased result.
fn sample_below(randomness: &[u8; 32], upper: u16, domain: &[u8]) -> Result<u16> {
    require!(upper > 0, SummonError::InvalidRange);
    let mut entropy = *randomness;
    let range = u32::from(u16::MAX) + 1;
    let limit = range - (range % u32::from(upper));

    for round in 0_u8..8 {
        for bytes in entropy.chunks_exact(2) {
            let value = u32::from(u16::from_le_bytes([bytes[0], bytes[1]]));
            if value < limit {
                return Ok((value % u32::from(upper)) as u16);
            }
        }
        entropy = hashv(&[b"summon-sample-v1", domain, &[round], &entropy]).to_bytes();
    }

    err!(SummonError::EntropyExhausted)
}

#[event]
pub struct PlayerInitialized {
    pub authority: Pubkey,
    pub player: Pubkey,
}

#[event]
pub struct PlayerDelegated {
    pub authority: Pubkey,
    pub player: Pubkey,
}

#[event]
pub struct PlayerCommitted {
    pub authority: Pubkey,
    pub player: Pubkey,
    pub undelegated: bool,
}

#[event]
pub struct PullRequested {
    pub authority: Pubkey,
    pub player: Pubkey,
    pub nonce: u64,
    pub caller_seed: [u8; 32],
}

#[event]
pub struct PullResolved {
    pub authority: Pubkey,
    pub player: Pubkey,
    pub nonce: u64,
    pub collectible_index: u8,
    pub roll: u16,
    pub randomness: [u8; 32],
}

#[error_code]
pub enum SummonError {
    #[msg("This wallet does not control the player account")]
    UnauthorizedAuthority,
    #[msg("A pull is already waiting for a VRF callback")]
    PullAlreadyPending,
    #[msg("There is no pull waiting for a VRF callback")]
    NoPullPending,
    #[msg("The pending request does not match the latest request nonce")]
    InvalidPendingRequest,
    #[msg("The VRF output produced an invalid rarity roll")]
    InvalidRoll,
    #[msg("The selected collectible is outside the catalog")]
    InvalidCollectible,
    #[msg("The sampling upper bound must be greater than zero")]
    InvalidRange,
    #[msg("Unbiased sampling exhausted its entropy candidates")]
    EntropyExhausted,
    #[msg("An arithmetic operation overflowed")]
    ArithmeticOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entropy(first: u16, second: u16) -> [u8; 32] {
        let mut bytes = [0_u8; 32];
        bytes[0..2].copy_from_slice(&first.to_le_bytes());
        bytes[2..4].copy_from_slice(&second.to_le_bytes());
        bytes
    }

    #[test]
    fn rarity_boundaries_map_to_the_expected_catalog_tiers() {
        let cases = [
            (0, 0, 3),
            (5_999, 0, 3),
            (6_000, 4, 6),
            (8_999, 4, 6),
            (9_000, 7, 8),
            (9_899, 7, 8),
            (9_900, 9, 9),
            (9_999, 9, 9),
        ];

        for (roll, low, high) in cases {
            let selected = collectible_for_roll(roll, &entropy(1, 2)).unwrap();
            assert!((low..=high).contains(&selected));
        }
    }

    #[test]
    fn all_rolls_stay_inside_the_ten_item_catalog() {
        for roll in 0..10_000 {
            let selected = collectible_for_roll(roll, &entropy(roll, roll + 1)).unwrap();
            assert!(usize::from(selected) < COLLECTIBLE_COUNT);
        }
    }

    #[test]
    fn sample_below_rejects_biased_tail_values() {
        let sampled = sample_below(&entropy(u16::MAX, 12_345), 10_000, b"test").unwrap();
        assert_eq!(sampled, 2_345);
    }

    #[test]
    fn history_is_bounded_and_wraps_in_order() {
        let mut player = player_state();

        for nonce in 1..=(HISTORY_CAPACITY as u64 + 3) {
            player.push_history(PullEntry {
                nonce,
                ..PullEntry::default()
            });
        }

        assert_eq!(player.history_len, HISTORY_CAPACITY as u8);
        assert_eq!(player.history_cursor, 3);
        assert_eq!(player.history[0].nonce, HISTORY_CAPACITY as u64 + 1);
        assert_eq!(player.history[2].nonce, HISTORY_CAPACITY as u64 + 3);
    }

    #[test]
    fn resolution_updates_inventory_once_and_rejects_duplicates() {
        let mut player = player_state();
        player.request_nonce = 1;
        player.pending_nonce = 1;
        player.pending = true;

        let entry = player.apply_resolution(entropy(6_000, 1), 123).unwrap();
        assert_eq!(player.total_pulls, 1);
        assert_eq!(
            player.inventory.iter().copied().map(u32::from).sum::<u32>(),
            1
        );
        assert_eq!(entry.nonce, 1);
        assert_eq!(entry.resolved_at, 123);
        assert!(!player.pending);

        assert!(player.apply_resolution(entropy(9_999, 2), 124).is_err());
        assert_eq!(player.total_pulls, 1);
    }

    fn player_state() -> PlayerState {
        PlayerState {
            authority: Pubkey::new_unique(),
            inventory: [0; COLLECTIBLE_COUNT],
            total_pulls: 0,
            request_nonce: 0,
            pending: false,
            pending_nonce: 0,
            pending_caller_seed: [0; 32],
            history_len: 0,
            history_cursor: 0,
            bump: 0,
            history: [PullEntry::default(); HISTORY_CAPACITY],
        }
    }

    #[test]
    fn account_space_matches_serialized_shape() {
        assert_eq!(PlayerState::INIT_SPACE, 928);
        assert_eq!(PullEntry::INIT_SPACE, 51);
    }
}
