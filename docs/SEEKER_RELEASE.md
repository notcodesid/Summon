# Seeker and Solana dApp Store release

Summon ships to the Solana dApp Store as a signed Android APK. The store does not accept an Android App Bundle (`.aab`).

## What is ready in this repository

- Android package: `com.notcodesid.summon`
- Dedicated `dappStore` Android product flavor
- ARM64-only native packaging for Solana Mobile devices
- APK build command: `npm run android:apk`
- APK signature check: `npm run android:verify-apk`
- EAS profile: `dapp-store`
- Devnet program: `9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ`

Summon currently uses a Privy embedded Solana wallet. Mobile Wallet Adapter and Seeker Seed Vault integration are not implemented, so do not claim Seed Vault support in the store listing.

## 1. Create a dedicated signing key

Use a signing key that is unique to the Solana dApp Store. Keep the keystore and passwords outside this repository. Never commit or share them.

Set these variables only in your local shell or secure CI secrets:

```bash
export SUMMON_DAPPSTORE_STORE_FILE=/absolute/path/to/summon-dapp-store.jks
export SUMMON_DAPPSTORE_STORE_PASSWORD='...'
export SUMMON_DAPPSTORE_KEY_ALIAS='...'
export SUMMON_DAPPSTORE_KEY_PASSWORD='...'
```

Back up the keystore securely. Every future update must use the same key.

For an EAS build, copy `credentials.example.json` to the ignored
`credentials.json`, update its values, and place the keystore at the path named
in that file. EAS then supplies the release signing configuration. For a local
Gradle build, use the four shell variables above instead.

## 2. Build and verify the APK

Local Gradle build:

```bash
npm run android:build
npm run seeker:check-release
npm run android:apk
npm run android:verify-apk
```

EAS build:

```bash
cp credentials.example.json credentials.json
# Fill credentials.json and add the referenced keystore.
npm run seeker:check-release
npx eas-cli@latest build --platform android --profile dapp-store
npm run android:verify-apk -- /absolute/path/to/downloaded.apk
```

Output:

```text
android/app/build/outputs/apk/dappStore/release/app-dappStore-release.apk
```

The build deliberately fails when any signing variable is missing. A debug-signed APK is not submission-ready.

## 3. Test before submission

Install the exact signed APK on an Android emulator first, then on a physical Android device:

```bash
adb install -r android/app/build/outputs/apk/dappStore/release/app-dappStore-release.apk
```

Verify Google sign-in, embedded-wallet creation, player initialization, delegation, VRF pull, resolved inventory, proof details, app background/restore, network failure, and transaction timeout. A physical-device pull with the release APK is required before calling the mobile release production-ready.

Record the transaction signature from a successful fresh-wallet pull and keep
its Solana Explorer URL as integration proof. Repeat the same flow after deleting
the app's local data so the review does not depend on an existing account.

## 4. Prepare the listing

Prepare the final app name, short and full description, icon, screenshots captured from the Android release build, support website, privacy policy, and demo video. Describe the current product accurately: provably fair collectible pulls and on-chain inventory. Do not advertise trading, listing, NFTs, mainnet, MWA, or Seed Vault until those features ship.

The repository privacy policy is in `PRIVACY.md`. Add a monitored support/deletion contact through `EXPO_PUBLIC_SUPPORT_EMAIL`, publish the policy at the configured `EXPO_PUBLIC_PRIVACY_URL`, and place both in the listing. The Account screen exposes both links. Privy user deletion must happen in the Privy dashboard or a secure server because it requires the Privy app secret; never put that secret in the mobile app.

Before building, verify the public release values:

```bash
npm run seeker:check-release
```

Fresh Devnet wallets request a small one-time faucet airdrop before player initialization. This supports review and testing only; it is not a mainnet gas-sponsorship system.

## 5. Submit through Publisher Portal

Create a publisher account, complete KYC/KYB, connect and fund the publisher wallet, create the app in Publisher Portal, mint the app NFT, then upload the signed APK and listing assets. Portal transactions require explicit wallet approval. Review normally takes several business days.

Budget about 0.2 SOL in the publisher wallet for the portal transactions. The
Solana Mobile publishing CLI is useful for later releases, but only after the
app exists in Publisher Portal and its app NFT has been minted.

Before an update, increment both `expo.version` and `expo.android.versionCode`, rebuild, and sign with the same dApp Store key.
