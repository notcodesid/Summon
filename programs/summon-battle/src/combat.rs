use crate::{
    constants::*,
    errors::BattleError,
    state::{Battle, Winner},
};
use anchor_lang::prelude::*;

pub fn validate_stats(hp: u16, attack: u16, defense: u16) -> Result<()> {
    require!(hp > 0 && hp <= MAX_HP, BattleError::InvalidHitPoints);
    require!(
        attack > 0 && attack <= MAX_ATTACK,
        BattleError::InvalidAttack
    );
    require!(defense <= MAX_DEFENSE, BattleError::InvalidDefense);
    Ok(())
}

pub fn damage(attack: u16, defense: u16) -> u16 {
    let value = u32::from(attack).saturating_mul(100) / (100 + u32::from(defense));
    u16::try_from(value.max(1)).unwrap_or(u16::MAX)
}

pub fn winner_by_health(battle: &Battle) -> Winner {
    let player = u32::from(battle.player_hp) * 10_000 / u32::from(battle.player_max_hp);
    let opponent = u32::from(battle.opponent_hp) * 10_000 / u32::from(battle.opponent_max_hp);
    if player >= opponent {
        Winner::Player
    } else {
        Winner::Opponent
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn damage_is_never_zero() {
        assert_eq!(damage(1, MAX_DEFENSE), 1);
    }
    #[test]
    fn defense_reduces_damage() {
        assert!(damage(100, 100) < damage(100, 0));
    }
}
