-- ============================================================
-- C1: Cursuri valutare live (înlocuiește ratele hardcodate)
-- ============================================================
-- Tabelul public.exchange_rates EXISTĂ DEJA (creat manual), cu schema pe
-- perechi: (from_currency, to_currency, rate, updated_at). `useProducts`
-- citește deja rândul EUR→RON. Reprezentarea „per EUR" pe care o folosește
-- frontend-ul = rândurile cu from_currency='EUR'.
--
-- Această migrare este IDEMPOTENTĂ și NON-DISTRUCTIVĂ:
--   • garantează un index unic pe (from_currency, to_currency) pentru upsert
--   • asigură policy de SELECT (citire) pentru utilizatorii autentificați
--   • seed/insert al perechilor EUR→{valute} cu ultimele valori cunoscute,
--     fără să suprascrie rândurile existente (on conflict do nothing)
-- Scrierea live se face de Edge Function `refresh-rates` (service_role).
-- ============================================================

-- Index unic pentru upsert pe pereche (dacă nu există deja un PK/constraint).
create unique index if not exists exchange_rates_pair_uidx
  on public.exchange_rates (from_currency, to_currency);

-- RLS: citire pentru utilizatorii autentificați (cursurile sunt publice).
alter table public.exchange_rates enable row level security;

drop policy if exists "exchange_rates_select" on public.exchange_rates;
create policy "exchange_rates_select"
  on public.exchange_rates
  for select
  to authenticated
  using (true);

-- (fără policy de INSERT/UPDATE/DELETE → clienții nu pot scrie; service_role da)

-- Seed perechi EUR→valută cu ultimele valori cunoscute (2026-05-29).
-- Nu suprascrie rândurile deja prezente.
insert into public.exchange_rates (from_currency, to_currency, rate, updated_at) values
  ('EUR', 'EUR', 1,        '2026-05-29T00:00:00Z'),
  ('EUR', 'RON', 5.2523,   '2026-05-29T00:00:00Z'),
  ('EUR', 'USD', 1.1644,   '2026-05-29T00:00:00Z'),
  ('EUR', 'GBP', 0.86723,  '2026-05-29T00:00:00Z'),
  ('EUR', 'CHF', 0.9111,   '2026-05-29T00:00:00Z'),
  ('EUR', 'HUF', 353.69,   '2026-05-29T00:00:00Z'),
  ('EUR', 'PLN', 4.2275,   '2026-05-29T00:00:00Z'),
  ('EUR', 'CZK', 24.282,   '2026-05-29T00:00:00Z')
on conflict (from_currency, to_currency) do nothing;
