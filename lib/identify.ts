import { isRarity, statsFor, type Creature, type Rarity } from '@/lib/creatures'

/**
 * Turns a captured photo into a creature.
 *
 * Requires EXPO_PUBLIC_ANTHROPIC_API_KEY. Without a key, or when the API call
 * fails, identifyAnimal throws — there is no demo / fake creature path.
 */
const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? ''

export const isIdentifyLive = apiKey.length > 0

export type Identification = {
  isAnimal: boolean
  species: string
  commonName: string
  rarity: Rarity
  note: string
}

/**
 * Called over plain fetch rather than @anthropic-ai/sdk: the SDK imports
 * node:fs for its credential chain, which Metro cannot resolve in React
 * Native.
 *
 * The key ships in the app bundle. Fine for a local build; move this call
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

export class IdentifyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdentifyError'
  }
}

export async function identifyAnimal(base64Image: string): Promise<Identification> {
  if (!isIdentifyLive) {
    throw new IdentifyError('Animal identification is not configured.')
  }

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
    throw new IdentifyError(`Identification failed (${httpResponse.status}).`)
  }

  const response = (await httpResponse.json()) as {
    stop_reason?: string
    content?: { type: string; text?: string }[]
  }

  if (response.stop_reason === 'refusal') {
    throw new IdentifyError('Identification was refused.')
  }

  const text = response.content?.find((block) => block.type === 'text')
  if (!text?.text) {
    throw new IdentifyError('Identification returned no result.')
  }

  const parsed = JSON.parse(text.text) as Identification
  if (!parsed.isAnimal) {
    return {
      isAnimal: false,
      species: '',
      commonName: '',
      rarity: 'common',
      note: '',
    }
  }

  return {
    isAnimal: true,
    species: parsed.species,
    commonName: parsed.commonName,
    rarity: isRarity(parsed.rarity) ? parsed.rarity : 'common',
    note: parsed.note,
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
