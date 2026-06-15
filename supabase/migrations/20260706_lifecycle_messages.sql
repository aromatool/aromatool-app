-- ============================================================
-- 20260706_lifecycle_messages.sql
-- Mesaje de sistem pentru etapele de viață ale CLIENTULUI care
-- lipseau: întâmpinarea clientului nou (post-achiziție),
-- reaprovizionarea lunară și win-back-ul clienților tăcuți.
--
-- Acțiuni noi în motorul de recomandări (recommendedAction.ts):
--   • first_order — client nou, sub pragul de reaprovizionare (30 zile)
--   • reorder     — client activ, ~30-60 zile de la ultima activitate
--   • (win-back)  — variante suplimentare pe trigger_action 'reactivate',
--                   de data asta pentru clienți, nu doar prospecți
--
-- Toate sunt pe planul 'starter' (disponibile tuturor) — partea de
-- business rămâne pe 'growth'. body_html este JSON:
--   { type, headline, intro, cta, closing }.
-- Upsert pe (system_key, language_code) → re-rularea actualizează textul.
-- ============================================================

insert into public.followup_templates
  (user_id, trigger_status, trigger_action, trigger_day, plan_required,
   language_code, active, system_key, title, subject, body_html)
values
  -- ════════════════════════════════════════════════════════════
  -- RO
  -- ════════════════════════════════════════════════════════════

  -- ─── CLIENT NOU / POST-ACHIZIȚIE (first_order) ────────────────
  (null, 'client_nou', 'first_order', 0, 'starter', 'ro', true,
   'sys_first_thanks', 'Mulțumesc pentru încredere',
   'Îți mulțumesc, {{nume}}!',
   '{"type":"sys_first_thanks","headline":"Mulțumesc pentru încredere","intro":"Bună {{nume}}, voiam doar să-ți mulțumesc din suflet pentru comandă. Mă bucur tare mult că ai ales să încerci produsele și sper să te bucuri de ele. Dacă ai nevoie de orice, sunt aici.","cta":"Scrie-mi oricând","closing":"Cu drag"}'),

  (null, 'client_nou', 'first_order', 0, 'starter', 'ro', true,
   'sys_first_start', 'Te ajut să începi',
   'Cum folosești produsele, {{nume}}',
   '{"type":"sys_first_start","headline":"Hai să începem cu dreptul","intro":"Bună {{nume}}, ca să profiți la maxim de produsele tale, îți las câteva idei simple despre cum le poți folosi în fiecare zi. Dacă vrei, îți pregătesc și un mic ghid pas cu pas — spune-mi.","cta":"Arată-mi cum","closing":"Cu drag"}'),

  (null, 'client_nou', 'first_order', 0, 'starter', 'ro', true,
   'sys_first_howgoing', 'Cum merg produsele?',
   'Cum te înțelegi cu produsele, {{nume}}?',
   '{"type":"sys_first_howgoing","headline":"Cum merg produsele?","intro":"Bună {{nume}}, a trecut puțin timp de la comanda ta și am vrut să te întreb cum te înțelegi cu produsele. Îți plac? Ai întrebări despre cum să le folosești? Spune-mi, mă bucur să te ajut.","cta":"Spune-mi cum e","closing":"Cu drag"}'),

  -- ─── REAPROVIZIONARE / NUDGE LUNAR (reorder) ──────────────────
  (null, 'client_nou', 'reorder', 0, 'starter', 'ro', true,
   'sys_reorder_low', 'Ți se apropie de final?',
   'Mai ai produse, {{nume}}?',
   '{"type":"sys_reorder_low","headline":"Ți se apropie de final?","intro":"Bună {{nume}}, mă gândeam că poate ți se apropie de final produsele preferate. Dacă vrei, îți pregătesc din timp o nouă comandă ca să nu rămâi fără. Spune-mi de ce ai nevoie.","cta":"Refacem comanda","closing":"Cu drag"}'),

  (null, 'client_nou', 'reorder', 0, 'starter', 'ro', true,
   'sys_reorder_monthly', 'Refacem comanda lunară?',
   'Comanda ta lunară, {{nume}}',
   '{"type":"sys_reorder_monthly","headline":"Refacem comanda lunară?","intro":"Bună {{nume}}, a trecut aproape o lună de la ultima comandă. Dacă vrei să-ți refaci stocul de produse preferate, sunt aici să te ajut — îți pregătesc totul cât ai zice pește.","cta":"Da, hai să refacem","closing":"Cu drag"}'),

  (null, 'client_nou', 'reorder', 0, 'starter', 'ro', true,
   'sys_reorder_more', 'Ce ai mai vrea să încerci?',
   'O idee nouă pentru tine, {{nume}}',
   '{"type":"sys_reorder_more","headline":"Ce ai mai vrea să încerci?","intro":"Bună {{nume}}, dacă tot îți place ce ai comandat până acum, poate ai vrea să descoperi și altceva. Spune-mi ce te interesează și îți recomand cu drag câteva produse care s-ar potrivi cu ce folosești deja.","cta":"Vreau o recomandare","closing":"Cu drag"}'),

  -- ─── WIN-BACK CLIENȚI TĂCUȚI (reactivate) ─────────────────────
  (null, 'client_nou', 'reactivate', 0, 'starter', 'ro', true,
   'sys_re_missyou', 'Mi-a fost dor de tine',
   'Mi-a fost dor de tine, {{nume}}',
   '{"type":"sys_re_missyou","headline":"Mi-a fost dor de tine","intro":"Bună {{nume}}, a trecut ceva timp de când nu am mai vorbit și mi-a fost dor de tine. Sper că ești bine! Dacă vrei să reluăm de unde am rămas, eu sunt aici cu drag.","cta":"Hai să vorbim","closing":"Cu drag"}'),

  (null, 'client_nou', 'reactivate', 0, 'starter', 'ro', true,
   'sys_re_favorites', 'Ai rămas fără preferate?',
   'Ți-au mai rămas produse, {{nume}}?',
   '{"type":"sys_re_favorites","headline":"Ai rămas fără preferatele tale?","intro":"Bună {{nume}}, mi-am dat seama că a trecut ceva vreme de la ultima ta comandă și m-am gândit că poate ai rămas fără produsele preferate. Dacă vrei, le pregătim din nou împreună — spune-mi.","cta":"Refacem comanda","closing":"Cu drag"}'),

  -- ════════════════════════════════════════════════════════════
  -- EN
  -- ════════════════════════════════════════════════════════════

  -- ─── NEW CLIENT / POST-PURCHASE (first_order) ─────────────────
  (null, 'client_nou', 'first_order', 0, 'starter', 'en', true,
   'sys_first_thanks', 'Thank you for trusting me',
   'Thank you, {{nume}}!',
   '{"type":"sys_first_thanks","headline":"Thank you for your trust","intro":"Hi {{nume}}, I just wanted to thank you from the heart for your order. I am so glad you chose to try the products and I hope you enjoy them. If you need anything at all, I am here.","cta":"Write me anytime","closing":"Warmly"}'),

  (null, 'client_nou', 'first_order', 0, 'starter', 'en', true,
   'sys_first_start', 'Help you get started',
   'How to use your products, {{nume}}',
   '{"type":"sys_first_start","headline":"Let us start on the right foot","intro":"Hi {{nume}}, to get the most out of your products, here are a few simple ideas on how to use them every day. If you would like, I can put together a little step-by-step guide for you — just say the word.","cta":"Show me how","closing":"Warmly"}'),

  (null, 'client_nou', 'first_order', 0, 'starter', 'en', true,
   'sys_first_howgoing', 'How are the products working out?',
   'How are you getting on, {{nume}}?',
   '{"type":"sys_first_howgoing","headline":"How are the products working out?","intro":"Hi {{nume}}, it has been a little while since your order and I wanted to ask how you are getting on with the products. Do you like them? Any questions about how to use them? Let me know, I am happy to help.","cta":"Tell me how it is going","closing":"Warmly"}'),

  -- ─── REORDER / MONTHLY NUDGE (reorder) ────────────────────────
  (null, 'client_nou', 'reorder', 0, 'starter', 'en', true,
   'sys_reorder_low', 'Running low?',
   'Are you running low, {{nume}}?',
   '{"type":"sys_reorder_low","headline":"Running low?","intro":"Hi {{nume}}, I was thinking your favourites might be running low. If you like, I can get a new order ready in good time so you do not run out. Just tell me what you need.","cta":"Reorder now","closing":"Warmly"}'),

  (null, 'client_nou', 'reorder', 0, 'starter', 'en', true,
   'sys_reorder_monthly', 'Time for your monthly order?',
   'Your monthly order, {{nume}}',
   '{"type":"sys_reorder_monthly","headline":"Time for your monthly order?","intro":"Hi {{nume}}, it has been almost a month since your last order. If you would like to restock your favourites, I am here to help — I will have everything ready in no time.","cta":"Yes, let us restock","closing":"Warmly"}'),

  (null, 'client_nou', 'reorder', 0, 'starter', 'en', true,
   'sys_reorder_more', 'Anything else you would like to try?',
   'A new idea for you, {{nume}}',
   '{"type":"sys_reorder_more","headline":"Anything else you would like to try?","intro":"Hi {{nume}}, since you are enjoying what you have ordered so far, you might like to discover something new too. Tell me what you are curious about and I will gladly recommend a few products that pair well with what you already use.","cta":"I would like a recommendation","closing":"Warmly"}'),

  -- ─── WIN-BACK SILENT CLIENTS (reactivate) ─────────────────────
  (null, 'client_nou', 'reactivate', 0, 'starter', 'en', true,
   'sys_re_missyou', 'I have missed you',
   'I have missed you, {{nume}}',
   '{"type":"sys_re_missyou","headline":"I have missed you","intro":"Hi {{nume}}, it has been a while since we last spoke and I have missed you. I hope you are doing well! If you would like to pick up where we left off, I am here and happy to help.","cta":"Let us talk","closing":"Warmly"}'),

  (null, 'client_nou', 'reactivate', 0, 'starter', 'en', true,
   'sys_re_favorites', 'Out of your favourites?',
   'Are you still stocked up, {{nume}}?',
   '{"type":"sys_re_favorites","headline":"Out of your favourites?","intro":"Hi {{nume}}, I realised it has been a while since your last order and thought you might be out of your favourite products. If you like, we can get them ready again together — just let me know.","cta":"Reorder now","closing":"Warmly"}')

on conflict (system_key, language_code) where system_key is not null do update set
  trigger_status = excluded.trigger_status,
  trigger_action = excluded.trigger_action,
  plan_required  = excluded.plan_required,
  title          = excluded.title,
  subject        = excluded.subject,
  body_html      = excluded.body_html;
