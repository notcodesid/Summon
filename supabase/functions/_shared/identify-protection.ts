export const IDENTIFY_LIMITS = {
  minFrequencySeconds: 4,
  userHourLimit: 20,
  userDayLimit: 75,
  ipHourLimit: 60,
  providerTimeoutMs: 60_000,
} as const

export type IdentifyRateLimitCode = 'RATE_LIMIT_FREQUENCY' | 'RATE_LIMIT_USER' | 'RATE_LIMIT_IP'

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim() || forwarded || 'unknown'
}

export async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function rateLimitMessage(code: IdentifyRateLimitCode): string {
  if (code === 'RATE_LIMIT_FREQUENCY') {
    return 'Please wait a few seconds before scanning again.'
  }
  if (code === 'RATE_LIMIT_IP') {
    return 'Too many scans are coming from this network. Try again later.'
  }
  return 'You have reached the scan limit for now. Try again later.'
}

export function isIdentifyRateLimitCode(value: unknown): value is IdentifyRateLimitCode {
  return value === 'RATE_LIMIT_FREQUENCY' || value === 'RATE_LIMIT_USER' || value === 'RATE_LIMIT_IP'
}
