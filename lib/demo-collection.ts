import { Image } from 'react-native'
import { statsFor, type Creature, type Rarity } from '@/lib/creatures'

/**
 * Sample animals for demos and empty-state screenshots.
 *
 * Shown only when the player has nothing saved yet — real catches replace this
 * list entirely. Photos come from `assets/animals/` (see ATTRIBUTION.md).
 *
 * Disable with EXPO_PUBLIC_DEMO_COLLECTION=0.
 */
export const isDemoCollectionEnabled =
  (process.env.EXPO_PUBLIC_DEMO_COLLECTION ?? '1') !== '0'

type DemoSeed = {
  id: string
  species: string
  commonName: string
  rarity: Rarity
  note: string
  /** Metro asset module from a literal require(). */
  image: number
  /** Hours ago — keeps newest-first order stable. */
  hoursAgo: number
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    id: 'demo-fox',
    species: 'Vulpes vulpes',
    commonName: 'Red Fox',
    rarity: 'rare',
    note: 'Moves at the edge of streetlight, then is gone.',
    image: require('../assets/animals/fox.jpg'),
    hoursAgo: 2,
  },
  {
    id: 'demo-owl',
    species: 'Bubo bubo',
    commonName: 'Eurasian Eagle-Owl',
    rarity: 'epic',
    note: 'Hears the field mouse before it decides to move.',
    image: require('../assets/animals/owl.jpg'),
    hoursAgo: 5,
  },
  {
    id: 'demo-deer',
    species: 'Odocoileus virginianus',
    commonName: 'White-tailed Deer',
    rarity: 'uncommon',
    note: 'Still as a photograph until the trail crackles.',
    image: require('../assets/animals/deer.jpg'),
    hoursAgo: 12,
  },
  {
    id: 'demo-squirrel',
    species: 'Sciurus carolinensis',
    commonName: 'Grey Squirrel',
    rarity: 'uncommon',
    note: 'Buries more than it will ever find again.',
    image: require('../assets/animals/squirrel.jpg'),
    hoursAgo: 18,
  },
  {
    id: 'demo-rabbit',
    species: 'Oryctolagus cuniculus',
    commonName: 'European Rabbit',
    rarity: 'common',
    note: 'Ears first, then the rest of the field.',
    image: require('../assets/animals/rabbit.jpg'),
    hoursAgo: 26,
  },
  {
    id: 'demo-dog',
    species: 'Canis familiaris',
    commonName: 'Dog',
    rarity: 'common',
    note: 'Already decided you are friends.',
    image: require('../assets/animals/dog.jpg'),
    hoursAgo: 36,
  },
  {
    id: 'demo-cat',
    species: 'Felis catus',
    commonName: 'Cat',
    rarity: 'common',
    note: 'Owns the windowsill and knows it.',
    image: require('../assets/animals/cat.jpg'),
    hoursAgo: 48,
  },
  {
    id: 'demo-horse',
    species: 'Equus ferus caballus',
    commonName: 'Horse',
    rarity: 'uncommon',
    note: 'A whole weather system of muscle and breath.',
    image: require('../assets/animals/horse.jpg'),
    hoursAgo: 60,
  },
]

function assetUri(module: number): string {
  const resolved = Image.resolveAssetSource(module)
  return resolved?.uri ?? ''
}

/** Newest first. Stable ids so list keys do not thrash between renders. */
export function getDemoCollection(): Creature[] {
  const now = Date.now()
  return DEMO_SEEDS.map((seed) => ({
    id: seed.id,
    species: seed.species,
    commonName: seed.commonName,
    rarity: seed.rarity,
    stats: statsFor(seed.species, seed.rarity),
    note: seed.note,
    photoUri: assetUri(seed.image),
    capturedAt: now - seed.hoursAgo * 60 * 60 * 1000,
  }))
}
