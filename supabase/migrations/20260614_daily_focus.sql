-- ============================================================
-- DAILY FOCUS EMAIL
-- 1. profiles: preferințe (activare, oră, timezone) + dedupe trimitere.
-- 2. daily_focus_jobs: monitorizare rulări (procesați / trimise / eșuate).
-- Scheduling-ul (pg_cron + pg_net) se configurează separat după deploy,
-- fiindcă depinde de URL-ul funcției și de secretul de cron.
-- ============================================================

-- ── PROFILES: preferințe Daily Focus ───────────────────────
alter table public.profiles
  add column if not exists daily_focus_enabled boolean not null default false;

alter table public.profiles
  add column if not exists daily_focus_hour int not null default 8
    check (daily_focus_hour between 5 and 12);

-- Timezone IANA al utilizatorului (ex: 'Europe/Bucharest'). Folosit ca să
-- trimitem la ora locală aleasă, nu la ora serverului.
alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Bucharest';

-- Ultima zi (în timezone-ul userului) în care s-a trimis Daily Focus.
-- Previne dublarea când cron-ul rulează din oră în oră.
alter table public.profiles
  add column if not exists daily_focus_last_sent date;

-- ── DAILY FOCUS JOBS: monitorizare ─────────────────────────
create table if not exists public.daily_focus_jobs (
  id               uuid        default uuid_generate_v4() primary key,
  run_at           timestamptz not null default now(),
  trigger          text        not null default 'cron'
                     check (trigger in ('cron','manual')),
  users_processed  int         not null default 0,
  emails_sent      int         not null default 0,
  emails_failed    int         not null default 0,
  errors           jsonb       not null default '[]'::jsonb,
  completed_at     timestamptz
);

create index if not exists daily_focus_jobs_run_idx
  on public.daily_focus_jobs (run_at desc);

alter table public.daily_focus_jobs enable row level security;

-- Doar adminii pot citi istoricul rulărilor (scrierea o face service_role,
-- care ocolește RLS din Edge Function).
create policy "Admin views daily focus jobs"
  on public.daily_focus_jobs for select to authenticated
  using (public.is_admin());
