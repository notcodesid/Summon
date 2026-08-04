import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { AuthError, requirePrivyUserId } from '../_shared/privy.ts'

/**
 * POST /functions/v1/identify
 * Auth: Privy access token
 * Body: { imageBase64: string }
 *
 * Proxies Gemini vision so the API key never ships in the mobile app.
 */
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
- species: empty
- commonName: empty
- rarity: common
- note: empty
- message: one friendly sentence naming what you saw and telling the player
  to photograph a real living animal instead. Write this yourself.
  Never mention APIs, models, JSON, or errors.

Respond only with JSON matching the schema.`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isAnimal: { type: 'boolean' },
    label: { type: 'string' },
    species: { type: 'string' },
    commonName: { type: 'string' },
    rarity: {
      type: 'string',
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    },
    note: { type: 'string' },
    message: { type: 'string' },
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
}

function stripBase64Prefix(data: string): string {
  const marker = 'base64,'
  const idx = data.indexOf(marker)
  return idx >= 0 ? data.slice(idx + marker.length) : data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    await requirePrivyUserId(req)

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return errorResponse('Identify is not configured on the server', 503)
    }
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'

    const body = (await req.json()) as { imageBase64?: string }
    const pure = stripBase64Prefix(body.imageBase64 ?? '')
    if (!pure) {
      return errorResponse('Missing imageBase64', 400)
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
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
      },
    )

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      console.error('gemini error', geminiRes.status, detail.slice(0, 400))
      if (geminiRes.status === 429) {
        return errorResponse('Scan is busy right now — wait a moment and try again.', 429)
      }
      return errorResponse('Could not scan this photo — try again.', 502)
    }

    const geminiJson = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = geminiJson.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      return errorResponse('Could not read that photo — retake and try again.', 502)
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
      parsed = JSON.parse(text)
    } catch {
      return errorResponse('Could not read that photo — retake and try again.', 502)
    }

    const label = (parsed.label || parsed.commonName || parsed.species || '').trim()
    const message = (parsed.message || '').trim()
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    const rarity = rarities.includes(parsed.rarity ?? '') ? parsed.rarity! : 'common'

    if (!parsed.isAnimal) {
      return jsonResponse({
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
      })
    }

    const commonName = (parsed.commonName || label || parsed.species || '').trim()
    const species = (parsed.species || commonName).trim()

    return jsonResponse({
      isAnimal: true,
      label: label || commonName,
      species,
      commonName,
      rarity,
      note: (parsed.note || '').trim(),
      message,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.message, 401)
    }
    console.error(err)
    return errorResponse('Identify failed', 500)
  }
})
