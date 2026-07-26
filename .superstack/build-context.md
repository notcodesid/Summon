# Summon — Build Context

## Product

**Summon** — Pokémon with real animals. You explore the real world, scan animals
you come across with your phone camera, and add them to your collection. Every
animal has its own rarity and stats. Later, you battle other players with the
animals you've discovered.

Explore. Scan. Collect. Battle.

> **Pivot note:** Summon was previously a provably-fair gacha built on MagicBlock
> Ephemeral Rollups + VRF (a MagicBlock Solana Blitz hackathon concept). That
> product is gone. The Anchor program, Rust toolchain, and IDL build pipeline
> were deleted; the gacha SDK dependencies were removed. Do not reintroduce
> random-pull mechanics — in Summon, what you get is decided by what you
> actually found outdoors, not by VRF.

## Phase

Demo build — get the full loop working end to end so it can be recorded and
submitted. Deliberately no backend and no smart contract.

## What is real vs. mocked

| Layer          | Status                                                        |
| -------------- | ------------------------------------------------------------- |
| Auth           | **Real, required** — Google sign-in via Privy. No bypass.     |
| Wallet         | **Real** — Privy embedded Solana wallet, created after login  |
| Camera         | **Real** — expo-camera capture                                |
| Identification | **Real when `EXPO_PUBLIC_ANTHROPIC_API_KEY` is set** (Claude vision); deterministic demo creature otherwise |
| Collection     | **Real** — Supabase `creatures`, keyed by Privy user id; AsyncStorage is an offline mirror |
| On-chain       | Nothing. Web2 only for now — the wallet is recorded, not used |
| Battle         | Not built yet                                                 |

The Privy user id is the database key, and the embedded wallet only exists
behind a real login, so auth is not optional: a bypassed session has no user id
and therefore saves nothing. `EXPO_PUBLIC_AUTH_BYPASS=1` remains only as an
escape hatch for automated UI tests that cannot complete an OAuth flow.

## Database

Schema lives in `supabase/migrations/` and is applied with psql using
`DATABASE_URL` from `.env`:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_players_and_creatures.sql
```

- `players` — one row per Privy user, carrying `wallet_address` and `email`.
  Written by `components/ensure-player-record.tsx` on login, and again once
  Privy has created the wallet.
- `creatures` — one row per catch, `privy_user_id` foreign-keyed to `players`.

> ⚠️ **RLS is permissive.** Auth is Privy, not Supabase Auth, so the anon key
> can read and write every row. Demo-grade only. The fix is to register Privy
> as a third-party auth provider in the Supabase dashboard so requests carry a
> Privy JWT, then scope each policy to the caller's own `privy_user_id`.

## Mobile stack

| Field                           | Value                                     |
| ------------------------------- | ----------------------------------------- |
| `mobile.platform`               | `react-native` (Expo 55, Expo Router)     |
| `mobile.wallet_method`          | `embedded` (Privy embedded Solana wallet) |
| `mobile.physical_device_tested` | `false`                                   |

## The loop, in code

1. `app/(app)/index.tsx` — home; `scan` button and a link to the collection.
2. `app/(app)/camera.tsx` — capture with base64, hand off via `lib/pending-capture.ts`.
3. `app/(app)/reveal.tsx` — identify, show the creature card, `add to collection`.
4. `app/(app)/collection.tsx` — grid of everything caught, newest first.

Supporting modules:

- `lib/identify.ts` — Claude vision call, with a demo fallback on missing key,
  refusal, or any error, so a recording never stalls.
- `lib/creatures.ts` — rarity tiers and **deterministic** stats derived from the
  species name, so the same animal always yields the same creature.
- `lib/collection.ts` — Supabase reads/writes with an AsyncStorage mirror.
- `lib/players.ts` / `lib/use-player.ts` — the signed-in player and their wallet.

## Known gaps

- **Battle is not built.** It is the last piece of the pitched loop.
- **Photos are not uploaded.** `photo_uri` stores a local `file://` path, so a
  collection opened on a second device shows rows without images. Supabase
  Storage is the fix.
- **RLS is permissive** — see the warning above.
- **The Anthropic API key ships in the app bundle.** Acceptable for a demo build
  that is not distributed; move the call behind a server before any release.
- Camera preview does not work in the iOS Simulator (no camera hardware) — the
  shutter stays disabled there. Test capture on a physical device or via Revyl.
- `mobile.physical_device_tested` stays `false` until a real device test passes.

## Seeker / dApp Store release truth

- A Seeker device is not required to build or submit the APK.
- The wallet path is the Privy embedded wallet, not Mobile Wallet Adapter.
- Seed Vault support must not be claimed until MWA is implemented and tested.

## References

- [Solana Mobile Docs](https://docs.solanamobile.com/get-started/overview)
- [Blueshift — Solana Mobile Mastery](https://learn.blueshift.gg/en/paths/solana-mobile-mastery)
