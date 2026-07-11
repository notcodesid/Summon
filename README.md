# Summon

**Summon** is a mobile-first Solana gacha for **MagicBlock's Solana Blitz hackathon** (mobile theme, Ephemeral Rollups). Tap **Pull**, summon verifiable loot, watch the reveal, own it on-chain.

> Built from MagicBlock's sponsor idea [*Onchain gacha*](https://x.com/magicblock) — VRF fairness + Ephemeral Rollup speed. One word: you summon collectibles from the rollup layer before they settle to mainnet.

## What we're building

A mobile-first Solana app where a user taps **Pull** and instantly receives a random collectible item (common / rare / epic / legendary). Every pull is provably fair (VRF-backed randomness) and feels instant and gasless because pulls + inventory run on a **MagicBlock Ephemeral Rollup (ER)**, settling to Solana mainnet only when needed.

Built for MagicBlock's Solana Blitz hackathon. This is **[MagicBlock Idea 3: Onchain gacha](https://x.com/magicblock)** — their sponsor-suggested hackathon concept. Follow their Ephemeral Rollup SDK patterns and examples closely.

### Alignment with MagicBlock's idea

MagicBlock describes it as: *"A collectible pull game where every draw is provably fair, pulls and inventory stay instant and gas free."*

| MagicBlock (Idea 3) | This repo |
|---------------------|-----------|
| Every pull uses VRF — verifiable rarity, no rigged odds | ✅ Core mechanic |
| Pulls and inventory run on an ER — instant and gas free | ✅ Core mechanic |
| Trade or list your drops straight from your phone | ⏸ Deferred (post-hackathon / stretch) |
| Ready for the Seeker dApp Store | ✅ Mobile + MWA target |

**Weekend MVP** matches the sponsor idea on VRF + ER + mobile; we intentionally skip trade/listing for v1 so the demo stays reliable and focused on pull → reveal → inventory.

## Core user flow

1. User opens the app on mobile, connects wallet (Mobile Wallet Adapter / Seed Vault on Seeker).
2. User taps **Pull**.
3. A VRF call generates verifiable randomness → determines rarity tier → determines specific item.
4. Reveal animation plays (suspense beat, then rarity-colored reveal).
5. Item is added to the user's on-chain inventory (stored via the ER for instant, gasless writes).
6. User can view their inventory / collection.

## Scope for the hackathon (keep tight)

- 10 unique items total
- 3–4 rarity tiers (e.g. Common 60%, Rare 30%, Epic 9%, Legendary 1%)
- One working pull mechanic, end to end, on real ER + VRF (not faked/simulated)
- Inventory screen showing owned items
- Polished pull/reveal animation — prioritize this over item count or extra features
- **Skip for now:** trading/marketplace, listing items for sale, account/profile systems, large item catalogs

## Technical architecture

| Layer | Role |
|-------|------|
| **Randomness** | VRF — provably fair, verifiable after the fact |
| **State** | MagicBlock Ephemeral Rollup — instant, gasless pulls + inventory writes |
| **Settlement** | Inventory/ownership settles to Solana mainnet (real NFTs or SPL-based items) |
| **Client** | React Native + Expo, Mobile Wallet Adapter, Seeker / dApp Store ready |

## What makes this submission stand out

1. **Real ER usage**, not simulated speed — judges from MagicBlock will know the difference.
2. **A genuinely satisfying reveal animation** — highest-leverage design element in the app.
3. **Light theming/narrative** on the 10 items — memorable, not generic fantasy loot.
4. **Rock-solid live demo reliability** — pull and reveal work every time in front of judges.
5. **Visible proof of fairness** — surface VRF seed/proof in the UI next to each pull.

## Build plan (weekend)

| Phase | Goal |
|-------|------|
| **Phase 1** | Get ER session working — single pull transaction read/write on Ephemeral Rollup end to end |
| **Phase 2** | Wire VRF for real randomness (rarity + item) |
| **Phase 3** | Inventory read/display from on-chain state |
| **Phase 4** | Mobile UI — pull button, reveal animation, inventory screen |
| **Phase 5** | Polish reveal animation, test demo reliability, record backup demo video |

## Client stack

- React Native + Expo (custom dev build — not Expo Go)
- `@wallet-ui/react-native-web3js` + `@solana/web3.js`
- Mobile Wallet Adapter (Seed Vault Wallet on Seeker)

## Development

Initialized with [Solana Mobile's React Native + Expo template](https://docs.solanamobile.com/get-started/react-native/create-solana-mobile-app) (`web3js-expo-minimal` via `create-solana-dapp`).

**Stack installed (per [MWA installation docs](https://docs.solanamobile.com/get-started/react-native/installation)):**
- Expo ~55 + `expo-dev-client` (custom dev build — **not Expo Go**)
- `@wallet-ui/react-native-web3js` + `@solana/web3.js`
- `react-native-quick-crypto` polyfill (loaded in `index.js` before app code)

```bash
npm install          # already run
npm run android      # builds custom dev client + launches on device/emulator
npm run dev          # Metro bundler (after dev client is installed)
npm run doctor       # expo-doctor health check
```

Requires an Android device or emulator. Use [Mock MWA Wallet](https://github.com/solana-mobile/mock-mwa-wallet) for wallet testing during development.

### Backup demo video

Record a backup demo video before judging in case of live wallet/network hiccups. Store recordings under `demos/` or `recordings/` — those paths are gitignored (see `.gitignore`).

## References

- [Solana Mobile Docs](https://docs.solanamobile.com/get-started/overview)
- [Blueshift — Solana Mobile Mastery](https://learn.blueshift.gg/en/paths/solana-mobile-mastery)
- MagicBlock Ephemeral Rollups SDK + hackathon examples (primary integration reference)