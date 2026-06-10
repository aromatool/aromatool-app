-- ============================================================
-- Migration: Communication Controls
-- Data: 2026-06-07
-- Rulează în: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── COLOANE NOI PE CONTACTS ──────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_opt_out            boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_out_at         timestamptz,
  ADD COLUMN IF NOT EXISTS communication_blocked    boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS communication_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS communication_blocked_reason text;

-- ── EMAIL TRACKING COUNTERS ─────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_opens  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_clicks integer DEFAULT 0;

-- ── INDEX (filtrare rapidă pe blocked) ──────────────────────

CREATE INDEX IF NOT EXISTS contacts_user_blocked_idx
  ON public.contacts(user_id, communication_blocked)
  WHERE communication_blocked = true;

-- ── WEBHOOK LOG (opțional, tracking dezabonări Resend) ──────

CREATE TABLE IF NOT EXISTS public.webhook_log (
  id           uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  source       text        NOT NULL,                -- 'resend'
  event_type   text        NOT NULL,                -- 'contact.unsubscribed', 'email.complained', etc.
  payload      jsonb,
  processed_at timestamptz DEFAULT now(),
  contact_id   uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes        text
);

-- Nimeni din frontend nu poate citi logul de webhookuri
-- (acces doar prin service_role)
ALTER TABLE public.webhook_log ENABLE ROW LEVEL SECURITY;
