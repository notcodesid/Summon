# Summon

Initial mobile app shell for a real-world animal collection game on Solana.

**Direction:** explore the real world, scan animals you encounter, collect them with rarity and stats, and battle other players — Pokemon-like, onchain.

This repo is intentionally minimal: Expo + React Native with a single home screen. Product screens, auth, and onchain flows will be added next.

## Stack

- Expo 55 / React Native
- Expo Router
- TypeScript

## Setup

```bash
npm ci
cp .env.example .env
```

## Run

Requires a custom development build for native modules later; for the shell:

```bash
npm run dev
# or
npm run ios
npm run android
```

## Structure

```text
app/                 Expo Router screens (home only)
components/          Shared UI / providers
constants/           Theme and app config
assets/              App icons and splash
```

The legacy gacha / MagicBlock program has been removed — Summon is not a random-pull game. A new onchain design will follow once the core loop is settled.

## Identification

After a capture, Summon asks Claude to name the animal and rate its rarity. Set
`EXPO_PUBLIC_ANTHROPIC_API_KEY` in `.env` to enable it; without a key the app
falls back to a demo creature so the scan → collect loop still works.

The key ships in the app bundle, which is fine for a local demo build but not
for distribution — move the call behind a server before releasing.

## Database

Players and their creatures are stored in Supabase, keyed by the Privy user id.
Apply the schema once:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_players_and_creatures.sql
```

AsyncStorage is kept as an offline mirror, so the app still shows a collection
without a network. Sign-in is required — a bypassed session has no Privy user
id and saves nothing.

When the collection is empty, Home and Collection show a fixed demo set from
`lib/demo-collection.ts` (bundled animal photos). Set
`EXPO_PUBLIC_DEMO_COLLECTION=0` for a true empty state. Demo rows are never
written to storage or Supabase — the first real catch replaces them.

Note that row-level security is currently permissive: auth is Privy rather than
Supabase Auth, so the anon key can read and write every row. Before this is
public, register Privy as a third-party auth provider in Supabase and scope the
policies to the caller.
