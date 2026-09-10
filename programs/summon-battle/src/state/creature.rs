use crate::constants::CATCH_ID_LENGTH;
use anchor_lang::prelude::*;

/// One caught animal, owned by a wallet. Photo bytes stay off-chain;
/// this account is the collectible card (species, rarity, stats, photo hash).
#[account]
#[derive(InitSpace)]
pub struct Creature {
    pub owner: Pubkey,
    pub catch_id: [u8; CATCH_ID_LENGTH],
    #[max_len(64)]
    pub species: String,
    #[max_len(64)]
    pub common_name: String,
    /// 0 common … 4 legendary
    pub rarity: u8,
    pub hp: u16,
    pub attack: u16,
    pub defense: u16,
    pub speed: u16,
    pub photo_hash: [u8; 32],
    pub captured_at: i64,
    pub bump: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_space_matches_client_rent_check() {
        assert_eq!(8 + Creature::INIT_SPACE, 242);
    }
}
