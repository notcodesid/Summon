import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateBeforeSend, TransactionSimulationError } from '../lib/transaction-safety.ts'

test('a successful simulation always happens before the signing request', async () => {
  const events = []
  const signature = await simulateBeforeSend({
    simulate: async () => {
      events.push('simulate')
      return { value: { err: null, logs: ['ok'] } }
    },
    send: async () => {
      events.push('sign-and-send')
      return 'local-signature'
    },
  })

  assert.equal(signature, 'local-signature')
  assert.deepEqual(events, ['simulate', 'sign-and-send'])
})

test('a failed simulation exposes logs and never asks the wallet to sign', async () => {
  let signingRequested = false
  await assert.rejects(
    simulateBeforeSend({
      simulate: async () => ({ value: { err: { InstructionError: [0, 'InvalidArgument'] }, logs: ['program log'] } }),
      send: async () => {
        signingRequested = true
        return 'impossible'
      },
    }),
    (error) => {
      assert.ok(error instanceof TransactionSimulationError)
      assert.deepEqual(error.logs, ['program log'])
      return true
    },
  )
  assert.equal(signingRequested, false)
})
