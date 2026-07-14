import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const apk = process.argv[2] ?? 'android/app/build/outputs/apk/dappStore/release/app-dappStore-release.apk'

if (!existsSync(apk)) {
  console.error(`APK not found: ${apk}`)
  process.exit(1)
}

const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
function findBuildTool(name) {
  return sdkRoot
    ? spawnSync('sh', ['-lc', `find "${sdkRoot}/build-tools" -name ${name} -type f | sort -V | tail -1`], {
        encoding: 'utf8',
      }).stdout.trim()
    : ''
}

const apksigner = findBuildTool('apksigner')
const aapt = findBuildTool('aapt')

if (!apksigner || !aapt) {
  console.error('Set ANDROID_HOME or ANDROID_SDK_ROOT to an Android SDK with build-tools.')
  process.exit(1)
}

const badging = spawnSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' })
if (badging.status !== 0) {
  process.stderr.write(badging.stderr ?? '')
  process.exit(badging.status ?? 1)
}

const packageMatch = badging.stdout.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/)
const nativeCodeMatch = badging.stdout.match(/^native-code:\s*(.+)$/m)
const permissions = [...badging.stdout.matchAll(/^uses-permission: name='([^']+)'/gm)].map((match) => match[1])
const forbiddenPermissions = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
].filter((permission) => permissions.includes(permission))

if (packageMatch?.[1] !== 'com.notcodesid.summon') {
  console.error(`Unexpected APK package: ${packageMatch?.[1] ?? 'unknown'}`)
  process.exit(1)
}
if (!nativeCodeMatch?.[1].includes("'arm64-v8a'")) {
  console.error('APK does not contain ARM64 native libraries required by Solana Mobile devices.')
  process.exit(1)
}
if (forbiddenPermissions.length) {
  console.error(`APK contains forbidden permissions: ${forbiddenPermissions.join(', ')}`)
  process.exit(1)
}

console.log(
  `Verified APK metadata: ${packageMatch[1]} ${packageMatch[3]} (${packageMatch[2]}), ARM64 present, restricted permissions absent.`,
)

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
