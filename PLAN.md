# plan

step by step build plan for summon. check things off as we go.

## product loop

1. **explore** — go outside. no app work for this.
2. **scan** — open camera, capture a real animal.
3. **collect** — add scanned animals to your collection (rarity + stats).
4. **battle** — fight other players with animals you've found.

## focus right now

build the **app** first so the product is clear. no auth yet.

### done

- [x] clean the app codebase (minimal shell)
- [x] Privy + **Google** sign-in + embedded Solana wallet
- [x] auth gate (login → home / camera)

### next: scan / collect

- [x] home screen with a clear **scan** / open camera button
- [x] open the **inbuilt / native camera** (expo-camera preview — custom UI on top)
- [x] after capture → name + keep (manual; optional Claude vision in lib/identify, no demo fallback)
- [x] **collect** — reveal card + collection grid
- [x] require real Google login (auth bypass off by default)
- [x] save players + creatures to Supabase, keyed by Privy user id
- [ ] simple camera UI polish (exact design when shared)
- [ ] upload photos to Supabase Storage (currently local `file://` paths)
- [ ] scope RLS to the caller once Privy is registered as a Supabase auth provider

### next: battle

- [ ] **battle** — pick a creature, fight a canned opponent, resolve on stats

### later

- [ ] **Apple** Sign in (iOS)
- [ ] move identification behind a server (key currently ships in the bundle)

## notes

- **web2 for now:** real auth + a real database, no smart contract. the wallet is
  recorded against the player but nothing is on-chain yet.
- auth: Google via Privy; Solana wallet created after login. the privy user id is
  the database key, so login is required — a bypassed session saves nothing.
- the gacha program (MagicBlock ER + VRF) was **deleted**, not paused. summon is
  not a random-pull game: what you get is decided by what you actually found.
- exploration is real-world only — no coding task for that step
