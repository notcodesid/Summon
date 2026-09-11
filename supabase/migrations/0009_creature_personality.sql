alter table public.creatures
  add column if not exists nickname text,
  add column if not exists personality jsonb,
  add column if not exists bond_level integer not null default 1
    check (bond_level between 1 and 100);

comment on column public.creatures.personality is
  'Deterministic game attributes for the collectible; not claims about the real animal.';
