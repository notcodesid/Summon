use crate::{
    combat::validate_stats,
    constants::*,
    errors::BattleError,
    events::CreatureCollected,
    state::Creature,
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CollectCreatureArgs {
    pub species: String,
    pub common_name: String,
    pub rarity: u8,
    pub hp: u16,
    pub attack: u16,
    pub defense: u16,
    pub speed: u16,
    pub photo_hash: [u8; 32],
    pub captured_at: i64,
}

#[derive(Accounts)]
#[instruction(catch_id: [u8; CATCH_ID_LENGTH])]
pub struct CollectCreature<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Creature::INIT_SPACE,
        seeds = [CREATURE_SEED, owner.key().as_ref(), catch_id.as_ref()],
        bump
    )]
    pub creature: Account<'info, Creature>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn collect_creature(
    ctx: Context<CollectCreature>,
    catch_id: [u8; CATCH_ID_LENGTH],
    args: CollectCreatureArgs,
) -> Result<()> {
    require!(args.rarity <= MAX_RARITY, BattleError::InvalidRarity);
    require!(
        args.speed > 0 && args.speed <= MAX_SPEED,
        BattleError::InvalidSpeed
    );
    require!(args.photo_hash != [0u8; 32], BattleError::InvalidPhotoHash);
    require!(args.captured_at > 0, BattleError::InvalidCatchTime);

    let species = args.species.trim();
    require!(
        !species.is_empty() && species.len() <= MAX_NAME_LEN,
        BattleError::InvalidSpecies
    );
    let common_name = args.common_name.trim();
    require!(
        !common_name.is_empty() && common_name.len() <= MAX_NAME_LEN,
        BattleError::InvalidCommonName
    );
    validate_stats(args.hp, args.attack, args.defense)?;

    let creature = &mut ctx.accounts.creature;
    creature.owner = ctx.accounts.owner.key();
    creature.catch_id = catch_id;
    creature.species = species.to_string();
    creature.common_name = common_name.to_string();
    creature.rarity = args.rarity;
    creature.hp = args.hp;
    creature.attack = args.attack;
    creature.defense = args.defense;
    creature.speed = args.speed;
    creature.photo_hash = args.photo_hash;
    creature.captured_at = args.captured_at;
    creature.bump = ctx.bumps.creature;

    emit!(CreatureCollected {
        creature: creature.key(),
        owner: creature.owner,
        catch_id,
        rarity: creature.rarity,
    });
    Ok(())
}
