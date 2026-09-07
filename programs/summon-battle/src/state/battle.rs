use crate::constants::BATTLE_ID_LENGTH;
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
    pub opponent_hp: u16,
    pub opponent_max_hp: u16,
    pub opponent_attack: u16,
    pub opponent_defense: u16,
    pub turn: u8,
    pub status: BattleStatus,
    pub winner: Winner,
    pub bump: u8,
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
