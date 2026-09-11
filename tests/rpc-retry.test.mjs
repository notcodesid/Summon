import assert from 'node:assert/strict'
import test from 'node:test'
import { withRpcRetry } from '../lib/rpc-retry.ts'

test('RPC retry recovers from temporary transport failures with increasing backoff', async () => {
  let calls = 0
  const waits = []
  const result = await withRpcRetry(
    'account read',
    async () => {
      calls += 1
      if (calls < 3) throw new Error('network unavailable')
      return 'ready'
    },
    { wait: async (milliseconds) => waits.push(milliseconds) },
  )

  assert.equal(result, 'ready')
  assert.equal(calls, 3)
  assert.deepEqual(waits, [1000, 2000])
})

test('RPC retry stops at its bounded attempt count and preserves the last error', async () => {
  const failure = new Error('still unavailable')
  let calls = 0
  await assert.rejects(
    withRpcRetry(
      'account read',
      async () => {
        calls += 1
        throw failure
      },
      { attempts: 3, wait: async () => {} },
    ),
    failure,
  )
  assert.equal(calls, 3)
})
