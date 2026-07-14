# Summon — Build Context

## Product

**Summon** — Mobile-first provably fair gacha on MagicBlock Ephemeral Rollups + VRF. (Hackathon concept: MagicBlock "Onchain gacha" Idea 3.)

Hackathon: MagicBlock Solana Blitz (mobile theme, Ephemeral Rollups).

## Phase

Launch preparation — Seeker and Solana dApp Store Android release

## Mobile stack

| Field                           | Value                                                     |
| ------------------------------- | --------------------------------------------------------- |
| `mobile.platform`               | `react-native`                                            |
| `mobile.wallet_method`          | `embedded` (Privy embedded Solana wallet)                 |
| `mobile.scaffold_repo`          | `create-solana-dapp` → `web3js-expo-minimal` (then Privy) |
| `mobile.physical_device_tested` | `false`                                                   |

## On-chain stack (hackathon)

| Layer         | Tech                        |
| ------------- | --------------------------- |
| Randomness    | VRF (provably fair)         |
| State / pulls | MagicBlock Ephemeral Rollup |
| Settlement    | Solana Devnet               |
| Items         | 10 unique, 4 rarity tiers   |

## Weekend build phases

1. ✅ ER session — pull read/write on Ephemeral Rollup
2. ✅ VRF — rarity + item selection
3. ✅ Inventory — on-chain read/display
4. ✅ Mobile UI shell — onboarding, login, account, summon, collection, proof, detail, reveal
5. ✅ Real Devnet ER/VRF pull and demo flow

## Mobile init (done)

1. ✅ Solana.new skills setup
2. ✅ Scaffold `web3js-expo-minimal` (React Native + Expo)
3. ✅ Switched to Privy embedded Solana wallets (`@privy-io/expo`)
4. ✅ Polyfills (text-encoding, get-random-values, Buffer, ethers shims, quick-crypto)
5. ✅ Privy dashboard native app identifier (`com.notcodesid.summon`, scheme `summon`)
6. ✅ iOS simulator login, wallet, and real Devnet pull smoke test
7. ✅ `eas.json` dApp Store APK profile and dedicated Android signing flavor
8. ✅ Signed APK build and Android emulator smoke test
9. ⬜ Physical Android device test with the exact release APK

## Debug resolutions

- **2026-07-14 — MagicBlock sponsored commit cap:** A delegated player PDA reached the public
  validator's default limit of 10 sponsored commits. The mobile client now commits and undelegates
  every tenth pull, falls back to the same recovery for already-capped accounts, waits for confirmed
  Solana settlement, and re-delegates automatically on the next pull. Verified with the signed
  Android release APK on the API 36 ARM64 emulator: the affected wallet recovered and advanced from
  12 to 13 verified pulls without the prior `0xa0000000` error.

## Seeker release truth

- A Seeker device is not required to build or submit the APK.
- The current wallet path is Privy embedded wallet, not Mobile Wallet Adapter.
- Seed Vault support must not be claimed until MWA is implemented and tested.
- `mobile.physical_device_tested` remains `false` until a real Android release-device test passes.

## References

- [Solana Mobile Docs](https://docs.solanamobile.com/get-started/overview)
- [Blueshift — Solana Mobile Mastery](https://learn.blueshift.gg/en/paths/solana-mobile-mastery)
- MagicBlock ER SDK + Blitz hackathon examples
