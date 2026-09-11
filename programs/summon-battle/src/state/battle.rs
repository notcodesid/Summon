use crate::constants::BATTLE_ID_LENGTH;
use crate::errors::BattleError;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Battle {
    pub battle_id: [u8; BATTLE_ID_LENGTH],
    pub player: Pubkey,
    pub creature_hash: [u8; 32],
    pub player_hp: u16,
    pub player_max_hp: u16,
    pub player_attack: u16,
    pub player_defense: u16,
    pub player_speed: u16,
    pub player_energy: u8,
    pub player_class: u8,
    pub player_trait: u8,
    pub opponent_hp: u16,
    pub opponent_max_hp: u16,
    pub opponent_attack: u16,
    pub opponent_defense: u16,
    pub opponent_speed: u16,
    pub opponent_class: u8,
    pub turn: u8,
    pub status: BattleStatus,
    pub winner: Winner,
    pub progression_recorded: bool,
    pub bump: u8,
}

#[cfg(test)]
mod space_tests {
    use super::*;

    #[test]
    fn account_space_matches_client_rent_check() {
        assert_eq!(8 + Battle::INIT_SPACE, 117);
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum BattleStatus {
    Active,
    Finished,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum Winner {
    None,
    Player,
    Opponent,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum BattleAction {
    Strike,
    Guard,
    Instinct,
}

impl Battle {
    pub fn claim_progression(&mut self) -> Result<Winner> {
        require!(
            self.status == BattleStatus::Finished,
            BattleError::BattleNotFinished
        );
        require!(
            !self.progression_recorded,
            BattleError::ProgressionAlreadyRecorded
        );
        require!(self.winner != Winner::None, BattleError::BattleNotFinished);
        self.progression_recorded = true;
        Ok(self.winner)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn finished_battle() -> Battle {
        Battle {
            battle_id: [0; BATTLE_ID_LENGTH],
            player: Pubkey::default(),
            creature_hash: [0; 32],
            player_hp: 1,
            player_max_hp: 1,
            player_attack: 1,
            player_defense: 1,
            player_speed: 1,
            player_energy: 0,
            player_class: 0,
            player_trait: 0,
            opponent_hp: 0,
            opponent_max_hp: 1,
            opponent_attack: 1,
            opponent_defense: 1,
            opponent_speed: 1,
            opponent_class: 0,
            turn: 1,
            status: BattleStatus::Finished,
            winner: Winner::Player,
            progression_recorded: false,
            bump: 0,
        }
    }

    #[test]
    fn progression_can_only_be_claimed_once() {
        let mut battle = finished_battle();
        assert_eq!(battle.claim_progression().unwrap(), Winner::Player);
        assert!(battle.claim_progression().is_err());
    }

    #[test]
    fn progression_rejects_unfinished_battles() {
        let mut battle = finished_battle();
        battle.status = BattleStatus::Active;
        battle.winner = Winner::None;
        assert!(battle.claim_progression().is_err());
        assert!(!battle.progression_recorded);
    }

    #[test]
    fn progression_rejects_a_missing_winner() {
        let mut battle = finished_battle();
        battle.winner = Winner::None;
        assert!(battle.claim_progression().is_err());
        assert!(!battle.progression_recorded);
    }
}
