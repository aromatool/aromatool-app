-- ============================================================
-- 20260722_protocol_attach_and_followup_cleanup.sql
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- Două remedieri pe zona Mesaje/Template-uri:
--
--   A. WORDING needs_offer „protocol" + „informații":
--      Le rescriem ca mesaje care ATAȘEAZĂ materialul (protocol /
--      fișă produse), nu doar întreabă. Distribuitorul atașează o
--      dată PDF-ul prin „Materiale atașate implicit" (template_resources)
--      și el pleacă ca buton 📎 în email. Upsert idempotent pe
--      (system_key, language_code).
--
--   B. CURĂȚARE Follow-up: seed-uri vechi de sistem (ex. „Revin cu
--      oferta ta 🍃") au rămas orfane după ce migrația 20260611 a
--      introdus cheile noi sys_fu_*. Le ștergem, păstrând DOAR cele
--      4 mesaje de sistem curente. Istoricul de trimiteri rămâne
--      intact (followup_log.template_id e deja ON DELETE SET NULL).
--      Mesajele PERSONALE (user_id not null) NU sunt atinse.
--
-- ⚠️  Rulează întâi SELECT-ul din secțiunea B ca să vezi exact ce
--     rânduri vor fi șterse, înainte de DELETE.
-- ============================================================

-- ── A. Rescriere mesaje needs_offer (RO + EN) ────────────────
insert into public.followup_templates
  (user_id, trigger_status, trigger_action, trigger_day, plan_required,
   language_code, active, system_key, title, subject, body_html)
values
  -- ─── RO ───────────────────────────────────────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_protocol', 'Trimit protocolul recomandat',
   'Protocolul recomandat pentru tine, {{nume}}',
   '{"type":"sys_offer_protocol","headline":"Protocolul recomandat pentru tine","intro":"Bună {{nume}}, îți atașez mai jos protocolul recomandat — pașii exacți de folosire a produselor, pas cu pas. Aruncă un ochi când ai un moment liber. Dacă vrei, îți pregătesc și o ofertă pe baza lui.","cta":"Vezi protocolul","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_explained', 'Trimit informații despre produse',
   'Câteva informații utile pentru tine, {{nume}}',
   '{"type":"sys_offer_explained","headline":"Câteva informații despre produse","intro":"Bună {{nume}}, îți atașez mai jos câteva informații despre produsele care cred că ți s-ar potrivi și despre cum se folosesc. Citește-le când ai un moment, iar dacă te interesează ceva anume îți pregătesc o ofertă personalizată.","cta":"Vezi informațiile","closing":"Cu drag"}'),

  -- ─── EN ───────────────────────────────────────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_protocol', 'Send the recommended protocol',
   'The recommended protocol for you, {{nume}}',
   '{"type":"sys_offer_protocol","headline":"The recommended protocol for you","intro":"Hi {{nume}}, I''ve attached the recommended protocol below — the exact, step-by-step way to use the products. Take a look when you have a moment. If you''d like, I can also prepare an offer based on it.","cta":"View the protocol","closing":"Warmly"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_explained', 'Send product information',
   'A few helpful notes for you, {{nume}}',
   '{"type":"sys_offer_explained","headline":"A few notes about the products","intro":"Hi {{nume}}, I''ve attached a few notes below about the products I think would suit you and how to use them. Have a look when you can, and if anything catches your eye I''ll prepare a personalized offer.","cta":"View the info","closing":"Warmly"}')

on conflict (system_key, language_code) where system_key is not null do update set
  trigger_status = excluded.trigger_status,
  trigger_action = excluded.trigger_action,
  plan_required  = excluded.plan_required,
  title          = excluded.title,
  subject        = excluded.subject,
  body_html      = excluded.body_html;

-- ── B. Curățare Follow-up orfane ─────────────────────────────
-- Mesajele vechi „Revin cu oferta ta 🍃" sunt seed-uri dinainte de coloana
-- system_key → au system_key = NULL (și user_id = NULL). De aceea condiția
-- `system_key is not null` din versiunea inițială NU le prindea. Includem
-- explicit cazul `system_key is null`: orice mesaj de SISTEM (user_id null)
-- de Follow-up care nu e una din cele 4 chei curente e orfan și se șterge.
--
-- Rulează întâi acest SELECT ca să vezi ce se va șterge:
--
--   select id, system_key, language_code, title, subject, active
--   from public.followup_templates
--   where trigger_action = 'needs_followup'
--     and user_id is null
--     and (system_key is null
--          or system_key not in
--             ('sys_fu_check','sys_fu_questions','sys_fu_help','sys_fu_info'))
--   order by system_key nulls first, language_code;
--
-- Dacă lista arată bine (mesajele vechi „Revin cu oferta ta 🍃" etc.),
-- rulează DELETE-ul:

delete from public.followup_templates
where trigger_action = 'needs_followup'
  and user_id is null
  and (system_key is null
       or system_key not in
          ('sys_fu_check', 'sys_fu_questions', 'sys_fu_help', 'sys_fu_info'));
