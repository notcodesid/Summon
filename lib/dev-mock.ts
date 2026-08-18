import { Image } from 'react-native'
import { ANIMAL_IMAGES } from '@/lib/animal-images'
import { statsFor, type Creature, type Rarity } from '@/lib/creatures'

/**
 * Dev-only sanctuary seeding.
 *
 * The scan loop needs a real camera, so a simulator can never produce a
 * populated sanctuary. These creatures exist only in memory for the current
 * render — they are never written to AsyncStorage and never sent to Supabase,
 * so they cannot contaminate a real collection.
 *
 * Enable with EXPO_PUBLIC_DEV_MOCK_CREATURES=1 in .env (dev builds only).
 */
export const isMockCreaturesEnabled =
  __DEV__ && (process.env.EXPO_PUBLIC_DEV_MOCK_CREATURES === '1' || process.env.EXPO_PUBLIC_DEV_MOCK_CREATURES === 'true')

/** Matches the order of ANIMAL_IMAGES so each entry gets its own photo. */
const SPECIMENS: { commonName: string; species: string; rarity: Rarity }[] = [
  { commonName: 'Dog', species: 'Canis familiaris', rarity: 'common' },
  { commonName: 'House Cat', species: 'Felis catus', rarity: 'common' },
  { commonName: 'Red Fox', species: 'Vulpes vulpes', rarity: 'rare' },
  { commonName: 'Barn Owl', species: 'Tyto alba', rarity: 'epic' },
  { commonName: 'Rabbit', species: 'Oryctolagus cuniculus', rarity: 'uncommon' },
  { commonName: 'Roe Deer', species: 'Capreolus capreolus', rarity: 'uncommon' },
  { commonName: 'Grey Squirrel', species: 'Sciurus carolinensis', rarity: 'common' },
  { commonName: 'Horse', species: 'Equus caballus', rarity: 'uncommon' },
  { commonName: 'Cow', species: 'Bos taurus', rarity: 'common' },
  { commonName: 'Sheep', species: 'Ovis aries', rarity: 'common' },
]

/** Fixed base so arrival order — and therefore placement — is stable across reloads. */
const BASE_CAPTURED_AT = 1_700_000_000_000
const HOUR = 60 * 60 * 1000

function photoUriFor(index: number): string {
  const source = ANIMAL_IMAGES[index % ANIMAL_IMAGES.length]
  // Metro resolves a bundled asset to a URI the image loader can fetch.
  return Image.resolveAssetSource(source as number)?.uri ?? ''
}

export function mockCreatures(count = 12): Creature[] {
  return Array.from({ length: count }, (_, index) => {
    const spec = SPECIMENS[index % SPECIMENS.length]
    const suffix = index >= SPECIMENS.length ? ` ${Math.floor(index / SPECIMENS.length) + 1}` : ''
    const species = `${spec.species}${suffix}`
    const photoUri = photoUriFor(index)

    return {
      id: `mock-${index}`,
      species,
      commonName: `${spec.commonName}${suffix}`,
      rarity: spec.rarity,
      stats: statsFor(species, spec.rarity),
      note: 'Seeded locally for development. Not a real discovery.',
      photoUri,
      localPhotoUri: photoUri,
      capturedAt: BASE_CAPTURED_AT + index * HOUR,
    }
  })
}
