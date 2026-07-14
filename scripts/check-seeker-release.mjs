import { existsSync, readFileSync } from 'node:fs'

function loadDotEnv(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, '$2')
        return [key, value]
      }),
  )
}

const env = { ...loadDotEnv('.env'), ...process.env }
const failures = []

function requireValue(key, validate = (value) => Boolean(value)) {
  const value = env[key]
  if (!validate(value)) failures.push(key)
}

requireValue('EXPO_PUBLIC_PRIVY_APP_ID')
requireValue('EXPO_PUBLIC_PRIVY_CLIENT_ID')
requireValue('EXPO_PUBLIC_SUPPORT_EMAIL', (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value ?? ''))
requireValue('EXPO_PUBLIC_PRIVACY_URL', (value) => /^https:\/\//.test(value ?? ''))
requireValue('EXPO_PUBLIC_SUMMON_PROGRAM_ID', (value) => value === '9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ')

const signingKeys = [
  'SUMMON_DAPPSTORE_STORE_FILE',
  'SUMMON_DAPPSTORE_STORE_PASSWORD',
  'SUMMON_DAPPSTORE_KEY_ALIAS',
  'SUMMON_DAPPSTORE_KEY_PASSWORD',
]
const anySigningValue = signingKeys.some((key) => env[key])
if (anySigningValue) {
  signingKeys.forEach((key) => requireValue(key))
  if (env.SUMMON_DAPPSTORE_STORE_FILE && !existsSync(env.SUMMON_DAPPSTORE_STORE_FILE)) {
    failures.push('SUMMON_DAPPSTORE_STORE_FILE (file not found)')
  }
}

let hasEasCredentials = false
if (existsSync('credentials.json')) {
  try {
    const credentials = JSON.parse(readFileSync('credentials.json', 'utf8'))
    const keystore = credentials.android?.keystore
    const keystorePath = keystore?.keystorePath
    hasEasCredentials = Boolean(
      keystorePath &&
      existsSync(keystorePath) &&
      keystore.keystorePassword &&
      keystore.keystorePassword !== 'REPLACE_ME' &&
      keystore.keyAlias &&
      keystore.keyPassword &&
      keystore.keyPassword !== 'REPLACE_ME',
    )
    if (!hasEasCredentials) failures.push('credentials.json or its referenced keystore')
  } catch {
    failures.push('credentials.json (invalid JSON)')
  }
}

if (!anySigningValue && !hasEasCredentials) {
  failures.push('dApp Store signing credentials')
}

if (failures.length) {
  console.error(`Seeker release configuration is incomplete: ${failures.join(', ')}`)
  process.exit(1)
}

console.log(
  `Seeker release environment is complete, including ${hasEasCredentials ? 'EAS local' : 'shell'} signing credentials.`,
)
