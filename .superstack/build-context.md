# Summon — Build Context

## Product

**Summon** — Mobile-first provably fair gacha on MagicBlock Ephemeral Rollups + VRF. (Hackathon concept: MagicBlock "Onchain gacha" Idea 3.)

Hackathon: MagicBlock Solana Blitz (mobile theme, Ephemeral Rollups).

## Phase

Build — Phase 1: ER session + pull transaction

## Mobile stack

| Field                           | Value                                                     |
| ------------------------------- | --------------------------------------------------------- |
| `mobile.platform`               | `react-native`                                            |
| `mobile.wallet_method`          | `privy` (embedded Solana; email login)                    |
| `mobile.scaffold_repo`          | `create-solana-dapp` → `web3js-expo-minimal` (then Privy) |
| `mobile.physical_device_tested` | `false`                                                   |

## On-chain stack (hackathon)

| Layer         | Tech                               |
| ------------- | ---------------------------------- |
| Randomness    | VRF (provably fair)                |
| State / pulls | MagicBlock Ephemeral Rollup        |
| Settlement    | Solana mainnet (NFTs or SPL items) |
| Items         | 10 unique, 4 rarity tiers          |

## Weekend build phases

1. ⬜ ER session — pull read/write on Ephemeral Rollup
2. ⬜ VRF — rarity + item selection
3. ⬜ Inventory — on-chain read/display
4. ✅ Mobile UI shell — onboarding, login, account, summon, collection, proof, detail, reveal
5. ⬜ Polish + backup demo video (real ER/VRF still open)

## Mobile init (done)

1. ✅ Solana.new skills setup
2. ✅ Scaffold `web3js-expo-minimal` (React Native + Expo)
3. ✅ Switched to Privy embedded Solana wallets (`@privy-io/expo`)
4. ✅ Polyfills (text-encoding, get-random-values, Buffer, ethers shims, quick-crypto)
5. ⬜ Set `EXPO_PUBLIC_PRIVY_CLIENT_ID` + Privy dashboard app client (bundle `com.summon.app`, scheme `summon`)
6. ⬜ Rebuild native client (`npm run ios` / `npm run android`) and smoke-test email login + wallet
7. ⬜ `eas.json` dApp Store APK profile

## References

- [Solana Mobile Docs](https://docs.solanamobile.com/get-started/overview)
- [Blueshift — Solana Mobile Mastery](https://learn.blueshift.gg/en/paths/solana-mobile-mastery)
- MagicBlock ER SDK + Blitz hackathon examples
