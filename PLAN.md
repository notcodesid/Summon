# plan

step by step build plan for summon. check things off as we go.

## product loop

1. **explore** — go outside. no app work for this.
2. **scan** — open camera, capture a real animal, turn it into a creature.
3. **collect** — add scanned animals to your collection (rarity + stats).
4. **battle** — fight other players with animals you've found.

## principle

**Ship the scan moment first. 3D is a power-up, not the foundation.**

Players care about: *I found a real animal → the app got it → I own something cool.*  
If that loop is weak, a 3D mesh won’t save it. If that loop is strong, depth / 3D makes it unforgettable later.

Order of work:

1. real AI scan (identify → reveal → keep)
2. 2.5D magic (cutout + depth card)
3. optional full 3D mesh (server job)

Skip for now: photo → SVG vector → 3D, on-device image-to-3D, paid 3D APIs as the core forever, and 3D before identify + durable photos work.

## focus right now

**Phase 1 — make scan actually Summon.** Wire real identify into the capture loop.

### done

- [x] clean the app codebase (minimal shell)
- [x] Privy + **Google** sign-in + embedded Solana wallet
- [x] auth gate (login → home / camera)
- [x] home screen with a clear **scan** / open camera button
- [x] open the **inbuilt / native camera** (expo-camera preview — custom UI on top)
- [x] after capture → name + keep (manual path works today)
- [x] **collect** — reveal card + collection grid
- [x] require real Google login (auth bypass off by default)
- [x] save players + creatures to Supabase, keyed by Privy user id
- [x] durable local photo persist (no camera-cache-only URIs)
- [x] Claude vision helper in `lib/identify.ts` (not yet the main reveal path)

### phase 1 — scan v1 (real product) ← **current**

Earn the collect moment with real AI scan. Manual rename is fallback/edit only.

#### step 1 — capture experience (click / scan feel)

- [x] guided viewfinder (“frame the animal” / “point at a real animal”)
- [x] shutter feel (haptics + press anim + flash)
- [x] freeze-frame after capture
- [x] **retake / use photo** before leaving camera
- [x] flash toggle (off / on / auto)
- [x] retake from reveal still returns to camera
- [ ] further camera polish if design specs arrive

#### step 2 — identify (free Gemini, not Claude)

- [ ] wire **Gemini** identify into reveal after “use photo” (species, common name, rarity, note)
- [ ] **miss / retake** when no animal is clearly in the photo
- [ ] **reveal card** as the main path (not a blank name form first)
- [ ] keep with **real rarity + stats** (not always common / zeroed)
- [ ] durable photo on keep (Documents / data URI; then Storage)
- [ ] upload photos to Supabase Storage
- [ ] scope RLS to the caller once Privy is registered as a Supabase auth provider
- [ ] move identification behind a server (key currently ships in the bundle)

### phase 2 — scan v1.5 (magic / 2.5D)

High payoff, lower cost than full mesh. Creature *pops* on reveal + collection.

- [ ] background **cutout** after identify (e.g. rembg or similar on server)
- [ ] **depth map** (e.g. Depth Anything / MiDaS) for parallax / tilt card
- [ ] glass creature card with rarity + note that feels dimensional
- [ ] use cutout + depth on home / collection previews

### phase 3 — scan v2 (optional full 3D)

Only after phase 1–2 feel good. Real mesh is a server job, not on-device.

```
photo + cutout → self-hosted TripoSR (or TRELLIS) → GLB → expo-three / R3F viewer
```

- [ ] optional **“view in 3D”** / async generate on reveal (don’t block keep on 3D failure)
- [ ] self-host open image-to-3D (prefer **TripoSR** first; TRELLIS / Hunyuan later if quality needs it)
- [ ] store **GLB** in Supabase Storage next to the photo
- [ ] in-app GLB viewer (`expo-gl` + expo-three or `@react-three/fiber/native`)
- [ ] gate full 3D to rare/epic or user tap if cost/latency is high

**Do not** require SVG vectorization as a middle step for animals — use mask/cutout, then direct image-to-3D when ready.

### next: battle

- [ ] **battle** — pick a creature, fight a canned opponent, resolve on stats

### later

- [ ] **Apple** Sign in (iOS)
- [ ] on-chain design once the core loop is settled (wallet already exists via Privy)

## notes

- **web2 for now:** real auth + a real database, no smart contract. the wallet is
  recorded against the player but nothing is on-chain yet.
- auth: Google via Privy; Solana wallet created after login. the privy user id is
  the database key, so login is required — a bypassed session saves nothing.
- the gacha program (MagicBlock ER + VRF) was **deleted**, not paused. summon is
  not a random-pull game: what you get is decided by what you actually found.
- exploration is real-world only — no coding task for that step
- image-to-3D needs a **GPU server**; the phone only captures, uploads, and displays
- free 3D path = open models self-hosted (TripoSR / TRELLIS); hosted APIs only for prototypes
