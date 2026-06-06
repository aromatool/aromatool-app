-- ============================================================
-- Migration: performance indexes + admin flag
-- Data: 2026-06-06
-- Rulează în: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── INDEXE PERFORMANȚĂ ────────────────────────────────────────

-- contacts: filtru CRM (WHERE user_id = $1 AND status = $2)
CREATE INDEX IF NOT EXISTS contacts_user_status_idx
  ON public.contacts(user_id, status);

-- contacts: sortare după dată creare (Dashboard "adăugat recent")
CREATE INDEX IF NOT EXISTS contacts_user_created_idx
  ON public.contacts(user_id, created_at DESC);

-- offers: ContactModal timeline (WHERE user_id = $1 AND contact_id = $2 ORDER BY sent_at)
CREATE INDEX IF NOT EXISTS offers_user_contact_sent_idx
  ON public.offers(user_id, contact_id, sent_at DESC);

-- followup_templates: fetch per user
CREATE INDEX IF NOT EXISTS followup_templates_user_idx
  ON public.followup_templates(user_id);

-- followup_log: fetch per contact (timeline)
CREATE INDEX IF NOT EXISTS followup_log_contact_idx
  ON public.followup_log(contact_id, sent_at DESC);


-- ── ADMIN FLAG ────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Setează adminul principal (înlocuiește cu user ID-ul tău real)
-- UPDATE public.profiles SET is_admin = true WHERE id = '044e532c-df6f-462f-ac15-a5f312a89e6a';


-- ── COLOANE LIPSĂ (dacă nu au fost aplicate migrările anterioare) ──

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follow_up_days  integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_followups   integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS followup_enabled boolean DEFAULT true;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source                   text,
  ADD COLUMN IF NOT EXISTS followup_count           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_opted_out       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_high_interest     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_business_interest boolean DEFAULT false;

-- Extinde CHECK constraint pe contacts.status
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_status_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_status_check
    CHECK (status IN ('prospect','in_followup','client_nou','client_fidel','team_member','inactiv'));

-- Extinde CHECK constraint pe followup_log.status
ALTER TABLE public.followup_log
  DROP CONSTRAINT IF EXISTS followup_log_status_check;

ALTER TABLE public.followup_log
  ADD CONSTRAINT followup_log_status_check
    CHECK (status IN ('pending','sent','whatsapp_initiated','failed','skipped'));

-- offers: adaugă currency și total_display dacă lipsesc
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS currency      text DEFAULT 'RON',
  ADD COLUMN IF NOT EXISTS total_display numeric;

-- followup_templates: adaugă user_id dacă lipsește
ALTER TABLE public.followup_templates
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS followup_templates_user_id_idx
  ON public.followup_templates(user_id);
