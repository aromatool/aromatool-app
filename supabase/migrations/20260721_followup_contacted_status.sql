-- ════════════════════════════════════════════════════════════════
-- 20260721_followup_contacted_status.sql
-- Status nou „contacted" în followup_log = „Am vorbit deja".
--
-- Context: butonul „Am vorbit deja" notează o atingere când liderul a
-- discutat deja cu persoana în afara aplicației (telefon, WhatsApp etc.),
-- fără să trimită un email din app. Asta scoate contactul din „Focus today".
--
-- Până acum foloseam statusul `sent`, dar feed-ul de activitate îl citea ca
-- „Email trimis" → etichetă greșită (nu s-a trimis niciun email). Adăugăm un
-- status dedicat, neutru pe canal, afișat ca „Conversație notată".
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

alter table public.followup_log
  drop constraint if exists followup_log_status_check;

alter table public.followup_log
  add constraint followup_log_status_check
    check (status in ('pending','sent','whatsapp_initiated','contacted','failed','skipped'));
