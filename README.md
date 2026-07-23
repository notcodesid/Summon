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

Legacy gacha / MagicBlock program code may still exist under `programs/` until the new onchain design replaces it. It is not wired into the client.
