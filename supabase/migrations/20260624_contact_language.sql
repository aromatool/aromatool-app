-- ============================================================
-- 20260624_contact_language.sql
-- Limba clientului (contact) + variante EN pentru mesajele de sistem.
--
--  1) contacts.language_code — limba preferată a clientului ('ro' | 'en').
--     Default 'ro' (backfill automat pe rândurile existente).
--  2) followup_templates: indexul unic pe system_key devine
--     (system_key, language_code) ca să coexiste RO + EN.
--  3) seed 13 mesaje de sistem în EN (oglindesc variantele RO).
--
-- Oferta foloseşte deja buildEmailHtml(lang) — nu necesită seed aici.
-- ============================================================

-- ── 1) LIMBA CONTACTULUI ─────────────────────────────────────
alter table public.contacts
  add column if not exists language_code text default 'ro';

-- ── 2) INDEX UNIC COMPOZIT (system_key, language_code) ───────
-- Permite acelaşi system_key în mai multe limbi.
drop index if exists public.followup_templates_system_key_idx;

create unique index if not exists followup_templates_system_key_lang_idx
  on public.followup_templates(system_key, language_code)
  where system_key is not null;

-- ── 3) SEED MESAJE DE SISTEM EN (globale, user_id NULL) ──────
-- Upsert pe (system_key, language_code) → re-rularea actualizează textul.
-- body_html este JSON: { type, headline, intro, cta, closing }.

insert into public.followup_templates
  (user_id, trigger_status, trigger_action, trigger_day, plan_required,
   language_code, active, system_key, title, subject, body_html)
values
  -- ─── SEND THE FIRST OFFER (needs_offer) ───────────────────
  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_promised', 'Send the promised offer',
   'Your personalized offer, {{nume}}',
   '{"type":"sys_offer_promised","headline":"Your personalized offer","intro":"Hi {{nume}}, here is the offer I promised you. I picked the products with care, especially for you. Let me know if you have any questions!","cta":"View offer","closing":"Warmly"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_explained', 'Send the offer + explanations',
   'Your offer + a few notes',
   '{"type":"sys_offer_explained","headline":"Your offer, briefly explained","intro":"Hi {{nume}}, I am sending your offer along with a few notes on how to use each product and why I recommend them. I am here for anything you are unsure about.","cta":"View details","closing":"Warmly"}'),

  (null, 'prospect', 'needs_offer', 0, 'starter', 'en', true,
   'sys_offer_protocol', 'Send the offer + protocol',
   'Your offer + the recommended protocol',
   '{"type":"sys_offer_protocol","headline":"Your offer + the recommended protocol","intro":"Hi {{nume}}, along with the offer I am attaching the recommended protocol, so you know exactly how to use the products step by step. Read it whenever you have a free moment.","cta":"View protocol","closing":"Warmly"}'),

  -- ─── SEND FOLLOW-UP (needs_followup) ───────────────────────
  (null, 'prospect', 'needs_followup', 0, 'starter', 'en', true,
   'sys_fu_check', 'Check if they reviewed the offer',
   'Did you get a chance to see the offer, {{nume}}?',
   '{"type":"sys_fu_check","headline":"Did you get a chance to see the offer?","intro":"Hi {{nume}}, I just wanted to check whether you had a chance to look over the offer I sent {{zile}} days ago. If you have any questions, I am here!","cta":"Reply to me","closing":"Warmly"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'en', true,
   'sys_fu_questions', 'Ask if they have questions',
   'Any questions about the offer?',
   '{"type":"sys_fu_questions","headline":"Can I help with anything?","intro":"Hi {{nume}}, I was thinking you might have questions about the products in the offer. Write me anything you are unsure about — I will gladly answer.","cta":"Ask me","closing":"Warmly"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'en', true,
   'sys_fu_help', 'Offer help choosing',
   'Let me help you choose what suits you',
   '{"type":"sys_fu_help","headline":"Let me help you choose","intro":"Hi {{nume}}, if you are not sure which products suit you best, let us figure it out together. Tell me what you are interested in and I will make a personalized recommendation.","cta":"Let us talk","closing":"Warmly"}'),

  (null, 'prospect', 'needs_followup', 0, 'starter', 'en', true,
   'sys_fu_info', 'Send extra information',
   'Some useful information for you',
   '{"type":"sys_fu_info","headline":"Useful information about the products","intro":"Hi {{nume}}, I am sending some extra information that might help you decide. If you would like to talk it over, I am just a message away.","cta":"Learn more","closing":"Warmly"}'),

  -- ─── REACTIVATE THE CONTACT (reactivate) ───────────────────
  (null, 'prospect', 'reactivate', 0, 'starter', 'en', true,
   'sys_re_checkin', 'Simple check-in',
   'How are you, {{nume}}?',
   '{"type":"sys_re_checkin","headline":"How are you?","intro":"Hi {{nume}}, I was thinking of you and wanted to ask how you are doing. I hope you are well! If I can help with anything, you know where to find me.","cta":"Hello!","closing":"Warmly"}'),

  (null, 'prospect', 'reactivate', 0, 'starter', 'en', true,
   'sys_re_resume', 'Resume the conversation',
   'Shall we pick up where we left off?',
   '{"type":"sys_re_resume","headline":"Shall we pick up where we left off?","intro":"Hi {{nume}}, it has been a while since we last spoke. I would love to continue our conversation — tell me how I can help you now.","cta":"Let us talk","closing":"Warmly"}'),

  (null, 'prospect', 'reactivate', 0, 'starter', 'en', true,
   'sys_re_news', 'Share news',
   'I have some news you will like',
   '{"type":"sys_re_news","headline":"I have some news for you","intro":"Hi {{nume}}, there is some news I think you will like. I am sending it your way — take a look when you have a moment.","cta":"See what is new","closing":"Warmly"}'),

  -- ─── TALK ABOUT THE BUSINESS (discuss_business) ────────────
  (null, 'client_nou', 'discuss_business', 0, 'growth', 'en', true,
   'sys_biz_invite', 'Invite to a conversation',
   'An idea I would love to share with you',
   '{"type":"sys_biz_invite","headline":"Let us talk about an opportunity","intro":"Hi {{nume}}, I can see you enjoy the products and that makes me so happy. I have an idea I would love to talk about — no pressure, just a relaxed conversation. Are you open to it?","cta":"Let us talk","closing":"Warmly"}'),

  (null, 'client_nou', 'discuss_business', 0, 'growth', 'en', true,
   'sys_biz_info', 'Send business information',
   'Information about the Young Living opportunity',
   '{"type":"sys_biz_info","headline":"About the Young Living opportunity","intro":"Hi {{nume}}, I am sending you some information about how the business side of Young Living works. Read it at your own pace and tell me what questions you have.","cta":"Learn more","closing":"Warmly"}'),

  (null, 'client_nou', 'discuss_business', 0, 'growth', 'en', true,
   'sys_biz_presentation', 'Send the presentation',
   'The presentation I told you about',
   '{"type":"sys_biz_presentation","headline":"The presentation for you","intro":"Hi {{nume}}, I am attaching the presentation I told you about. It has everything you need to understand the opportunity. Once you have seen it, let us set up a chat.","cta":"View presentation","closing":"Warmly"}')

on conflict (system_key, language_code) where system_key is not null do update set
  trigger_status = excluded.trigger_status,
  trigger_action = excluded.trigger_action,
  plan_required  = excluded.plan_required,
  title          = excluded.title,
  subject        = excluded.subject,
  body_html      = excluded.body_html;
