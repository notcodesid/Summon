import assert from 'node:assert/strict'
import test from 'node:test'
import { saveWithDurableRetry } from '../lib/durable-save.ts'

test('fails without attempting upload when local persistence fails', async () => {
  let queued = false
  let uploaded = false

  const result = await saveWithDurableRetry({
    entity: { id: 'cat' },
    persistLocal: async () => false,
    enqueue: async () => {
      queued = true
      return true
    },
    upload: async () => {
      uploaded = true
      return { id: 'cat' }
    },
    onRemoteSaved: async () => {},
    dequeue: async () => {},
    pendingMessage: 'pending',
    localFailureMessage: 'local failed',
    queueFailureMessage: 'queue failed',
  })

  assert.deepEqual(result, { status: 'failed', message: 'local failed' })
  assert.equal(queued, false)
  assert.equal(uploaded, false)
})

test('returns pending only after a durable retry record exists', async () => {
  let queued = false

  const result = await saveWithDurableRetry({
    entity: { id: 'fox' },
    persistLocal: async () => true,
    enqueue: async () => {
      queued = true
      return true
    },
    upload: async () => {
      throw new Error('offline')
    },
    onRemoteSaved: async () => {},
    dequeue: async () => {},
    pendingMessage: 'saved locally',
    localFailureMessage: 'local failed',
    queueFailureMessage: 'queue failed',
  })

  assert.deepEqual(result, {
    status: 'pending',
    entity: { id: 'fox' },
    message: 'saved locally',
  })
  assert.equal(queued, true)
})

test('returns saved only after the server acknowledges the upload', async () => {
  const events = []

  const result = await saveWithDurableRetry({
    entity: { id: 'owl' },
    persistLocal: async () => {
      events.push('local')
      return true
    },
    enqueue: async () => {
      events.push('queued')
      return true
    },
    upload: async () => {
      events.push('uploaded')
      return { id: 'owl', photoUri: 'https://example.test/owl.jpg' }
    },
    onRemoteSaved: async () => {
      events.push('local-refreshed')
    },
    dequeue: async () => {
      events.push('dequeued')
    },
    pendingMessage: 'pending',
    localFailureMessage: 'local failed',
    queueFailureMessage: 'queue failed',
  })

  assert.deepEqual(result, {
    status: 'saved',
    entity: { id: 'owl' },
    remote: { id: 'owl', photoUri: 'https://example.test/owl.jpg' },
  })
  assert.deepEqual(events, [
    'local',
    'queued',
    'uploaded',
    'local-refreshed',
    'dequeued',
  ])
})

test('keeps a confirmed server save truthful if local cleanup later fails', async () => {
  const result = await saveWithDurableRetry({
    entity: { id: 'deer' },
    persistLocal: async () => true,
    enqueue: async () => true,
    upload: async () => ({ id: 'deer' }),
    onRemoteSaved: async () => {
      throw new Error('local mirror unavailable')
    },
    dequeue: async () => {},
    pendingMessage: 'pending',
    localFailureMessage: 'local failed',
    queueFailureMessage: 'queue failed',
  })

  assert.deepEqual(result, {
    status: 'saved',
    entity: { id: 'deer' },
    remote: { id: 'deer' },
  })
})
