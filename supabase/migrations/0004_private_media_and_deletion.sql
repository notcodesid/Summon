-- Privacy hardening:
-- - media buckets are private
-- - all reads happen through short-lived signed URLs from the authenticated
--   Edge Function
-- - profile images are stored as files, not data URLs in public.players

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'creature-photos',
    'creature-photos',
    false,
    3145728,
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  ),
  (
    'profile-photos',
    'profile-photos',
    false,
    3145728,
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove the old globally-readable bucket rule. There are intentionally no
-- client-side Storage policies: only the service-role Edge Function may
-- upload, sign, or delete media after it verifies a Privy token.
drop policy if exists creature_photos_public_read on storage.objects;

-- Convert old public creature URLs to object paths so the new function can
-- sign them after this migration. Any already-null photo remains null.
update public.creatures
set photo_uri = regexp_replace(
  photo_uri,
  '^.*?/storage/v1/object/public/creature-photos/',
  ''
)
where photo_uri like '%/storage/v1/object/public/creature-photos/%';

-- Old profile values were external URLs or in-row data URLs. They are removed
-- instead of copied into a public bucket; users can refresh their Google
-- image or choose a new picture after this release.
update public.players
set photo_url = null,
    photo_source = null
where photo_url like 'data:%'
   or photo_url like 'http%';
