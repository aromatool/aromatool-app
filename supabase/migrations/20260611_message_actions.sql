-- ============================================================
-- MESAJE PE ACȚIUNE — reorganizează template-urile de la
-- „follow-up pe zile" la „mesaje recomandate pe intenție",
-- legate direct de Recommended Action.
--
-- Conține:
--  1) coloane noi pe followup_templates: trigger_action, title, system_key
--  2) backfill trigger_action din trigger_status (compat)
--  3) tabel template_resources (resurse implicite per mesaj)
--  4) seed mesaje de sistem (globale, user_id NULL) pentru cele
--     4 acțiuni: needs_offer, needs_followup, reactivate, discuss_business
--
-- NOTĂ: trigger_day rămâne în schemă pentru compatibilitate, dar
-- nu mai e folosit de fluxul pe acțiune (nu mai avem follow-up
-- automat pe zile). Mesajele de sistem îl setează pe 0.
-- ============================================================

-- ── 1) COLOANE NOI ───────────────────────────────────────────
alter table public.followup_templates
  add column if not exists trigger_action text,
  add column if not exists title          text,
  add column if not exists system_key     text;

-- system_key identifică unic un mesaj de sistem (pentru upsert idempotent).
-- Mesajele personale au system_key NULL (mai multe NULL-uri permise).
create unique index if not exists followup_templates_system_key_idx
  on public.followup_templates(system_key)
  where system_key is not null;

create index if not exists followup_templates_action_idx
  on public.followup_templates(trigger_action);

-- ── 2) BACKFILL trigger_action din trigger_status ────────────
-- Template-urile existente de prospect = follow-up după ofertă.
update public.followup_templates
  set trigger_action = 'needs_followup'
  where trigger_action is null and trigger_status = 'prospect';

-- ── 3) TABEL RESURSE IMPLICITE PER MESAJ ─────────────────────
create table if not exists public.template_resources (
  id           uuid        default uuid_generate_v4() primary key,
  template_id  uuid        not null references public.followup_templates(id) on delete cascade,
  resource_id  uuid        not null references public.resources(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (template_id, resource_id)
);

create index if not exists template_resources_template_idx on public.template_resources(template_id);
create index if not exists template_resources_user_idx     on public.template_resources(user_id);

alter table public.template_resources enable row level security;

-- Owner-only: fiecare user vede/gestionează doar legăturile lui.
-- (Mesajele de sistem nu au resurse implicite — userul își atașează propriile fișiere.)
drop policy if exists "Template resources are owner-only" on public.template_resources;
create policy "Template resources are owner-only"
  on public.template_resources for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 4) SEED MESAJE DE SISTEM (globale, user_id NULL) ─────────
-- Upsert pe system_key → re-rularea migrației actualizează textul fără duplicate.
-- body_html este JSON: { type, headline, intro, cta, closing }.

insert into public.followup_templates
  (user_id, trigger_status, trigger_action, trigger_day, plan_required,
   language_code, active, system_key, title, subject, body_html)
values
  -- ─── TRIMITE PRIMA OFERTĂ (needs_offer) ───────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_promised', 'Trimit oferta promisă',
   'Oferta ta personalizată, {{nume}}',
   '{"type":"sys_offer_promised","headline":"Oferta ta personalizată","intro":"Bună {{nume}}, îți trimit oferta pe care ți-am promis-o. Am ales produsele cu grijă, special pentru tine. Spune-mi dacă ai întrebări!","cta":"Vezi oferta","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_explained', 'Trimit oferta + explicații',
   'Oferta ta + câteva explicații',
   '{"type":"sys_offer_explained","headline":"Oferta ta, explicată pe scurt","intro":"Bună {{nume}}, îți trimit oferta împreună cu câteva explicații despre cum se folosește fiecare produs și de ce ți le recomand. Sunt aici pentru orice nelămurire.","cta":"Vezi detaliile","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'ro', true,
   'sys_offer_protocol', 'Trimit oferta + protocol',
   'Oferta ta + protocolul recomandat',
   '{"type":"sys_offer_protocol","headline":"Oferta ta + protocolul recomandat","intro":"Bună {{nume}}, pe lângă ofertă îți atașez și protocolul recomandat, ca să știi exact cum să folosești produsele pas cu pas. Citește-l când ai un moment liber.","cta":"Vezi protocolul","closing":"Cu drag"}'),

  -- ─── TRIMITE FOLLOW-UP (needs_followup) ───────────────────
  (null, 'prospect', 'needs_followup', 0, 'starter', 'ro', true,
   'sys_fu_check', 'Verific dacă a analizat oferta',
   'Ai apucat să vezi oferta, {{nume}}?',
   '{"type":"sys_fu_check","headline":"Ai apucat să vezi oferta?","intro":"Bună {{nume}}, am vrut doar să verific dacă ai apucat să te uiți peste oferta trimisă acum {{zile}} zile. Dacă ai întrebări, sunt aici!","cta":"Răspunde-mi","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'ro', true,
   'sys_fu_questions', 'Întreb dacă are întrebări',
   'Ai vreo întrebare despre ofertă?',
   '{"type":"sys_fu_questions","headline":"Pot să te ajut cu ceva?","intro":"Bună {{nume}}, mă gândeam că poate ai întrebări despre produsele din ofertă. Scrie-mi orice nelămurire — îți răspund cu drag.","cta":"Întreabă-mă","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'ro', true,
   'sys_fu_help', 'Ofer ajutor la alegere',
   'Te ajut să alegi ce ți se potrivește',
   '{"type":"sys_fu_help","headline":"Te ajut să alegi","intro":"Bună {{nume}}, dacă nu ești sigur(ă) ce produse ți se potrivesc cel mai bine, hai să vedem împreună. Spune-mi ce te interesează și îți fac o recomandare personalizată.","cta":"Hai să vorbim","closing":"Cu drag"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'ro', true,
   'sys_fu_info', 'Trimit informații suplimentare',
   'Câteva informații utile pentru tine',
   '{"type":"sys_fu_info","headline":"Informații utile despre produse","intro":"Bună {{nume}}, îți trimit câteva informații suplimentare care te-ar putea ajuta să te decizi. Dacă vrei să discutăm, sunt la un mesaj distanță.","cta":"Află mai multe","closing":"Cu drag"}'),

  -- ─── REACTIVEAZĂ CONTACTUL (reactivate) ───────────────────
  (null, 'prospect', 'reactivate', 0, 'starter', 'ro', true,
   'sys_re_checkin', 'Check-in simplu',
   'Ce mai faci, {{nume}}?',
   '{"type":"sys_re_checkin","headline":"Ce mai faci?","intro":"Bună {{nume}}, mă gândeam la tine și am vrut să te întreb ce mai faci. Sper că ești bine! Dacă pot să te ajut cu ceva, știi unde mă găsești.","cta":"Salut!","closing":"Cu drag"}'),

  (null, 'prospect', 'reactivate', 0, 'starter', 'ro', true,
   'sys_re_resume', 'Reiau conversația',
   'Reluăm de unde am rămas?',
   '{"type":"sys_re_resume","headline":"Reluăm de unde am rămas?","intro":"Bună {{nume}}, a trecut ceva timp de când am vorbit ultima dată. Mi-ar plăcea să reluăm conversația — spune-mi cum te pot ajuta acum.","cta":"Hai să vorbim","closing":"Cu drag"}'),

  (null, 'prospect', 'reactivate', 0, 'starter', 'ro', true,
   'sys_re_news', 'Trimit noutăți',
   'Am noutăți care ți-ar plăcea',
   '{"type":"sys_re_news","headline":"Am câteva noutăți pentru tine","intro":"Bună {{nume}}, au apărut câteva noutăți care cred că ți-ar plăcea. Ți le trimit cu drag — aruncă un ochi când ai un moment.","cta":"Vezi noutățile","closing":"Cu drag"}'),

  -- ─── DISCUTĂ DESPRE BUSINESS (discuss_business) ───────────
  (null, 'client_nou', 'discuss_business', 0, 'growth', 'ro', true,
   'sys_biz_invite', 'Invit la discuție',
   'O idee pe care vreau s-o împărtășesc cu tine',
   '{"type":"sys_biz_invite","headline":"Hai să vorbim despre o oportunitate","intro":"Bună {{nume}}, văd că îți plac produsele și mă bucur enorm. Am o idee despre care mi-ar plăcea să vorbim — fără presiune, doar o conversație relaxată. Ești deschis(ă)?","cta":"Hai să vorbim","closing":"Cu drag"}'),

  (null, 'client_nou', 'discuss_business', 0, 'growth', 'ro', true,
   'sys_biz_info', 'Trimit informații business',
   'Informații despre oportunitatea Young Living',
   '{"type":"sys_biz_info","headline":"Despre oportunitatea Young Living","intro":"Bună {{nume}}, îți trimit câteva informații despre cum funcționează partea de business cu Young Living. Citește-le fără grabă și spune-mi ce întrebări ai.","cta":"Află mai multe","closing":"Cu drag"}'),

  (null, 'client_nou', 'discuss_business', 0, 'growth', 'ro', true,
   'sys_biz_presentation', 'Trimit prezentarea',
   'Prezentarea despre care ți-am povestit',
   '{"type":"sys_biz_presentation","headline":"Prezentarea pentru tine","intro":"Bună {{nume}}, îți atașez prezentarea despre care ți-am povestit. Are tot ce trebuie ca să înțelegi oportunitatea. După ce o vezi, hai să stabilim o discuție.","cta":"Vezi prezentarea","closing":"Cu drag"}')

on conflict (system_key) where system_key is not null do update set
  trigger_status = excluded.trigger_status,
  trigger_action = excluded.trigger_action,
  plan_required  = excluded.plan_required,
  title          = excluded.title,
  subject        = excluded.subject,
  body_html      = excluded.body_html;
