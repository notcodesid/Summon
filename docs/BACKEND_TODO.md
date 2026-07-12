# Summon backend implementation checklist

This checklist defines the on-chain hackathon MVP described in
`README.md`: one real, wallet-owned, verifiably random pull flow running through a
MagicBlock Ephemeral Rollup (ER), with collection and proof history readable by the
mobile app.

## Research findings

- Pulls, inventory, and proof history must come exclusively from program-owned state;
  the production app contains no in-memory data substitute.
- Privy already creates an embedded Solana wallet and exposes the wallet address and a
  signing provider. Devnet is the correct initial target.
- MagicBlock VRF is asynchronous: the player requests randomness, then the verified
  VRF signer calls the program callback with `[u8; 32]` randomness.
- Player state must be a PDA owned by the program, delegated to the ER for fast writes,
  and periodically committed back to Solana.
- The MVP should keep the ten-item catalog and published 60/30/9/1 rarity split. The
  collectible within a tier is chosen without modulo bias from the same VRF output.

## Ordered implementation TODOs

- [x] **B01 — Anchor workspace and configuration**
  - Add an Anchor workspace, a `summon` program, local/devnet cluster configuration,
    scripts, and environment documentation.
  - Acceptance: workspace metadata parses and the program builds with the pinned
    Anchor toolchain.

- [x] **B02 — Wallet-owned player state**
  - Add a per-wallet `PlayerState` PDA with authority, inventory quantities for ten
    collectibles, total pulls, request nonce, pending request metadata, and a bounded
    recent-pull ring buffer.
  - Acceptance: initialize is idempotent, PDA seeds include the wallet, and account
    size is compile-time checked.

- [x] **B03 — Fair rarity and item selection**
  - Convert VRF bytes into the advertised 10,000-point rarity distribution and choose
    an item within the selected tier deterministically.
  - Acceptance: boundary tests cover 0, 5999, 6000, 8999, 9000, 9899, 9900, and 9999;
    catalog indexes always remain within 0–9.

- [x] **B04 — MagicBlock VRF request/callback**
  - Request randomness from the delegated ER queue, bind the request to the player PDA
    and nonce, reject overlapping requests, and accept results only from the official
    MagicBlock VRF signer PDA.
  - Acceptance: callback updates inventory and history exactly once and clears pending
    state; unauthorized or duplicate callbacks fail.

- [x] **B05 — Ephemeral Rollup lifecycle**
  - Add delegate, commit, and commit-and-undelegate instructions for the player PDA.
  - Acceptance: the program compiles with current MagicBlock ER macros and uses
    `MagicIntentBundleBuilder`, not deprecated commit helpers.

- [x] **B06 — Program errors, events, and observability**
  - Add typed errors and events for initialization, request, resolution, delegation,
    and commit-relevant actions.
  - Acceptance: clients can distinguish pending, unauthorized, invalid-state, and
    arithmetic errors without parsing log strings.

- [x] **B07 — Program tests**
  - Add deterministic unit tests for distribution boundaries, selection, inventory
    updates, ring-buffer ordering, duplicate prevention, and account sizing.
  - Acceptance: Rust tests and `anchor build` pass locally.

- [x] **B08 — Mobile repository boundary**
  - Route every screen through a `SummonRepository` interface backed by the real
    on-chain implementation and canonical catalog.
  - Acceptance: collection, pulls, and pull requests are scoped to the connected wallet;
    no seeded or randomly generated client data is available.

- [x] **B09 — Privy transaction adapter and dual RPC routing**
  - Build, simulate, sign, submit, and confirm base-layer and ER transactions through
    the embedded Privy wallet; route initialize/delegate to Solana and pulls/commit to ER.
  - Acceptance: no private key enters app code, cluster mismatch is rejected, and every
    transaction is simulated before a signing prompt.

- [ ] **B10 — Async pull state and proof hydration**
  - Model `idle → requesting → awaiting_vrf → resolved/failed`, poll or subscribe to the
    player PDA, and hydrate the UI proof fields from on-chain state and transaction IDs.
  - Acceptance: a pull cannot be double-submitted, app reload resumes a pending pull,
    and the UI labels only program-resolved state as verified.

- [x] **B11 — Configuration and operator documentation**
  - Document program ID, base/ER RPCs, queue selection, devnet initialization,
    delegation, funding/sponsorship, deployment, and rollback procedures.
  - Acceptance: a fresh developer can build and run the local checks without secrets in
    the repository.

- [ ] **B12 — Full verification**
  - Run formatting, TypeScript, lint, Rust tests, Anchor build, and repository hygiene
    checks; record anything that requires an external devnet deployment separately.
  - Acceptance: all local checks and one complete Devnet pull pass, and secrets remain
    ignored.

## Remaining verification

- Confirm `commit_player` succeeds and the resolved state remains after app reload.
- Re-run the full local check suite after the end-to-end fixes, with zero lint warnings.

## Explicitly out of scope for this milestone

- Mainnet deployment or any transaction submission without user approval.
- Trading, marketplace/listing, profiles, payments, or a large item catalog.
- A centralized database as the ownership source of truth.
- Pretending an undeployed or client-generated pull is on-chain verified.
