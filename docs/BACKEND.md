# Summon backend

Summon's backend is an Anchor program whose player state runs on a MagicBlock
Ephemeral Rollup. A centralized database is not the source of truth for pulls or
ownership.

## Architecture

1. The app derives `PlayerState = PDA("player", wallet)`.
2. On Solana Devnet, the wallet initializes the PDA and delegates it to a MagicBlock
   Ephemeral Rollup validator.
3. On the ER, `request_pull` rejects concurrent requests, increments the player's
   nonce, derives a caller seed from wallet + nonce + slot + client entropy, and CPIs
   into MagicBlock VRF using the delegated queue.
4. MagicBlock verifies the VRF proof and invokes `resolve_pull`. The program accepts
   that callback only when `vrf_program_identity` is the scoped signer PDA derived for
   this exact callback program.
5. `resolve_pull` uses rejection sampling to produce an unbiased roll in `[0, 9999]`,
   applies the 60/30/9/1 rarity boundaries, selects an item within that tier, updates
   inventory, and writes a bounded proof entry.
6. The app observes the PDA until the nonce resolves, then calls `commit_player` so
   the new state is finalized back to the base layer.

```text
Privy wallet
    │ initialize + delegate (Solana Devnet)
    ▼
PlayerState PDA ────── delegated ──────► MagicBlock ER
                                            │
                                            ├─ request_pull → VRF queue
                                            │                    │
                                            │   verified callback◄┘
                                            ├─ resolve_pull
                                            └─ commit_player ───► Solana Devnet
```

## On-chain state

Each wallet owns exactly one player PDA containing:

- authority and PDA bump;
- quantity for each of the ten catalog indexes;
- total pulls and monotonic request nonce;
- one pending request guard and caller seed;
- the newest 16 resolved pull proofs in a ring buffer.

The catalog order in `features/summon/catalog.ts` is protocol data. Do not reorder it
after deployment without a state migration.

## Local checks

Prerequisites match the current MagicBlock quickstarts: Rust 1.89, a recent Solana CLI,
and Anchor 1.x.

```bash
npm ci
rustup toolchain install 1.89.0 --profile minimal
avm use 1.1.2
npm run program:test
npm run program:build
npm run program:sync-idl
npx tsc --noEmit
npm run lint:check
```

`program:sync-idl` copies the build-generated IDL into the Expo bundle. Always run it
after changing instructions, accounts, events, or errors.

## App configuration

Copy `.env.example` to `.env` and configure:

- `EXPO_PUBLIC_SUMMON_DATA_SOURCE=onchain` for real state;
- `EXPO_PUBLIC_SUMMON_PROGRAM_ID` after `anchor keys sync`;
- base RPC through the app's selected Devnet network;
- `EXPO_PUBLIC_MAGICBLOCK_ER_RPC_URL` and websocket URL for the selected ER region.

`demo` mode is intentionally explicit and the UI labels every result as Demo. It must
never be used for a judging claim that a pull is verified.

## Deployment gate

Deployment is not part of an unattended build. Before deployment:

1. Generate and back up the program deploy authority using your normal secure Solana
   key-management process.
2. Run `anchor keys sync` and commit the resulting public program ID changes only.
3. Build and verify the program locally.
4. Review program ID, cluster, deploy authority, upgrade authority, estimated balance,
   and binary hash.
5. Obtain explicit approval before funding, deploying, initializing, delegating, or
   sending any other transaction.

Never add a seed phrase, private key, deploy keypair, Privy app secret, or funded wallet
to this repository.

## Operational notes

- Initial target: Solana Devnet and MagicBlock Devnet Asia ER.
- The request must use `DEFAULT_EPHEMERAL_QUEUE` because it executes inside the ER.
- The callback must keep the `#[vrf_callback]` scoped identity constraint. Do not fall
  back to the deprecated global VRF identity.
- A player cannot request another pull while `pending` is true.
- App reloads read `pending` and the monotonic nonce from chain; they do not invent a
  local success state.
- Commit and undelegation use `MagicIntentBundleBuilder`, the current API replacing the
  deprecated commit helpers.

## Primary references

- [MagicBlock ER quickstart](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart)
- [MagicBlock VRF quickstart](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/quickstart)
- [MagicBlock VRF security](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/introduction/security)
- [MagicBlock local validator setup](https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/local-setup)
- [Privy Solana transaction recipe](https://docs.privy.io/recipes/solana/send-sol)
