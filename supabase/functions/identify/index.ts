import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  clientIp,
  hashIdentifier,
  IDENTIFY_LIMITS,
  isIdentifyRateLimitCode,
  rateLimitMessage,
} from '../_shared/identify-protection.ts'
import { imageDataFromBase64, ImageValidationError } from '../_shared/image.ts'
import { AuthError, requirePrivyUserId } from '../_shared/privy.ts'
import { serviceClient } from '../_shared/supabase.ts'

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
  required: ['isAnimal', 'label', 'species', 'commonName', 'rarity', 'note', 'message'],
}

type RequestContext = {
  requestId: string
  startedAt: number
  supabase: ReturnType<typeof serviceClient>
}

async function finishRequest(
  context: RequestContext,
  outcome: 'succeeded' | 'failed',
  status: number,
  errorCode?: string,
  providerStatus?: number,
  detail?: Record<string, unknown>,
): Promise<void> {
  const { error } = await context.supabase
    .from('identify_request_log')
    .update({
      outcome,
      error_code: errorCode ?? null,
      http_status: status,
      latency_ms: Date.now() - context.startedAt,
      provider_status: providerStatus ?? null,
      detail: detail ?? {},
    })
    .eq('request_id', context.requestId)

  if (error) {
    console.error('identify abuse log update failed', error)
  }
}

async function loggedError(
  context: RequestContext,
  message: string,
  status: number,
  code: string,
  options?: {
    providerStatus?: number
    details?: Record<string, unknown>
    logDetail?: Record<string, unknown>
  },
): Promise<Response> {
  await finishRequest(context, 'failed', status, code, options?.providerStatus, options?.logDetail)
  return errorResponse(message, status, code, options?.details)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  }

  const startedAt = Date.now()
  let context: RequestContext | null = null

  try {
    const privyUserId = await requirePrivyUserId(req)
    const supabase = serviceClient()
    const requestId = crypto.randomUUID()
    const [userHash, ipHash] = await Promise.all([hashIdentifier(privyUserId), hashIdentifier(clientIp(req.headers))])
    const { data: rateRows, error: rateError } = await supabase.rpc('enforce_identify_rate_limit', {
      p_request_id: requestId,
      p_user_hash: userHash,
      p_ip_hash: ipHash,
      p_min_frequency_seconds: IDENTIFY_LIMITS.minFrequencySeconds,
      p_user_hour_limit: IDENTIFY_LIMITS.userHourLimit,
      p_user_day_limit: IDENTIFY_LIMITS.userDayLimit,
      p_ip_hour_limit: IDENTIFY_LIMITS.ipHourLimit,
    })

    if (rateError) {
      console.error('identify rate limit unavailable', rateError)
      return errorResponse('Scan protection is temporarily unavailable. Try again soon.', 503, 'RATE_LIMIT_UNAVAILABLE')
    }

    const decision = Array.isArray(rateRows) ? rateRows[0] : rateRows
    if (!decision?.allowed) {
      const code = isIdentifyRateLimitCode(decision?.error_code) ? decision.error_code : 'RATE_LIMIT_USER'
      const retryAfterSeconds = typeof decision?.retry_after_seconds === 'number' ? decision.retry_after_seconds : 60
      return errorResponse(rateLimitMessage(code), 429, code, {
        retryAfterSeconds,
      })
    }

    context = { requestId, startedAt, supabase }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return loggedError(context, 'Identify is not configured on the server', 503, 'IDENTIFY_NOT_CONFIGURED')
    }
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'

    let body: { imageBase64?: string }
    try {
      body = (await req.json()) as { imageBase64?: string }
    } catch {
      return loggedError(context, 'Request body is invalid.', 400, 'INVALID_REQUEST')
    }
    const { base64: pure } = imageDataFromBase64(body.imageBase64 ?? '')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IDENTIFY_LIMITS.providerTimeoutMs)
    let geminiRes: Response
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          signal: controller.signal,
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
    } catch (error) {
      if (controller.signal.aborted) {
        return loggedError(context, 'The scan took too long. Please try again.', 504, 'PROVIDER_TIMEOUT', {
          logDetail: {
            timeoutMs: IDENTIFY_LIMITS.providerTimeoutMs,
          },
        })
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      console.error('gemini error', geminiRes.status, detail.slice(0, 400))
      if (geminiRes.status === 429) {
        return loggedError(
          context,
          'Scan is busy right now. Wait a moment and try again.',
          429,
          'PROVIDER_RATE_LIMITED',
          { providerStatus: geminiRes.status },
        )
      }
      return loggedError(context, 'Could not scan this photo. Try again.', 502, 'PROVIDER_ERROR', {
        providerStatus: geminiRes.status,
      })
    }

    const geminiJson = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = geminiJson.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      return loggedError(context, 'Could not read that photo. Retake and try again.', 502, 'PROVIDER_INVALID_RESPONSE')
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
      return loggedError(context, 'Could not read that photo. Retake and try again.', 502, 'PROVIDER_INVALID_RESPONSE')
    }

    const label = (parsed.label || parsed.commonName || parsed.species || '').trim()
    const message = (parsed.message || '').trim()
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    const rarity = rarities.includes(parsed.rarity ?? '') ? parsed.rarity! : 'common'

    if (!parsed.isAnimal) {
      await finishRequest(context, 'succeeded', 200, undefined, geminiRes.status, {
        isAnimal: false,
      })
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

    await finishRequest(context, 'succeeded', 200, undefined, geminiRes.status, {
      isAnimal: true,
    })
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
      return errorResponse(err.message, 401, 'AUTH_REQUIRED')
    }
    if (err instanceof ImageValidationError) {
      const code = /too large/i.test(err.message) ? 'IMAGE_TOO_LARGE' : 'IMAGE_INVALID'
      if (context) {
        return loggedError(context, err.message, 413, code)
      }
      return errorResponse(err.message, 413, code)
    }
    console.error(err)
    if (context) {
      return loggedError(context, 'Identify failed', 500, 'IDENTIFY_FAILED')
    }
    return errorResponse('Identify failed', 500, 'IDENTIFY_FAILED')
  }
})
