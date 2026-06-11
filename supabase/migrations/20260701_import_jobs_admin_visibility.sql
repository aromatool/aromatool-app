-- ─────────────────────────────────────────────────────────────────────
-- Fix: importurile automate (cron) sunt invizibile în panoul Admin
-- ─────────────────────────────────────────────────────────────────────
-- Context:
--   Funcția `import-products` rulată din cron salvează jobul cu
--   triggered_by = NULL (cron-ul nu are user). Politica RLS existentă
--   „Users can manage own import jobs" filtrează tabelul după
--   triggered_by = auth.uid(), deci joburile cron (triggered_by NULL)
--   nu sunt niciodată vizibile pentru admin. AdminPage afișa astfel doar
--   ultimul import MANUAL, nu și sincronizările zilnice automate.
--
--   Fix: politică SELECT suplimentară care lasă adminii să vadă TOATE
--   joburile (manuale + cron). PostgreSQL combină politicile permisive
--   cu OR pe același SELECT, deci politica existentă rămâne neatinsă.
--   Refolosim helperul SECURITY DEFINER public.is_admin() (din
--   20260613_feedback_admin.sql) ca să evităm recursia RLS pe profiles.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists "Admins can view all import jobs"
  on public.product_import_jobs;

create policy "Admins can view all import jobs"
  on public.product_import_jobs
  for select
  to authenticated
  using (public.is_admin());
