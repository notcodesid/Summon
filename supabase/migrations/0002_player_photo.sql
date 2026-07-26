-- Profile photo for a player.
--
-- Filled from the Google account at sign-in: Privy hands over the Google
-- OAuth access token once, during the login flow, and we exchange it for the
-- `picture` claim on Google's userinfo endpoint. The token is not retrievable
-- later, so the URL is captured then and stored here.
--
-- A player can replace it with their own upload from the profile screen.

alter table public.players
  add column if not exists photo_url text;

-- Where the current photo came from, so an upload is never overwritten by a
-- later Google sign-in.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'photo_source' and n.nspname = 'public'
  ) then
    create type public.photo_source as enum ('google', 'upload');
  end if;
end
$$;

alter table public.players
  add column if not exists photo_source public.photo_source;
