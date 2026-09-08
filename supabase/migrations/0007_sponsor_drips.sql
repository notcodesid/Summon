-- Sponsor-funded onboarding.
--
-- One row per Privy user: the server sponsor wallet sent a small fixed
-- amount of SOL so a fresh wallet can pay rent for its on-chain account.
-- The sponsor private key lives in Edge Function secrets only — never in
-- the app. Writes happen service-role only, after Privy auth in `drip`.

create table if not exists public.sponsor_drips (
  privy_user_id   text primary key,
  wallet_address  text not null,
  amount_lamports bigint not null,
  signature       text,
  created_at      timestamptz not null default now()
);

create index if not exists sponsor_drips_created_at_idx
  on public.sponsor_drips (created_at desc);

alter table public.sponsor_drips enable row level security;

revoke all on table public.sponsor_drips from public, anon, authenticated;
grant select, insert, update on table public.sponsor_drips to service_role;

drop policy if exists sponsor_drips_no_direct on public.sponsor_drips;
create policy sponsor_drips_no_direct
  on public.sponsor_drips
  for all to anon, authenticated
  using (false)
  with check (false);
