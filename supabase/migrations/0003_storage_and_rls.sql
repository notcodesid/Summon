-- Phase 1 hardening:
-- 1) Creature photo storage bucket
-- 2) Drop open anon policies — clients no longer read/write tables directly
-- 3) All privileged access goes through Edge Functions (service_role bypasses RLS)
--
-- Apply with: psql "$DATABASE_URL" -f supabase/migrations/0003_storage_and_rls.sql

-- ── Storage: creature photos ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creature-photos',
  'creature-photos',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for collection images (URLs are unguessable enough with uuid paths).
drop policy if exists creature_photos_public_read on storage.objects;
create policy creature_photos_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'creature-photos');

-- No direct client uploads — Edge Functions use the service role.
drop policy if exists creature_photos_anon_insert on storage.objects;
drop policy if exists creature_photos_anon_update on storage.objects;
drop policy if exists creature_photos_anon_delete on storage.objects;

-- ── Lock down app tables ───────────────────────────────────────────────────
drop policy if exists players_anon_all on public.players;
drop policy if exists creatures_anon_all on public.creatures;

-- Explicit deny for browser/mobile anon + authenticated roles.
-- service_role bypasses RLS and is used only by Edge Functions.
drop policy if exists players_no_direct on public.players;
create policy players_no_direct on public.players
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists creatures_no_direct on public.creatures;
create policy creatures_no_direct on public.creatures
  for all to anon, authenticated
  using (false)
  with check (false);
