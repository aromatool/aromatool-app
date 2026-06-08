-- ============================================================
-- SEMNĂTURĂ EMAIL — text liber, personalizabil din Setări.
-- Apare la finalul emailurilor (ofertă + follow-up), ca sign-off
-- al distribuitorului. Dacă e gol, emailurile folosesc fallback-ul
-- generic existent.
-- ============================================================

alter table public.profiles
  add column if not exists email_signature text;
