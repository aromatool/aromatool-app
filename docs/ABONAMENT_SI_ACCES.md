# Abonament, Trial & Acces — context tehnic (handoff)

> Document de continuitate. Scopul: orice dezvoltator sau asistent AI să poată
> prelua sistemul de plăți/acces de la zero, fără contextul conversației în care
> a fost construit. Limbaj: RO (ca restul produsului).

## 0. Despre produs (pe scurt)

AromaTool = CRM simplu, orientat pe acțiune, pentru lideri Young Living / doTERRA
și alte comunități de wellness. Funcții: Contacte/CRM, Calculator + Oferte,
Follow-up, Resurse (PDF), Dashboard „Focus Today", Daily Focus Email, Email
tracking. Stack: React 19 + TypeScript + Vite + Supabase (Postgres + Auth + Edge
Functions) + Tailwind + Zustand + React Query + Resend (email) + Stripe (plăți).

**Filozofie (de respectat):** operațional, nu enterprise. O singură sursă de
adevăr, fără logică duplicată. Costuri mici. Soluții practice de early-stage.

## 1. Modelul de acces (REGULA CENTRALĂ)

```
hasAccess = isAdmin  OR  freeAccess  OR  subscription activ  OR  trial valid
```

- **isAdmin** — `profiles.is_admin = true`. Acces total, fără gating, fără bannere.
- **freeAccess** — `profiles.free_access = true`. Cont fără plată, acordat de admin;
  acces complet, dar NU e admin (mai puține drepturi).
- **subscription activ** — `profiles.subscription_status = 'active'` (setat DOAR de
  webhook-ul Stripe la plată reală).
- **trial valid** — `now() < profiles.trial_ends_at` (și nu e activ).

„Poartă blândă" (soft gate): **citirile și exportul merg mereu**. Doar **acțiunile
de scriere** (adăugare contact, trimitere mesaj/ofertă, încărcare resurse) trec prin
`requireAccess()`, care deschide paywall-ul dacă nu există acces.

## 2. Frontend — fișiere cheie

| Fișier | Rol |
|---|---|
| `src/lib/subscription.tsx` | **Sursa unică de adevăr.** `SubscriptionProvider` + `useSubscription()` + `Paywall` + constanta `PLAN`. Citește din `profiles`: `subscription_plan, subscription_status, trial_ends_at, is_admin, free_access`. Expune: `isActive, isTrialing, isPastDue, isAdmin, freeAccess, hasAccess, daysLeft, requireAccess(), openPaywall(), refresh()`. |
| `src/App.tsx` | Înfășoară rutele: `<AuthProvider><SubscriptionProvider>…`. |
| `src/components/AppLayout.tsx` | Bannerul de abonament (`SubscriptionBanner`). Ascuns pentru admin / free / activ. Arată: past_due (roșu), trial (cu urgență ≤3 zile), acces blocat. |
| `src/pages/SettingsPage.tsx` | Cardul „💳 Abonament": status + butoane „Abonează-te" / „Gestionează abonamentul". Cardul „Cont" arată DOAR identitate (email + dată creare) — statusul abonamentului e DOAR în cardul Abonament (sursă unică). |
| `src/pages/AdminPage.tsx` | Listă useri din RPC `admin_users()`. Butoane: setare trial per-user, **acces gratuit** (`admin_set_user_free_access`), fă/retrage admin. Card global pentru durata trialului. |
| `src/hooks/useUpgrade.ts` | Invocă `create-checkout`, redirect la Stripe. |
| Gate-uri `requireAccess()` | `ContactsPage.addContact`, `FollowupModal.send`, `useSendEmail.sendOffer`, `CalculatorPage.sendOfferWhatsApp`, `ResourcesPage.handleFiles`. |

## 3. Bază de date

### Coloane relevante în `public.profiles`
- `subscription_plan text` — default `'trial'` (etichetă; planul plătit real = `'pro'`).
- `subscription_status text` — **default `null`** (vezi migrația de fix de mai jos).
  `'active'` = abonat; `'past_due'`, `'canceled'`, `'inactive'` = stări Stripe.
- `trial_ends_at timestamptz` — default `now() + make_interval(days => trial_days())`.
- `free_access boolean` — default `false`.
- `is_admin boolean` — default `false`.
- `stripe_customer_id text` — setat de `create-checkout`.

### `handle_new_user()` (trigger pe `auth.users`, NU e versionat în repo)
Inserează DOAR `id, full_name, contact_email, company_id` (company = `young-living`).
Restul coloanelor iau **default-ul coloanei**. ⚠️ De aceea default-urile de mai sus
sunt critice: dacă `subscription_status` ar fi `'active'`, fiecare cont nou ar fi
tratat ca abonat → paywall-ul nu s-ar declanșa niciodată. (Bug reparat — vezi 20260620.)

### `app_config` + `trial_days()` (durată trial configurabilă)
Tabel cheie/valoare; `trial_days()` (SECURITY DEFINER) citește `trial_days` (fallback 14).
Default-ul coloanei `trial_ends_at` apelează funcția → schimbarea duratei = un UPDATE,
fără migrație. Admin RPC: `admin_get_trial_days()`, `admin_set_trial_days(int)`,
`admin_set_user_trial(uuid, int)`.

### Migrații (se aplică MANUAL în Supabase SQL Editor — NU `supabase db push`)
- `20260617_trial_subscription.sql` — adaugă `trial_ends_at`, default 14 zile, backfill.
- `20260618_trial_config.sql` — `app_config`, `trial_days()`, RPC-uri trial, recreează `admin_users()`.
- `20260619_access_overrides.sql` — `free_access`, RPC `admin_set_user_free_access`, recreează `admin_users()` cu `free_access`.
- `20260620_fix_signup_status.sql` — **FIX**: `subscription_status` default `'active' → null` + backfill conturi netaxate.

Pattern RPC admin: `SECURITY DEFINER` + `set search_path = public` +
`if not public.is_admin() then raise exception 'Not authorized'; end if;`.
`is_admin()` citește `profiles.is_admin` pentru `auth.uid()`.

## 4. Edge Functions (Deno — NU intră în build-ul de Vite)

| Funcție | Rol | Secrete necesare |
|---|---|---|
| `create-checkout` | Creează Stripe Checkout Session (mode subscription). Multi-currency + Stripe Tax + promo codes. Creează/refolosește customer. | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `APP_URL` |
| `customer-portal` | Stripe Billing Portal (gestionare abonament/factură/anulare). Verifică JWT manual. | `STRIPE_SECRET_KEY`, `APP_URL` |
| `stripe-webhook` | Sincronizează `subscription_status`/`subscription_plan` din evenimente Stripe (`checkout.session.completed` → `active`; `subscription.updated`; `subscription.deleted` → `canceled`). | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

`create-checkout` folosește: `allow_promotion_codes`, `automatic_tax`,
`billing_address_collection:'auto'`, `customer_update:{address,name}`,
`tax_id_collection`. Valuta clientului = automată DACĂ Price-ul are `currency_options`
setate în Dashboard. success/cancel → `${APP_URL}/app/settings?upgrade=success|cancel`.

## 5. Email (signup + tranzacțional)

- Signup: `src/lib/auth.tsx → signUp()` cu `emailRedirectTo: ${origin}/auth`.
- Șabloane RO brandate: `supabase/templates/{confirmation,recovery,email_change}.html`,
  conectate în `config.toml` (`[auth.email.template.*]`) pentru dev local.
- ⚠️ **Pe hosted, șabloanele se copiază MANUAL** în Dashboard → Authentication → Emails.
- ⚠️ Emailul de confirmare **NU pleacă** cu serviciul built-in Supabase (rate-limit
  agresiv, doar către adrese autorizate). Soluție: SMTP custom (Resend) sau, pentru
  test, dezactivează temporar „Confirm email".

## 6. Operațiuni MANUALE (le face omul — AI-ul nu are acces la DB/Stripe/Dashboard)

1. Rulează migrațiile în SQL Editor (în ordine).
2. **Stripe**: creează Product „AromaTool Pro" + Price (lunar, cu `currency_options`),
   setează `STRIPE_PRICE_PRO`; creează Coupon → Promotion Code de lansare; activează
   Stripe Tax; activează Customer Portal; configurează Webhook (`STRIPE_WEBHOOK_SECRET`).
3. **Secrete Edge Functions**: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`,
   `STRIPE_WEBHOOK_SECRET`, `APP_URL`, plus cele de email (`RESEND_API_KEY` etc.).
4. **Deploy** funcțiile: `create-checkout`, `customer-portal`, `stripe-webhook`.
5. **Email**: SMTP Resend în Auth + copiat șabloanele + Site URL / Redirect URLs.

Constante: `SUPABASE_URL = https://kbtstoqrukxwnhpuvglv.supabase.co`. Service role key
DOAR în env, niciodată commis. `.env.local` e gitignored. CLI legat la proiect.

## 7. Stare curentă & ce a mai rămas

**Gata în cod:** trial + soft gate + plan unic + paywall + pagina Abonament +
customer portal + multi-currency/TVA + trial configurabil + admin bypass + free
access + fix signup status + șabloane email RO + categorie Help „Abonament".
Build (`npm run build`) trece.

**Rămas (operațiuni la om):** setup complet Stripe (produs/preț/coduri/webhook/portal),
deploy funcții, SMTP Resend + copiat șabloane în Dashboard. Vezi secțiunea 6.

**De știut:** verificarea fluxului = signup → cont în trial (`status null`,
`trial_ends_at` viitor) → după expirare paywall → plată (webhook) → `status active`.
