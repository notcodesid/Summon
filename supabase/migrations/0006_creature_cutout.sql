-- Add cutout_uri to public.creatures for subject isolation / 2.5D depth cards.

alter table public.creatures
  add column if not exists cutout_uri text;
