use anchor_lang::prelude::*;

use crate::constants::{LOSS_XP, WIN_XP};
use crate::errors::BattleError;
use crate::state::Winner;

#[account]
#[derive(InitSpace)]
pub struct PlayerProfile {
    pub authority: Pubkey,
    pub wins: u32,
    pub losses: u32,
    pub experience: u32,
    pub bump: u8,
}

impl PlayerProfile {
    pub fn record_result(&mut self, winner: Winner) -> Result<()> {
        match winner {
            Winner::Player => {
                self.wins = self.wins.checked_add(1).ok_or(BattleError::MathOverflow)?;
                self.experience = self
                    .experience
                    .checked_add(WIN_XP)
                    .ok_or(BattleError::MathOverflow)?;
            }
            Winner::Opponent => {
                self.losses = self
                    .losses
                    .checked_add(1)
                    .ok_or(BattleError::MathOverflow)?;
                self.experience = self
                    .experience
                    .checked_add(LOSS_XP)
                    .ok_or(BattleError::MathOverflow)?;
            }
            Winner::None => return err!(BattleError::BattleNotFinished),
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile() -> PlayerProfile {
        PlayerProfile {
            authority: Pubkey::default(),
            wins: 0,
            losses: 0,
            experience: 0,
            bump: 0,
        }
    }

    #[test]
    fn win_adds_win_and_xp() {
        let mut profile = profile();
        profile.record_result(Winner::Player).unwrap();
        assert_eq!(
            (profile.wins, profile.losses, profile.experience),
            (1, 0, WIN_XP)
        );
    }

    #[test]
    fn loss_adds_loss_and_xp() {
        let mut profile = profile();
        profile.record_result(Winner::Opponent).unwrap();
        assert_eq!(
            (profile.wins, profile.losses, profile.experience),
            (0, 1, LOSS_XP)
        );
    }

    #[test]
    fn missing_winner_does_not_change_progression() {
        let mut profile = profile();
        assert!(profile.record_result(Winner::None).is_err());
        assert_eq!(
            (profile.wins, profile.losses, profile.experience),
            (0, 0, 0)
        );
    }

    #[test]
    fn progression_overflow_returns_an_error() {
        let mut profile = profile();
        profile.wins = u32::MAX;
        assert!(profile.record_result(Winner::Player).is_err());
    }
}
