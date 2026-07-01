-- ════════════════════════════════════════════════════════════════
-- 20260723_newsletter_broadcast.sql
-- „Newsletter" — trimitere de anunțuri/noutăți către PROPRIII useri
-- AromaTool (Brand Partners cu cont), din secțiunea Admin.
--
-- 1) profiles.product_emails_opt_out — dezabonare de la newsletter,
--    SEPARAT de account_emails_opt_out (emailuri despre cont/abonament).
--    Astfel un user poate opri noutățile fără să piardă remindele de trial.
-- 2) broadcast_log — istoric al trimiterilor (ce s-a trimis, către câți).
--    Scris de Edge Function (service_role); citit de admini în UI.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- ── Dezabonare de la newsletter (marketing/noutăți) ──────────────
alter table public.profiles
  add column if not exists product_emails_opt_out boolean not null default false;

alter table public.profiles
  add column if not exists product_emails_opt_out_at timestamptz;

comment on column public.profiles.product_emails_opt_out is
  'Userul s-a dezabonat de la newsletter/anunțuri (separat de account_emails_opt_out).';

-- ── Istoric trimiteri newsletter ─────────────────────────────────
create table if not exists public.broadcast_log (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  recipients  integer not null default 0,   -- câți eligibili la momentul trimiterii
  sent        integer not null default 0,   -- livrate cu succes
  failed      integer not null default 0,   -- eșuate
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_broadcast_log_created
  on public.broadcast_log(created_at desc);

-- RLS: adminii pot citi istoricul din UI. Inserarea o face Edge Function
-- cu service_role (ocolește RLS), deci nu e nevoie de policy de insert.
alter table public.broadcast_log enable row level security;

drop policy if exists "broadcast_log: admin read" on public.broadcast_log;
create policy "broadcast_log: admin read"
  on public.broadcast_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
