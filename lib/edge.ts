import { getSessionAccessToken } from '@/lib/session-token'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export class EdgeFunctionError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'EdgeFunctionError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isEdgeConfigured(): boolean {
  return supabaseUrl.length > 0 && anonKey.length > 0
}

export function edgeFunctionUrl(name: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`
}

/**
 * Call a Supabase Edge Function with the caller's Privy access token.
 * Uses the anon key only as the gateway apikey (required by Supabase).
 */
export async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  if (!isEdgeConfigured()) {
    throw new Error('Supabase is not configured')
  }

  const privyToken = await getSessionAccessToken()
  if (!privyToken) {
    throw new Error('Not signed in')
  }

  const response = await fetch(edgeFunctionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${privyToken}`,
      apikey: anonKey,
      'x-privy-token': privyToken,
    },
    body: JSON.stringify(body),
  })

  const json = (await response.json().catch(() => ({}))) as {
    error?: string
    code?: string
    details?: Record<string, unknown>
  } & T

  if (!response.ok) {
    throw new EdgeFunctionError(
      json.error || `Request failed (${response.status})`,
      json.code || 'REQUEST_FAILED',
      response.status,
      json.details,
    )
  }

  return json as T
}
