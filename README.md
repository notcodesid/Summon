# Summon

Summon is a mobile collectible game built on Solana. Every pull uses MagicBlock VRF for verifiable randomness, executes against a delegated player account on a MagicBlock Ephemeral Rollup, and commits the result back to Solana.

The app is built with Expo and React Native, uses Privy embedded Solana wallets, and stores inventory and pull history in a wallet-owned program PDA. There is no mock inventory or client-generated pull data.

## Features

- Verifiably random collectible pulls using MagicBlock VRF
- 60% Common, 30% Rare, 9% Epic, and 1% Legendary distribution
- Wallet-owned inventory for ten collectibles
- On-chain proof history with bounded storage
- Fast execution through a MagicBlock Ephemeral Rollup
- Privy authentication and embedded Solana wallets
- Transaction simulation before every wallet signature
- State recovery after app reload

## Architecture

```text
Expo app + Privy wallet
        │
        ├─ initialize + delegate ──► Solana Devnet
        │
        └─ request pull ───────────► MagicBlock ER
                                      │
                                      ├─ MagicBlock VRF callback
                                      ├─ update inventory + history
                                      └─ commit ─────────► Solana Devnet
```

Each wallet owns one `PlayerState` PDA containing its inventory, request state, total pulls, and the newest 16 verified pull records. The collectible order in [`features/summon/catalog.ts`](features/summon/catalog.ts) is part of the protocol and must remain stable after deployment.

## Deployed program

| Network       | Program ID                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solana Devnet | [`9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ`](https://explorer.solana.com/address/9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ?cluster=devnet) |

The client uses the MagicBlock Devnet Asia Ephemeral Rollup by default.

## Requirements

- Node.js 20 or newer
- npm
- Xcode and an iOS Simulator, or Android Studio and an Android emulator
- Rust 1.89
- Solana CLI with SBF build tools
- A Privy app and native mobile client

This project requires a custom Expo development build; Expo Go does not include the required native modules.

## Setup

```bash
git clone <repository-url>
cd summon
npm ci
cp .env.example .env
```

Configure the client-safe values in `.env`:

```dotenv
EXPO_PUBLIC_PRIVY_APP_ID=
EXPO_PUBLIC_PRIVY_CLIENT_ID=
EXPO_PUBLIC_SUPPORT_EMAIL=
EXPO_PUBLIC_PRIVACY_URL=https://github.com/notcodesid/Summon/blob/main/PRIVACY.md
EXPO_PUBLIC_SUMMON_PROGRAM_ID=9YnD3AaxVSAhigDfQemiKAAjbuieSBMA8cYUrpWLnZnZ
EXPO_PUBLIC_MAGICBLOCK_ER_RPC_URL=https://devnet-as.magicblock.app
EXPO_PUBLIC_MAGICBLOCK_ER_WS_URL=wss://devnet-as.magicblock.app
```

In the Privy dashboard, register:

- Native app identifier: `com.notcodesid.summon`
- URL scheme: `summon`
- Solana embedded wallets with wallet creation on login
- The login methods you want to support

Never expose `PRIVY_APP_SECRET` through an `EXPO_PUBLIC_` variable.

## Run the app

Build and install the native development app:

```bash
npm run ios
# or
npm run android
```

Start Metro for subsequent runs:

```bash
npm run dev
```

The embedded wallet needs Devnet SOL for account creation and transaction fees.

## Program development

```bash
npm run program:build
npm run program:test
npm run program:verify-idl
```

`program:build` builds the SBF program, generates the Anchor IDL, synchronizes the IDL into the Expo bundle, and verifies client instruction resolution.

The generated deployable program is written to `target/deploy/summon.so`. Deployment keypairs and private keys must remain outside this repository.

## Verification

```bash
npx tsc --noEmit
npm run lint:check
npm run format:check
cargo fmt --all -- --check
git diff --check
```

The on-chain test suite covers rarity boundaries, unbiased selection, account sizing, inventory updates, bounded history, and duplicate callback rejection.

## Repository structure

```text
app/                         Expo Router screens
components/                  Shared React Native UI
features/summon/             Catalog, repository, IDL, and wallet adapter
programs/summon/             Anchor program
scripts/                     IDL generation and verification
docs/BACKEND.md              Architecture and operator notes
docs/BACKEND_TODO.md         Verified implementation checklist
```

## Security

- The app never reads or stores wallet private keys.
- Privy signs wallet transactions after local simulation.
- On-chain account owner, discriminator, size, and wallet authority are validated.
- The client currently rejects non-Devnet pull requests.
- Mainnet deployment and upgrade-authority changes require a separate review.

For program flow, deployment guidance, and operational details, see [`docs/BACKEND.md`](docs/BACKEND.md).

## Contributing

Before opening a pull request, run the program tests and verification commands above. Keep protocol catalog changes, account-layout changes, and program-ID changes explicit because they can require an on-chain migration or redeployment.
