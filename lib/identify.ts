import { isRarity, statsFor, type Creature, type Rarity } from '@/lib/creatures'

/**
 * Turns a captured photo into a creature.
 *
 * With EXPO_PUBLIC_ANTHROPIC_API_KEY set, Claude looks at the photo and names
 * the real animal. Without it, a demo creature is returned instead, so the
 * scan → collect loop always works. Any failure falls back the same way —
 * a recording should never stall on a network error.
 */
const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? ''

export const isIdentifyLive = apiKey.length > 0

export type Identification = {
  isAnimal: boolean
  species: string
  commonName: string
  rarity: Rarity
  note: string
  /** False when the result came from the offline demo path. */
  live: boolean
}

/**
 * Called over plain fetch rather than @anthropic-ai/sdk: the SDK imports
 * node:fs for its credential chain, which Metro cannot resolve in React
 * Native.
 *
 * The key ships in the app bundle. Fine for a demo build; move this call
 * behind a server before the app is distributed.
 */
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

const IDENTIFY_SCHEMA = {
  type: 'object',
  properties: {
    isAnimal: {
      type: 'boolean',
      description: 'True only if a real animal is clearly visible in the photo.',
    },
    species: {
      type: 'string',
      description:
        'Scientific or specific species name, e.g. "Vulpes vulpes". Empty string if no animal.',
    },
    commonName: {
      type: 'string',
      description: 'Everyday name, e.g. "Red Fox". Empty string if no animal.',
    },
    rarity: {
      type: 'string',
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      description:
        'How unlikely a person is to encounter this animal in daily life. A pigeon or house cat is common; a fox is rare; a wild big cat is legendary.',
    },
    note: {
      type: 'string',
      description:
        'One short, vivid sentence about the animal for the collection card.',
    },
  },
  required: ['isAnimal', 'species', 'commonName', 'rarity', 'note'],
  additionalProperties: false,
} as const

const PROMPT = `Identify the animal in this photo for a real-world creature-collecting game.

Judge rarity by how unlikely someone is to run into this animal while out walking, not by conservation status. If no animal is clearly visible, set isAnimal to false and leave the name fields empty.`

const DEMO_CREATURES: Omit<Identification, 'live'>[] = [
  {
    isAnimal: true,
    species: 'Columba livia',
    commonName: 'Rock Pigeon',
    rarity: 'common',
    note: 'Unbothered by traffic, weather, or you.',
  },
  {
    isAnimal: true,
    species: 'Sciurus carolinensis',
    commonName: 'Grey Squirrel',
    rarity: 'uncommon',
    note: 'Buries more than it will ever find again.',
  },
  {
    isAnimal: true,
    species: 'Vulpes vulpes',
    commonName: 'Red Fox',
    rarity: 'rare',
    note: 'Moves at the edge of streetlight, then is gone.',
  },
  {
    isAnimal: true,
    species: 'Bubo bubo',
    commonName: 'Eurasian Eagle-Owl',
    rarity: 'epic',
    note: 'Hears the field mouse before it decides to move.',
  },
]

function demoIdentification(seed: number): Identification {
  const pick = DEMO_CREATURES[seed % DEMO_CREATURES.length]
  return { ...pick, live: false }
}

export async function identifyAnimal(base64Image: string): Promise<Identification> {
  if (!isIdentifyLive) {
    return demoIdentification(base64Image.length)
  }

  try {
    const httpResponse = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16000,
        // Low effort keeps the scan snappy; identification is not a deep
        // reasoning task.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: IDENTIFY_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    })

    if (!httpResponse.ok) {
      return demoIdentification(base64Image.length)
    }

    const response = (await httpResponse.json()) as {
      stop_reason?: string
      content?: { type: string; text?: string }[]
    }

    if (response.stop_reason === 'refusal') {
      return demoIdentification(base64Image.length)
    }

    const text = response.content?.find((block) => block.type === 'text')
    if (!text?.text) {
      return demoIdentification(base64Image.length)
    }

    const parsed = JSON.parse(text.text) as Omit<Identification, 'live'>
    if (!parsed.isAnimal) {
      return { ...parsed, live: true }
    }

    return {
      isAnimal: true,
      species: parsed.species,
      commonName: parsed.commonName,
      rarity: isRarity(parsed.rarity) ? parsed.rarity : 'common',
      note: parsed.note,
      live: true,
    }
  } catch {
    return demoIdentification(base64Image.length)
  }
}

export function toCreature(
  identification: Identification,
  photoUri: string,
): Creature {
  const species = identification.species || identification.commonName
  return {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    species,
    commonName: identification.commonName,
    rarity: identification.rarity,
    stats: statsFor(species, identification.rarity),
    note: identification.note,
    photoUri,
    capturedAt: Date.now(),
  }
}
