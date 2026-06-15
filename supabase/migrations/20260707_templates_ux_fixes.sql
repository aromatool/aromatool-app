-- ============================================================
-- 20260707_templates_ux_fixes.sql
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- Două remedieri pe zona Mesaje/Template-uri:
--
--   A. ȘTERGERE MESAJE PROPRII: followup_log.template_id referă
--      followup_templates(id) FĂRĂ ON DELETE → orice mesaj folosit
--      măcar o dată la o trimitere nu putea fi șters (FK 23503).
--      Trecem pe ON DELETE SET NULL: ștergerea mesajului golește
--      referința în log, dar PĂSTREAZĂ istoricul de trimiteri.
--
--   B. WORDING MESAJE needs_offer: cele 3 mesaje de sistem
--      (sys_offer_promised / _explained / _protocol) promiteau în
--      email o ofertă/explicații pe care emailul de TEXT nu le poate
--      purta (oferta reală pleacă din Calculator, cu tabel de produse).
--      Le rescriem ca mesaje ONESTE de prim-contact / însoțire.
--      Upsert pe (system_key, language_code) → idempotent.
-- ============================================================

-- ── A. followup_log.template_id → ON DELETE SET NULL ─────────
alter table public.followup_log
  drop constraint if exists followup_log_template_id_fkey;

alter table public.followup_log
  add constraint followup_log_template_id_fkey
  foreign key (template_id) references public.followup_templates(id)
  on delete set null;

-- ── B. Rescriere mesaje needs_offer (RO + EN) ────────────────
insert into public.followup_templates
  (user_id, trigger_status, trigger_action, trigger_day, plan_required,
   language_code, active, system_key, title, subject, body_html)
values
  -- ─── RO ───────────────────────────────────────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_promised', 'Pregătesc oferta personalizată',
   'Hai să-ți pregătesc oferta, {{nume}}',
   '{"type":"sys_offer_promised","headline":"Îți pregătesc o ofertă personalizată","intro":"Bună {{nume}}, mă bucur de interesul tău! Ca să-ți fac o ofertă cât mai potrivită, spune-mi ce produse sau ce nevoi ai în minte. Revin cât pot de repede cu oferta personalizată, special pentru tine.","cta":"Spune-mi ce te interesează","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_explained', 'Trimit informații despre produse',
   'Câteva informații utile pentru tine, {{nume}}',
   '{"type":"sys_offer_explained","headline":"Câteva informații despre produse","intro":"Bună {{nume}}, îți trimit câteva informații despre produsele care cred că ți s-ar potrivi și despre cum se folosesc. Spune-mi ce te interesează și îți pregătesc o ofertă personalizată. Sunt aici pentru orice nelămurire.","cta":"Hai să vorbim","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_protocol', 'Trimit protocolul recomandat',
   'Protocolul recomandat pentru tine, {{nume}}',
   '{"type":"sys_offer_protocol","headline":"Protocolul recomandat pentru tine","intro":"Bună {{nume}}, îți pot trimite protocolul recomandat — pașii exacți de folosire a produselor — și o ofertă pe baza lui. Spune-mi dacă te interesează și ți le pregătesc.","cta":"Vreau protocolul","closing":"Cu drag"}'),

  -- ─── EN ───────────────────────────────────────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_promised', 'Prepare a personalized offer',
   'Let me prepare your offer, {{nume}}',
   '{"type":"sys_offer_promised","headline":"I''ll prepare a personalized offer for you","intro":"Hi {{nume}}, I''m so glad you''re interested! So I can put together the right offer, tell me which products or needs you have in mind. I''ll get back to you shortly with a personalized offer, just for you.","cta":"Tell me what you''re interested in","closing":"Warmly"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_explained', 'Send product information',
   'A few helpful notes for you, {{nume}}',
   '{"type":"sys_offer_explained","headline":"A few notes about the products","intro":"Hi {{nume}}, I''m sending you a few notes about the products I think would suit you and how to use them. Tell me what you''re interested in and I''ll prepare a personalized offer. I''m here for anything you''re unsure about.","cta":"Let''s talk","closing":"Warmly"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_protocol', 'Send the recommended protocol',
   'The recommended protocol for you, {{nume}}',
   '{"type":"sys_offer_protocol","headline":"The recommended protocol for you","intro":"Hi {{nume}}, I can send you the recommended protocol — the exact steps for using the products — and an offer based on it. Let me know if you''re interested and I''ll prepare them for you.","cta":"I''d like the protocol","closing":"Warmly"}')

on conflict (system_key, language_code) where system_key is not null do update set
  trigger_status = excluded.trigger_status,
  trigger_action = excluded.trigger_action,
  plan_required  = excluded.plan_required,
  title          = excluded.title,
  subject        = excluded.subject,
  body_html      = excluded.body_html;
