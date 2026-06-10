-- Cron: actualizare zilnică a cursurilor valutare (C1)
-- Apelează Edge Function `refresh-rates` printr-un POST (pg_net),
-- autentificat cu secretul `x-cron-secret` (= secretul funcției CRON_SECRET).
--
-- ⚠️ Rulează O SINGURĂ DATĂ în SQL Editor, DUPĂ ce:
--   1) ai aplicat migrarea:  supabase/migrations/20260625_exchange_rates.sql
--   2) ai deployat funcția:   supabase functions deploy refresh-rates
--   3) ai setat secretul:     supabase secrets set CRON_SECRET=<acelasi-secret>
--      (același CRON_SECRET ca la import-products / daily-focus)
--
-- Înlocuiește <CRON_SECRET> mai jos cu ACELAȘI secret.
-- (project ref: kbtstoqrukxwnhpuvglv)

-- ── Extensii necesare ────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── (Re)creează jobul cron ───────────────────────────────────────────
select cron.unschedule('refresh-exchange-rates')
where exists (select 1 from cron.job where jobname = 'refresh-exchange-rates');

-- Rulează zilnic la 03:05 UTC (frankfurter publică ratele ECB ~16:00 CET;
-- la 03:05 a doua zi sunt deja disponibile).
select cron.schedule(
  'refresh-exchange-rates',
  '5 3 * * *',
  $$
  select net.http_post(
    url     := 'https://kbtstoqrukxwnhpuvglv.supabase.co/functions/v1/refresh-rates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '0d207efca20435419bf9a8e1eb151de14e4eba29c710cce01308c73c6b447ea8'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Verificare ───────────────────────────────────────────────────────
-- select jobid, schedule, jobname, active from cron.job where jobname = 'refresh-exchange-rates';
-- select * from cron.job_run_details order by start_time desc limit 5;
-- select * from public.exchange_rates where from_currency = 'EUR' order by to_currency;
