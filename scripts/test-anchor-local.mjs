import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const rpcPort = '18899'
const faucetPort = '19900'
const rpcUrl = `http://127.0.0.1:${rpcPort}`
const programId = '6YdQKUGoeaT1LmuF4PJMRYMMQo1dvW7JNYzAS3CZgoeA'
const programPath = resolve('target/deploy/summon_battle.so')
const walletPath = process.env.ANCHOR_WALLET || join(homedir(), '.config', 'solana', 'id.json')

if (!existsSync(programPath)) throw new Error(`Missing ${programPath}. Build the program before running local tests.`)
if (!existsSync(walletPath)) throw new Error(`Missing Anchor test wallet at ${walletPath}.`)

const pubkeyResult = spawnSync('solana-keygen', ['pubkey', walletPath], { encoding: 'utf8' })
if (pubkeyResult.status !== 0) throw new Error(pubkeyResult.stderr || 'Could not read the Anchor wallet public key.')
const walletPubkey = pubkeyResult.stdout.trim()
const ledgerPath = mkdtempSync(join(tmpdir(), 'summon-anchor-'))

const validator = spawn(
  'solana-test-validator',
  [
    '--reset',
    '--quiet',
    '--ledger',
    ledgerPath,
    '--rpc-port',
    rpcPort,
    '--faucet-port',
    faucetPort,
    '--mint',
    walletPubkey,
    '--bpf-program',
    programId,
    programPath,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_DNA: '1' } },
)

let validatorError = ''
validator.stderr.on('data', (chunk) => {
  validatorError += String(chunk)
})

async function waitUntilHealthy() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (validator.exitCode !== null) throw new Error(validatorError || 'The local validator stopped during startup.')
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
      })
      const body = await response.json()
      if (body.result === 'ok') return
    } catch {
      // Validator startup is asynchronous; retry briefly.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }
  throw new Error('Local validator did not become healthy within 15 seconds.')
}

try {
  await waitUntilHealthy()
  const tests = spawnSync('npm', ['run', 'test:anchor'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NO_DNA: '1',
      ANCHOR_PROVIDER_URL: rpcUrl,
      ANCHOR_WALLET: walletPath,
    },
  })
  if (tests.error) throw tests.error
  process.exitCode = tests.status ?? 1
} finally {
  validator.kill('SIGTERM')
  rmSync(ledgerPath, { recursive: true, force: true })
}
