import { readFileSync } from 'node:fs'

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo
const eas = JSON.parse(readFileSync('eas.json', 'utf8'))
const gradle = readFileSync('android/app/build.gradle', 'utf8')
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const appConfig = readFileSync('constants/app-config.ts', 'utf8')
const accountScreen = readFileSync('app/account.tsx', 'utf8')

const checks = [
  ['Android package', app.android?.package === 'com.notcodesid.summon'],
  ['Android version code', Number.isInteger(app.android?.versionCode)],
  ['dApp Store flavor', /dappStore\s*\{/.test(gradle)],
  ['dedicated signing config', /signingConfig signingConfigs\.dappStoreRelease/.test(gradle)],
  ['signing environment', gradle.includes('SUMMON_DAPPSTORE_STORE_FILE')],
  ['EAS local credentials', eas.build?.['dapp-store']?.credentialsSource === 'local'],
  ['support configuration', appConfig.includes('EXPO_PUBLIC_SUPPORT_EMAIL')],
  [
    'privacy and deletion actions',
    accountScreen.includes('Privacy policy') && accountScreen.includes('Request account deletion'),
  ],
  [
    'storage permissions removed',
    /READ_EXTERNAL_STORAGE" tools:node="remove"/.test(manifest) &&
      /WRITE_EXTERNAL_STORAGE" tools:node="remove"/.test(manifest),
  ],
  ['overlay permission removed', /SYSTEM_ALERT_WINDOW" tools:node="remove"/.test(manifest)],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error(`Seeker configuration verification failed: ${failures.join(', ')}`)
  process.exit(1)
}

console.log(`Verified Seeker Android config: ${checks.map(([name]) => name).join(', ')}`)
