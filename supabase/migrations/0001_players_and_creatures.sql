-- Summon — players and their caught creatures.
--
-- Auth is Privy, not Supabase Auth, so rows are keyed by the Privy user id
-- (a DID like "did:privy:abc123") rather than auth.uid().
--
-- SECURITY: the policies below let the anon key read and write every row.
-- That is demo-grade only. The real fix is to register Privy as a
-- third-party auth provider in the Supabase dashboard so requests carry a
-- Privy JWT, then scope each policy to the caller's own privy_user_id.

create table if not exists public.players (
  privy_user_id  text primary key,
  wallet_address text,
  email          text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create table if not exists public.creatures (
  id             text primary key,
  privy_user_id  text not null
                 references public.players (privy_user_id) on delete cascade,
  species        text not null,
  common_name    text not null,
  rarity         text not null
                 check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  stats          jsonb not null,
  note           text not null default '',
  photo_uri      text,
  captured_at    timestamptz not null default now()
);

create index if not exists creatures_player_captured_idx
  on public.creatures (privy_user_id, captured_at desc);

alter table public.players   enable row level security;
alter table public.creatures enable row level security;

-- Permissive on purpose — see the SECURITY note above.
drop policy if exists players_anon_all on public.players;
create policy players_anon_all on public.players
  for all to anon, authenticated using (true) with check (true);

drop policy if exists creatures_anon_all on public.creatures;
create policy creatures_anon_all on public.creatures
  for all to anon, authenticated using (true) with check (true);
