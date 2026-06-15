-- ============================================================
-- FIX abonament Stripe: planul „pro" lipsea din CHECK constraint
-- ------------------------------------------------------------
-- Aplicația folosește un singur plan la lansare: „pro" (PLAN.id),
-- iar create-checkout trimite metadata { plan: 'pro' }. Webhook-ul
-- încerca UPDATE profiles SET subscription_plan='pro', dar vechiul
-- constraint permitea doar trial/starter/growth/team/business → update
-- respins de Postgres (webhook returna totuși 200, eroare ignorată).
-- Rezultat: plata reușea, dar abonamentul nu se activa în aplicație.
--
-- Adăugăm 'pro' la valorile permise (păstrăm și restul pt. compat).
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (
    subscription_plan = ANY (
      ARRAY['trial'::text, 'starter'::text, 'growth'::text,
            'team'::text, 'business'::text, 'pro'::text]
    )
  );
