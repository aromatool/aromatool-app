-- ============================================================
-- TRIAL & SUBSCRIPTION — perioada de trial de 14 zile.
-- Adaugă trial_ends_at în profiles. Accesul în aplicație =
-- abonament activ SAU azi < trial_ends_at.
-- ============================================================

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

-- Conturi noi: trial implicit de 14 zile de la creare.
alter table public.profiles
  alter column trial_ends_at set default (now() + interval '14 days');

-- Backfill pentru conturile existente: 14 zile de la created_at.
update public.profiles
set trial_ends_at = coalesce(created_at, now()) + interval '14 days'
where trial_ends_at is null;
