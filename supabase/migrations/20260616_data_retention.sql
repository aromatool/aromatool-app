-- ============================================================
-- DATA RETENTION — curățarea automată a logurilor de email.
-- Politica GDPR: păstrăm logurile de email maximum 12 luni.
-- Funcția șterge rândurile vechi din followup_log; programarea
-- cu pg_cron se face manual după deploy (vezi mai jos).
-- ============================================================

-- Funcție de curățare: șterge logurile mai vechi de 12 luni.
create or replace function public.purge_old_email_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.followup_log
  where sent_at is not null
    and sent_at < now() - interval '12 months';
$$;

-- ── PROGRAMARE (manual, după deploy) ────────────────────────
-- Necesită extensia pg_cron activată (Dashboard → Database → Extensions).
-- Rulează o dată pe zi, la 03:15. Decomentează și execută în SQL Editor:
--
--   select cron.schedule(
--     'purge-old-email-logs',
--     '15 3 * * *',
--     $$ select public.purge_old_email_logs(); $$
--   );
--
-- Pentru a opri job-ul:
--   select cron.unschedule('purge-old-email-logs');
