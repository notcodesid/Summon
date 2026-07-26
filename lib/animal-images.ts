import type { ImageSourcePropType } from 'react-native'

/**
 * Photos shown inside the sign-in hero orbs.
 *
 * Metro resolves these at build time, so the paths must be literal and the
 * files must exist. Orbs beyond the end of this list fall back to their icon.
 *
 * Order matches the orb order in `components/specimen-orbs.tsx`: the first
 * entries sit nearest the logo and are emitted first.
 *
 * See `assets/animals/ATTRIBUTION.md` — these are Creative Commons photos and
 * must be reviewed or replaced before a public release.
 */
export const ANIMAL_IMAGES: ImageSourcePropType[] = [
  require('../assets/animals/dog.jpg'),
  require('../assets/animals/cat.jpg'),
  require('../assets/animals/fox.jpg'),
  require('../assets/animals/owl.jpg'),
  require('../assets/animals/rabbit.jpg'),
  require('../assets/animals/deer.jpg'),
  require('../assets/animals/squirrel.jpg'),
  require('../assets/animals/horse.jpg'),
  require('../assets/animals/cow.jpg'),
  require('../assets/animals/sheep.jpg'),
]

export function animalImageAt(index: number): ImageSourcePropType | undefined {
  return ANIMAL_IMAGES[index]
}
