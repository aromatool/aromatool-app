-- ============================================================
-- Migration: extinde retenția datelor (audit, MEDIUM)
-- Data: 2026-07-14
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- PROBLEMĂ: purge_old_email_logs() curăța DOAR followup_log. Restul tabelelor
-- de loguri creșteau la nesfârșit, inclusiv webhook_log care conține emailuri
-- de contacte în `payload` (date personale) → risc GDPR (minimizare + retenție).
--
-- SOLUȚIE: aceeași funcție curăță acum toate logurile, cu intervale adaptate
-- scopului fiecăruia:
--   • followup_log        → 12 luni (istoric comunicare)
--   • webhook_log         → 12 luni (conține date personale în payload)
--   • account_email_log   → 12 luni (dedupe lifecycle pe ciclu de trial)
--   • email_send_log      →  2 luni (doar pentru rate-limit pe oră/zi)
--   • daily_focus_jobs    →  6 luni (monitorizare rulări cron)
--   • account_email_jobs  →  6 luni (monitorizare rulări cron)
-- ============================================================

create or replace function public.purge_old_email_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Istoric comunicare (12 luni)
  delete from public.followup_log
  where sent_at is not null
    and sent_at < now() - interval '12 months';

  -- Webhook-uri (conțin date personale în payload) — 12 luni
  delete from public.webhook_log
  where processed_at is not null
    and processed_at < now() - interval '12 months';

  -- Dedupe lifecycle (12 luni)
  delete from public.account_email_log
  where sent_at < now() - interval '12 months';

  -- Contoare rate-limit — nu sunt utile decât 24h; păstrăm 2 luni marjă
  delete from public.email_send_log
  where sent_at < now() - interval '2 months';

  -- Monitorizare rulări cron (6 luni)
  delete from public.daily_focus_jobs
  where run_at < now() - interval '6 months';

  delete from public.account_email_jobs
  where run_at < now() - interval '6 months';
end;
$$;

-- ── PROGRAMARE (manual, după deploy) ─────────────────────────
-- Dacă job-ul nu e deja programat (vezi 20260616_data_retention.sql), rulează:
--
--   select cron.schedule(
--     'purge-old-email-logs',
--     '15 3 * * *',
--     $$ select public.purge_old_email_logs(); $$
--   );
--
-- Funcția fiind înlocuită (CREATE OR REPLACE), un job deja programat va rula
-- automat noua versiune — nu e nevoie să-l reprogramezi.
