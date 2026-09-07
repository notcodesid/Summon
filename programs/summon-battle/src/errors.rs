use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Hit points must be between 1 and 500")]
    InvalidHitPoints,
    #[msg("Attack must be between 1 and 250")]
    InvalidAttack,
    #[msg("Defense cannot exceed 250")]
    InvalidDefense,
    #[msg("Only the battle owner can perform this action")]
    UnauthorizedPlayer,
    #[msg("The battle is not active")]
    BattleNotActive,
    #[msg("The battle has reached its turn limit")]
    TurnLimitReached,
    #[msg("The battle must finish before settlement")]
    BattleNotFinished,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
