/** Mirrors programs/summon-battle/src/combat.rs so the fight UI can preview hits. */

export function damage(attack: number, defense: number): number {
  const value = Math.floor((Math.max(0, attack) * 100) / (100 + Math.max(0, defense)))
  return Math.max(1, value)
}
