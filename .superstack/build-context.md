# Summon — Build Context

## Product

**Summon** — Mobile-first provably fair gacha on MagicBlock Ephemeral Rollups + VRF. (Hackathon concept: MagicBlock "Onchain gacha" Idea 3.)

Hackathon: MagicBlock Solana Blitz (mobile theme, Ephemeral Rollups).

## Phase

Build — Phase 1: ER session + pull transaction

## Mobile stack

| Field | Value |
|-------|-------|
| `mobile.platform` | `react-native` |
| `mobile.wallet_method` | `mwa` |
| `mobile.scaffold_repo` | `create-solana-dapp` → `web3js-expo-minimal` |
| `mobile.physical_device_tested` | `false` |

## On-chain stack (hackathon)

| Layer | Tech |
|-------|------|
| Randomness | VRF (provably fair) |
| State / pulls | MagicBlock Ephemeral Rollup |
| Settlement | Solana mainnet (NFTs or SPL items) |
| Items | 10 unique, 4 rarity tiers |

## Weekend build phases

1. ⬜ ER session — pull read/write on Ephemeral Rollup
2. ⬜ VRF — rarity + item selection
3. ⬜ Inventory — on-chain read/display
4. ⬜ Mobile UI — pull, reveal animation, collection
5. ⬜ Polish + backup demo video

## Mobile init (done)

1. ✅ Solana.new skills setup
2. ✅ Scaffold `web3js-expo-minimal` (React Native + Expo)
3. ✅ `npm install` — MWA deps per Solana Mobile docs
4. ✅ Polyfills (`polyfill.js` + `react-native-get-random-values`) + `MobileWalletProvider`
5. ✅ `expo-doctor` — 19/19 checks passed
6. ⬜ `npm run android` on device/emulator + Mock MWA Wallet
7. ⬜ `eas.json` dApp Store APK profile

## References

- [Solana Mobile Docs](https://docs.solanamobile.com/get-started/overview)
- [Blueshift — Solana Mobile Mastery](https://learn.blueshift.gg/en/paths/solana-mobile-mastery)
- MagicBlock ER SDK + Blitz hackathon examples