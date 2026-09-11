alter table public.creatures
  add column if not exists capture_grade text
    check (capture_grade is null or capture_grade in ('good', 'great', 'perfect')),
  add column if not exists capture_bonus_xp integer not null default 0
    check (capture_bonus_xp between 0 and 50),
  add column if not exists capture_trait text;

comment on column public.creatures.capture_grade is
  'Cosmetic framing grade; never determines whether a legitimate discovery is accepted.';
