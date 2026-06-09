-- ============================================================
-- FIX SIGNUP STATUS — conturile noi NU mai pornesc ca „active".
--
-- PROBLEMA: default-ul coloanei profiles.subscription_status era
-- 'active'. Trigger-ul handle_new_user nu setează coloana, deci
-- orice cont nou prelua default-ul => era tratat ca abonat activ
-- => paywall-ul nu se declanșa niciodată, trial-ul devenea inutil
-- și nu se încasa nimic.
--
-- MODEL CORECT:
--   • La signup: fără abonament (status = null). Accesul vine din
--     trial_ends_at (default now() + trial_days()).
--   • „active" îl setează DOAR webhook-ul Stripe, la plată reală.
--   • Acces în aplicație = admin SAU free_access SAU status='active'
--     SAU trial valid (azi < trial_ends_at).
-- ============================================================

-- ── 1) Default-ul corect pentru conturile NOI ──────────────
alter table public.profiles
  alter column subscription_status set default null;

-- subscription_plan rămâne 'trial' (etichetă informativă în Admin
-- pentru conturile aflate în perioada gratuită; planul plătit real
-- e setat de webhook = 'pro').

-- ── 2) Backfill conturi existente puse pe „active" din greșeală ──
-- Resetează la null DOAR conturile care nu au plătit niciodată
-- (fără stripe_customer_id). Conturile cu plată reală (customer
-- Stripe) și adminii nu sunt atinși de logica de gating oricum.
-- NB: dacă vrei să-ți păstrezi conturile de test pe „active",
-- comentează acest UPDATE înainte de a rula.
update public.profiles
set subscription_status = null
where subscription_status = 'active'
  and stripe_customer_id is null;
