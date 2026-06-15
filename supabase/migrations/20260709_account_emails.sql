-- ============================================================
-- 20260709_account_emails.sql
-- Email-uri LIFECYCLE pentru userii AromaTool (distribuitorii), NU
-- pentru clienții lor. Secvența de reminder la expirarea trialului:
--   • trial_t3      — cu 3 zile înainte de expirare
--   • trial_t1      — în ultima zi
--   • trial_expired — chiar după expirare, dacă nu s-a abonat
--
-- Componente:
--   1) profiles.account_emails_opt_out — dezabonare (one-click + Setări).
--   2) account_email_log — dedupe per CICLU de trial (trial_ends_at), ca
--      re-extinderea trialului (ex. cod de lansare) să permită un nou set.
--   3) account_email_jobs — monitorizare rulări (ca daily_focus_jobs).
--
-- Scrierea se face din Edge Function cu service_role (ocolește RLS).
-- ============================================================

-- ── 1) DEZABONARE EMAIL-URI DE CONT ──────────────────────────
alter table public.profiles
  add column if not exists account_emails_opt_out boolean not null default false;

-- ── 2) LOG DEDUPE (per user + tip + ciclu de trial) ──────────
create table if not exists public.account_email_log (
  id            uuid        default uuid_generate_v4() primary key,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  kind          text        not null
                  check (kind in ('trial_t3','trial_t1','trial_expired')),
  -- Ciclul de trial pentru care s-a trimis. NULL pentru trial_expired
  -- înseamnă „fără trial_ends_at", dar în practică îl avem mereu.
  trial_ends_at timestamptz,
  sent_at       timestamptz not null default now()
);

-- Un singur email de fiecare tip, per ciclu de trial. Dacă trial_ends_at se
-- schimbă (re-extindere), cheia devine nouă → secvența se poate relua.
create unique index if not exists account_email_log_uq
  on public.account_email_log (user_id, kind, trial_ends_at);

alter table public.account_email_log enable row level security;

-- Doar adminii citesc; scrierea o face service_role din Edge Function.
create policy "Admin views account email log"
  on public.account_email_log for select to authenticated
  using (public.is_admin());

-- ── 3) MONITORIZARE RULĂRI ───────────────────────────────────
create table if not exists public.account_email_jobs (
  id              uuid        default uuid_generate_v4() primary key,
  run_at          timestamptz not null default now(),
  trigger         text        not null default 'cron'
                    check (trigger in ('cron','manual')),
  users_processed int         not null default 0,
  emails_sent     int         not null default 0,
  emails_failed   int         not null default 0,
  errors          jsonb       not null default '[]'::jsonb,
  completed_at    timestamptz
);

create index if not exists account_email_jobs_run_idx
  on public.account_email_jobs (run_at desc);

alter table public.account_email_jobs enable row level security;

create policy "Admin views account email jobs"
  on public.account_email_jobs for select to authenticated
  using (public.is_admin());
