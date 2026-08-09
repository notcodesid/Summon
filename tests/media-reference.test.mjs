import assert from 'node:assert/strict'
import test from 'node:test'
import { preferDurableLocalMediaUri } from '../lib/media-reference.ts'

test('keeps a durable local file instead of an expiring signed URL', () => {
  assert.equal(
    preferDurableLocalMediaUri(
      'https://example.test/storage/v1/object/sign/creature-photos/cat.jpg?token=short-lived',
      'file:///app/Documents/captures/cat.jpg',
    ),
    'file:///app/Documents/captures/cat.jpg',
  )
})

test('uses the signed URL when no durable local copy exists', () => {
  const signed = 'https://example.test/storage/v1/object/sign/creature-photos/cat.jpg?token=short-lived'
  assert.equal(preferDurableLocalMediaUri(signed), signed)
})
