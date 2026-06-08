-- ============================================================
-- RESET COMPLET — date de test
-- Șterge TOT: clienți, oferte, follow-up, produse, alți useri.
-- PĂSTREAZĂ doar contul tău (auth.users + profile), dar golit.
--
-- Config-ul aplicației rămâne intact: companies, exchange_rates.
-- (followup_templates GLOBALE — user_id IS NULL — rămân; vezi nota de jos.)
--
-- ⚠️ DISTRUCTIV. Rulează în Supabase → SQL Editor.
--    Înlocuiește emailul dacă contul tău e altul.
-- ============================================================

do $$
declare
  me_email text := 'arabuucj@gmail.com';
  me uuid;
begin
  select id into me from auth.users where email = me_email;
  if me is null then
    raise exception 'Contul % nu există în auth.users — verifică emailul.', me_email;
  end if;

  -- ── 1) Date tranzacționale (ale tuturor) ──────────────────
  -- Ștergeri defensive: doar dacă tabelul există în DB.
  if to_regclass('public.webhook_log')          is not null then delete from public.webhook_log;          end if;
  if to_regclass('public.followup_log')         is not null then delete from public.followup_log;         end if;
  if to_regclass('public.offers')               is not null then delete from public.offers;               end if;
  if to_regclass('public.product_import_jobs')  is not null then delete from public.product_import_jobs;  end if;
  if to_regclass('public.contacts')             is not null then delete from public.contacts;             end if;

  -- Template-uri personale (păstrăm globalele cu user_id IS NULL)
  if to_regclass('public.followup_templates') is not null then
    delete from public.followup_templates where user_id is not null;
  end if;

  -- ── 2) Catalog produse + conținut user-generated ──────────
  if to_regclass('public.products')  is not null then delete from public.products;  end if;
  if to_regclass('public.protocols') is not null then delete from public.protocols; end if;
  -- guides rămân (conținut de catalog). Pentru a le goli, decomentează:
  -- if to_regclass('public.guides') is not null then delete from public.guides; end if;

  -- ── 3) Alți useri (păstrăm doar contul tău) ───────────────
  -- Cascade pe profiles/contacts/offers/followup_log/templates.
  delete from auth.users where id <> me;

  -- ── 4) Reset profilul tău la valori de bază ───────────────
  update public.profiles
  set subscription_plan   = 'trial',
      subscription_status = 'active',
      trial_ends_at       = now() + interval '14 days',
      stripe_customer_id  = null,
      follow_up_days      = 5,
      max_followups       = 3,
      followup_enabled    = true,
      updated_at          = now()
  where id = me;
  -- NB: is_admin NU se atinge — rămâi admin.

  raise notice 'Reset complet. Cont păstrat: %', me_email;
end $$;

-- ── Verificare ───────────────────────────────────────────────
-- select 'contacts' t, count(*) from public.contacts
-- union all select 'offers', count(*) from public.offers
-- union all select 'products', count(*) from public.products
-- union all select 'users', count(*) from auth.users;
