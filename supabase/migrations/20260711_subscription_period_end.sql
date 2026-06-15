-- ============================================================
-- Data reînnoirii abonamentului în profil
-- ------------------------------------------------------------
-- Ca să afișăm în Setări „Se reînnoiește pe …" (sau „Activ până pe …"
-- dacă abonamentul e setat să se anuleze la finalul perioadei),
-- stocăm din Stripe:
--   - current_period_end  → subscription_current_period_end
--   - cancel_at_period_end → subscription_cancel_at_period_end
-- Populate de stripe-webhook la customer.subscription.updated.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;
