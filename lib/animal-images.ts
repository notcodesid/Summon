import type { ImageSourcePropType } from 'react-native'
import type { EcologicalClass } from '@/lib/battle-rules'

/**
 * Bundled Creative Commons animal photos, with the species each one depicts.
 *
 * These back both the wild rivals you can meet in battle and the regional
 * roster in the field guide. They are *specific individuals* of real species,
 * so the tables below name them exactly rather than pretending a stock photo
 * is some invented creature.
 *
 * Metro resolves `require` at build time, so the paths must be literal and the
 * files must exist. See `assets/animals/ATTRIBUTION.md` — these are Creative
 * Commons photos and must be reviewed or replaced before a public release.
 */

export type AnimalPhoto = {
  commonName: string
  species: string
  image: ImageSourcePropType
  /** Programme discriminant is derived from this via combat.ts CLASS_INDEX. */
  ecologicalClass: EcologicalClass
  /**
   * Other names the same animal comes back as. The vision model phrases species
   * differently run to run, so the field guide matches on these too rather than
   * on an exact string.
   */
  aliases: readonly string[]
}

export const ANIMAL_PHOTOS: AnimalPhoto[] = [
  {
    commonName: 'Domestic Dog',
    species: 'Canis familiaris',
    image: require('../assets/animals/dog.jpg'),
    ecologicalClass: 'urban',
    aliases: ['dog', 'canine', 'puppy', 'canis'],
  },
  {
    commonName: 'Domestic Cat',
    species: 'Felis catus',
    image: require('../assets/animals/cat.jpg'),
    ecologicalClass: 'urban',
    aliases: ['cat', 'feline', 'kitten', 'felis'],
  },
  {
    commonName: 'Red Fox',
    species: 'Vulpes vulpes',
    image: require('../assets/animals/fox.jpg'),
    ecologicalClass: 'wild',
    aliases: ['fox', 'vixen', 'vulpes'],
  },
  {
    commonName: 'Barn Owl',
    species: 'Tyto alba',
    image: require('../assets/animals/owl.jpg'),
    ecologicalClass: 'sky',
    aliases: ['owl', 'tyto'],
  },
  {
    commonName: 'European Rabbit',
    species: 'Oryctolagus cuniculus',
    image: require('../assets/animals/rabbit.jpg'),
    ecologicalClass: 'ground',
    aliases: ['rabbit', 'bunny', 'hare', 'oryctolagus'],
  },
  {
    commonName: 'Roe Deer',
    species: 'Capreolus capreolus',
    image: require('../assets/animals/deer.jpg'),
    ecologicalClass: 'wild',
    aliases: ['deer', 'doe', 'buck', 'capreolus'],
  },
  {
    commonName: 'Grey Squirrel',
    species: 'Sciurus carolinensis',
    image: require('../assets/animals/squirrel.jpg'),
    ecologicalClass: 'wild',
    aliases: ['squirrel', 'sciurus'],
  },
  {
    commonName: 'Horse',
    species: 'Equus caballus',
    image: require('../assets/animals/horse.jpg'),
    ecologicalClass: 'ground',
    aliases: ['horse', 'pony', 'foal', 'equus'],
  },
  {
    commonName: 'Cattle',
    species: 'Bos taurus',
    image: require('../assets/animals/cow.jpg'),
    ecologicalClass: 'ground',
    aliases: ['cow', 'bull', 'cattle', 'calf', 'bos'],
  },
  {
    commonName: 'Sheep',
    species: 'Ovis aries',
    image: require('../assets/animals/sheep.jpg'),
    ecologicalClass: 'ground',
    aliases: ['sheep', 'lamb', 'ewe', 'ram', 'ovis'],
  },
]

/** Just the images, in the same order. Used by the dev sanctuary seeding. */
export const ANIMAL_IMAGES: ImageSourcePropType[] = ANIMAL_PHOTOS.map((photo) => photo.image)

export function animalImageAt(index: number): ImageSourcePropType | undefined {
  return ANIMAL_IMAGES[index]
}

/** The photo for a field-guide entry, matched on the species it depicts. */
export function animalPhotoFor(species: string, commonName: string): AnimalPhoto | undefined {
  const wanted = species.trim().toLowerCase()
  return (
    ANIMAL_PHOTOS.find((photo) => photo.species.toLowerCase() === wanted) ??
    ANIMAL_PHOTOS.find((photo) => photo.commonName.toLowerCase() === commonName.trim().toLowerCase())
  )
}
