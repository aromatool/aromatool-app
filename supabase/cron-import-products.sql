-- Cron: sincronizare zilnică a catalogului Young Living
-- Apelează Edge Function `import-products` printr-un POST (pg_net),
-- autentificat cu secretul `x-cron-secret` (același cu secretul funcției CRON_SECRET).
--
-- ⚠️ Rulează O SINGURĂ DATĂ în SQL Editor (sau prin migrare), DUPĂ ce:
--   1) ai deployat funcția:  supabase functions deploy import-products
--   2) ai setat secretul:    supabase secrets set CRON_SECRET=<un-secret-lung-random>
--
-- Înlocuiește <CRON_SECRET> mai jos cu ACELAȘI secret setat la pasul 2.
-- (project ref: kbtstoqrukxwnhpuvglv)

-- ── Extensii necesare ────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── (Re)creează jobul cron ───────────────────────────────────────────
-- Șterge un job existent cu același nume (dacă rulezi scriptul din nou).
select cron.unschedule('import-yl-products')
where exists (select 1 from cron.job where jobname = 'import-yl-products');

-- Rulează zilnic la 03:15 UTC (≈ 05:15/06:15 RO, în afara orelor de vârf).
select cron.schedule(
  'import-yl-products',
  '15 3 * * *',
  $$
  select net.http_post(
    url     := 'https://kbtstoqrukxwnhpuvglv.supabase.co/functions/v1/import-products',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Verificare ───────────────────────────────────────────────────────
-- select jobid, schedule, jobname, active from cron.job where jobname = 'import-yl-products';
-- select * from cron.job_run_details order by start_time desc limit 5;
