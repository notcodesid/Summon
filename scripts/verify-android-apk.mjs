import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const apk = process.argv[2] ?? 'android/app/build/outputs/apk/dappStore/release/app-dappStore-release.apk'

if (!existsSync(apk)) {
  console.error(`APK not found: ${apk}`)
  process.exit(1)
}

const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
const apksigner = sdkRoot
  ? spawnSync('sh', ['-lc', `find "${sdkRoot}/build-tools" -name apksigner -type f | sort -V | tail -1`], {
      encoding: 'utf8',
    }).stdout.trim()
  : ''

if (!apksigner) {
  console.error('Set ANDROID_HOME or ANDROID_SDK_ROOT to an Android SDK with build-tools.')
  process.exit(1)
}

const result = spawnSync(apksigner, ['verify', '--verbose', '--print-certs', apk], {
  encoding: 'utf8',
})
process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')

const expectedCert = process.env.SUMMON_DAPPSTORE_EXPECTED_CERT_SHA256?.replace(/[^a-fA-F0-9]/g, '').toLowerCase()
if (result.status === 0 && expectedCert) {
  const match = result.stdout?.match(/Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]+)/)
  const actualCert = match?.[1]?.toLowerCase()
  if (!actualCert || actualCert !== expectedCert) {
    console.error(`APK certificate mismatch. Expected ${expectedCert}, received ${actualCert ?? 'unknown'}.`)
    process.exit(1)
  }
  console.log('Verified APK certificate matches SUMMON_DAPPSTORE_EXPECTED_CERT_SHA256.')
}
process.exit(result.status ?? 1)
