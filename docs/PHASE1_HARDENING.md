# Phase 1 hardening — deploy checklist

What shipped in code:

1. **Storage** — `creature-photos` bucket (public read, server upload only)
2. **Edge `identify`** — Gemini vision; API key only on server
3. **Edge `creatures`** — list / save (with photo upload) / clear / player helpers
4. **RLS** — direct anon access to `players` and `creatures` denied

## 1. Apply migration

```bash
psql "$DATABASE_URL" -f supabase/migrations/0003_storage_and_rls.sql
```

## 2. Link project (once)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 3. Set Edge secrets

```bash
supabase secrets set \
  GEMINI_API_KEY="your-gemini-key" \
  GEMINI_MODEL="gemini-2.5-flash" \
  PRIVY_APP_ID="your-privy-app-id" \
  PRIVY_APP_SECRET="your-privy-app-secret"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically on hosted Edge.

## 4. Deploy functions

```bash
supabase functions deploy identify --no-verify-jwt
supabase functions deploy creatures --no-verify-jwt
```

(`verify_jwt` is off because we verify **Privy** JWTs ourselves, not Supabase Auth.)

## 5. App env

Mobile only needs public keys (no Gemini):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_PRIVY_APP_ID=...
EXPO_PUBLIC_PRIVY_CLIENT_ID=...
```

Remove `EXPO_PUBLIC_GEMINI_API_KEY` from the app `.env` so the key is not bundled.

## 6. Smoke test

1. Sign in with Google  
2. Scan a real animal → identify should hit `/functions/v1/identify`  
3. Keep → photo lands in Storage, row in `creatures`  
4. Confirm with anon key alone you cannot `select * from creatures` (RLS deny)

## Rollback (dev only)

Re-open demo policies only if you must unblock local work without Edge:

```sql
drop policy if exists creatures_no_direct on public.creatures;
create policy creatures_anon_all on public.creatures
  for all to anon, authenticated using (true) with check (true);
```

Do not leave this on production.
