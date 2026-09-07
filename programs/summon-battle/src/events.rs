use crate::{constants::BATTLE_ID_LENGTH, state::Winner};
use anchor_lang::prelude::*;

#[event]
pub struct BattleCreated {
    pub battle: Pubkey,
    pub player: Pubkey,
    pub battle_id: [u8; BATTLE_ID_LENGTH],
}

#[event]
pub struct TurnResolved {
    pub battle: Pubkey,
    pub turn: u8,
    pub damage_to_opponent: u16,
    pub damage_to_player: u16,
    pub player_hp: u16,
    pub opponent_hp: u16,
    pub winner: Winner,
}
