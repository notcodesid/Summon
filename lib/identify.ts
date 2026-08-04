import { isRarity, statsFor, type Creature, type Rarity } from '@/lib/creatures'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'

/**
 * Turns a captured photo into a creature via the server-side identify
 * Edge Function (Gemini key stays on the server).
 */

export const isIdentifyLive = isEdgeConfigured()

export type Identification = {
  isAnimal: boolean
  label: string
  species: string
  commonName: string
  rarity: Rarity
  note: string
  message: string
}

export class IdentifyError extends Error {
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

export async function identifyAnimal(base64Image: string): Promise<Identification> {
  if (!isIdentifyLive) {
    throw new IdentifyError(
      'Animal scan is not set up on this build.',
      'Missing Supabase / Edge Function config',
    )
  }

  const pure = stripBase64Prefix(base64Image)
  if (!pure) {
    throw new IdentifyError('That photo did not come through — retake it.')
  }

  try {
    const result = await callEdgeFunction<Identification>('identify', {
      imageBase64: pure,
    })

    if (!result.isAnimal) {
      return {
        isAnimal: false,
        label: (result.label || 'unknown').trim(),
        species: '',
        commonName: '',
        rarity: 'common',
        note: '',
        message:
          (result.message || '').trim() ||
          'No real animal found — try again with a living animal.',
      }
    }

    const commonName = (result.commonName || result.label || result.species || '').trim()
    const species = (result.species || commonName).trim()

    return {
      isAnimal: true,
      label: (result.label || commonName).trim(),
      species,
      commonName,
      rarity: isRarity(result.rarity) ? result.rarity : 'common',
      note: (result.note || '').trim(),
      message: (result.message || '').trim(),
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Identify failed'
    if (/not signed in/i.test(raw)) {
      throw new IdentifyError('Sign in to scan animals.', raw)
    }
    if (/busy|429/i.test(raw)) {
      throw new IdentifyError('Scan is busy right now — wait a moment and try again.', raw)
    }
    if (/network|fetch/i.test(raw)) {
      throw new IdentifyError('No connection — check the network and try scanning again.', raw)
    }
    throw new IdentifyError(
      raw.length < 120 ? raw : 'Could not scan this photo — retake and try again.',
      raw,
    )
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
