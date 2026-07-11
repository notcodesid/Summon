export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export type Collectible = {
  id: string
  name: string
  lore: string
  rarity: Rarity
  symbol: string
  accent: string
}

export type PullRecord = {
  id: string
  collectibleId: string
  createdAt: string
  roll: number
  seed: string
  signature: string
  status: 'verified'
}

export type OwnedCollectible = { collectibleId: string; quantity: number; firstReceivedAt: string }
