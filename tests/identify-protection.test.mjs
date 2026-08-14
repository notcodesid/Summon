import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clientIp,
  hashIdentifier,
  IDENTIFY_LIMITS,
  isIdentifyRateLimitCode,
  rateLimitMessage,
} from '../supabase/functions/_shared/identify-protection.ts'

test('prefers the edge-proxy address for per-IP limits', () => {
  const headers = new Headers({
    'cf-connecting-ip': '192.0.2.12',
    'x-forwarded-for': '203.0.113.9, 10.0.0.1',
    'x-real-ip': '198.51.100.7',
  })
  assert.equal(clientIp(headers), '192.0.2.12')
})

test('hashes identifiers consistently without retaining the raw value', async () => {
  const raw = 'did:privy:user-123'
  const first = await hashIdentifier(raw)
  const second = await hashIdentifier(raw)

  assert.equal(first, second)
  assert.equal(first.length, 64)
  assert.equal(first.includes(raw), false)
})

test('recognizes only supported rate-limit codes', () => {
  assert.equal(isIdentifyRateLimitCode('RATE_LIMIT_USER'), true)
  assert.equal(isIdentifyRateLimitCode('RATE_LIMIT_IP'), true)
  assert.equal(isIdentifyRateLimitCode('RATE_LIMIT_FREQUENCY'), true)
  assert.equal(isIdentifyRateLimitCode('PROVIDER_TIMEOUT'), false)
})

test('returns safe user-facing messages for every limit', () => {
  assert.match(rateLimitMessage('RATE_LIMIT_FREQUENCY'), /wait/i)
  assert.match(rateLimitMessage('RATE_LIMIT_USER'), /scan limit/i)
  assert.match(rateLimitMessage('RATE_LIMIT_IP'), /network/i)
})

test('uses bounded beta limits and a finite provider timeout', () => {
  assert.equal(IDENTIFY_LIMITS.minFrequencySeconds, 4)
  assert.equal(IDENTIFY_LIMITS.userHourLimit, 20)
  assert.equal(IDENTIFY_LIMITS.userDayLimit, 75)
  assert.equal(IDENTIFY_LIMITS.ipHourLimit, 60)
  assert.equal(IDENTIFY_LIMITS.providerTimeoutMs, 60_000)
})
