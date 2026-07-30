import { isRarity, statsFor, type Creature, type Rarity } from '@/lib/creatures'

/**
 * Turns a captured photo into a creature via Gemini vision.
 *
 * The model describes what it sees in free text — no hard-coded reject
 * categories or canned messages. Game fields (rarity tiers) stay constrained
 * only so collection/stats stay consistent.
 *
 * Set EXPO_PUBLIC_GEMINI_API_KEY in .env. The key ships in the app bundle —
 * fine for local demos; move this call behind a server before distribution.
 */
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? ''
const model = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.5-flash'

export const isIdentifyLive = apiKey.length > 0

export type Identification = {
  /** True only when a real living animal is clearly visible. */
  isAnimal: boolean
  /**
   * Short tag for what the model saw, always set.
   * Animal: common name. Non-animal: e.g. "code screenshot", "coffee mug".
   */
  label: string
  species: string
  commonName: string
  rarity: Rarity
  note: string
  /**
   * Player-facing line from the model (what it is / what to do next).
   * Always set when isAnimal is false; optional flavor when true.
   */
  message: string
}

const PROMPT = `You help Summon, a game where players photograph REAL living animals
in the world and collect them.

Look at the photo and decide for yourself what it shows. Do not force the
subject into a fixed category list — invent an accurate short label.

If a real living animal is clearly visible (pet or wild: mammal, bird, insect,
fish, reptile, etc.):
- isAnimal: true
- label: everyday animal name (e.g. "Red Fox")
- species: scientific or specific name when you can, else same as label
- commonName: everyday name
- rarity: how unlikely someone is to meet this animal while walking
  (common | uncommon | rare | epic | legendary)
  common = pigeon, house cat, dog, squirrel
  uncommon = deer, rabbit, owl at a distance
  rare = fox, hawk, coyote
  epic = unusual wild sighting
  legendary = extraordinary wild animal
- note: one short vivid sentence for the collection card
- message: optional short flavor line, or empty

If it is NOT a collectible real animal (code, UI, screenshot, object, person,
plant only, toy, drawing, food, blurry mess, empty scene, etc.):
- isAnimal: false
- label: short free-form tag for what you actually see
  (e.g. "code on a screen", "office chair", "person's hand", "houseplant")
- species: empty
- commonName: empty
- rarity: common
- note: empty
- message: one friendly sentence naming what you saw and telling the player
  to photograph a real living animal instead. Write this yourself — do not
  use a template. Never mention APIs, models, JSON, or errors.

Respond only with JSON matching the schema.`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isAnimal: { type: 'boolean' },
    label: {
      type: 'string',
      description: 'Short free-form tag for what is in the photo.',
    },
    species: { type: 'string' },
    commonName: { type: 'string' },
    rarity: {
      type: 'string',
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    },
    note: { type: 'string' },
    message: {
      type: 'string',
      description: 'Player-facing sentence from the model.',
    },
  },
  required: [
    'isAnimal',
    'label',
    'species',
    'commonName',
    'rarity',
    'note',
    'message',
  ],
} as const

export class IdentifyError extends Error {
  /** Always safe to show in the UI. */
  readonly userMessage: string

  constructor(userMessage: string, technical?: string) {
    super(technical ?? userMessage)
    this.name = 'IdentifyError'
    this.userMessage = userMessage
  }
}

function stripBase64Prefix(data: string): string {
  const marker = 'base64,'
  const idx = data.indexOf(marker)
  return idx >= 0 ? data.slice(idx + marker.length) : data
}

function endpoint(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
}

function friendlyHttpError(status: number, detail: string): IdentifyError {
  const lower = detail.toLowerCase()
  if (status === 429 || lower.includes('quota') || lower.includes('rate')) {
    return new IdentifyError(
      'Scan is busy right now — wait a moment and try again.',
      detail,
    )
  }
  if (status === 401 || status === 403) {
    return new IdentifyError(
      'Scan is not available right now — try again later.',
      detail,
    )
  }
  if (status >= 500) {
    return new IdentifyError(
      'Could not reach the scanner — check your connection and try again.',
      detail,
    )
  }
  return new IdentifyError(
    'Could not scan this photo — retake and try again.',
    detail || `HTTP ${status}`,
  )
}

export async function identifyAnimal(base64Image: string): Promise<Identification> {
  if (!isIdentifyLive) {
    throw new IdentifyError(
      'Animal scan is not set up on this build.',
      'Missing EXPO_PUBLIC_GEMINI_API_KEY',
    )
  }

  const pure = stripBase64Prefix(base64Image)
  if (!pure) {
    throw new IdentifyError('That photo did not come through — retake it.')
  }

  let httpResponse: Response
  try {
    httpResponse = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: pure,
                },
              },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    })
  } catch {
    throw new IdentifyError(
      'No connection — check the network and try scanning again.',
    )
  }

  if (!httpResponse.ok) {
    let detail = ''
    try {
      const errBody = (await httpResponse.json()) as {
        error?: { message?: string }
      }
      detail = errBody.error?.message ?? ''
    } catch {
      // ignore
    }
    throw friendlyHttpError(httpResponse.status, detail)
  }

  const response = (await httpResponse.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] }
      finishReason?: string
    }[]
  }

  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new IdentifyError('Could not read that photo — retake and try again.')
  }

  let parsed: {
    isAnimal?: boolean
    label?: string
    species?: string
    commonName?: string
    rarity?: string
    note?: string
    message?: string
  }
  try {
    parsed = JSON.parse(text) as typeof parsed
  } catch {
    throw new IdentifyError('Could not read that photo — retake and try again.')
  }

  const label = (parsed.label || parsed.commonName || parsed.species || '').trim()
  const message = (parsed.message || '').trim()

  if (!parsed.isAnimal) {
    return {
      isAnimal: false,
      label: label || 'unknown',
      species: '',
      commonName: '',
      rarity: 'common',
      note: '',
      message:
        message ||
        (label
          ? `That looks like ${label} — try photographing a real living animal.`
          : 'No real animal found — try again with a living animal.'),
    }
  }

  const commonName = (parsed.commonName || label || parsed.species || '').trim()
  const species = (parsed.species || commonName).trim()

  return {
    isAnimal: true,
    label: label || commonName,
    species,
    commonName,
    rarity: isRarity(parsed.rarity ?? '') ? (parsed.rarity as Rarity) : 'common',
    note: (parsed.note || '').trim(),
    message,
  }
}

export function toCreature(
  identification: Identification,
  photoUri: string,
  id?: string,
): Creature {
  const species = identification.species || identification.commonName
  const rarity = identification.rarity
  return {
    id: id ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    species,
    commonName: identification.commonName || species,
    rarity,
    stats: statsFor(species, rarity),
    note: identification.note,
    photoUri,
    capturedAt: Date.now(),
  }
}
