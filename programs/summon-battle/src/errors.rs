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
    #[msg("Battle progression has already been recorded")]
    ProgressionAlreadyRecorded,
    #[msg("Battle account is not owned by the Summon program")]
    InvalidBattleOwner,
    #[msg("Rarity must be between 0 (common) and 4 (legendary)")]
    InvalidRarity,
    #[msg("Species name is empty or longer than 64 bytes")]
    InvalidSpecies,
    #[msg("Common name is empty or longer than 64 bytes")]
    InvalidCommonName,
    #[msg("Speed must be between 1 and 250")]
    InvalidSpeed,
    #[msg("Photo hash cannot be empty")]
    InvalidPhotoHash,
    #[msg("Capture time must be greater than zero")]
    InvalidCatchTime,
    #[msg("Instinct requires two energy")]
    InsufficientEnergy,
    #[msg("Ecological class must be between 0 and 5")]
    InvalidEcologicalClass,
    #[msg("Passive trait must be between 0 and 4")]
    InvalidPassiveTrait,
}
