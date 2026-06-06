-- ============================================================
-- AromaTool Database Schema — starea reală (v2, sincronizat)
-- Ultima actualizare: 2026-06-06
--
-- NOTĂ: Acest fișier reflectă DB-ul live după toate migrările aplicate.
-- NU rula dacă DB-ul există deja — folosește migration files separate.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── COMPANIES ─────────────────────────────────────────────────
create table public.companies (
  id         uuid        default uuid_generate_v4() primary key,
  slug       text        unique not null,
  name       text        not null,
  active     boolean     default true,
  created_at timestamptz default now()
);

insert into public.companies (slug, name) values ('young-living', 'Young Living');

-- ── PRODUCTS ──────────────────────────────────────────────────
create table public.products (
  id           uuid        default uuid_generate_v4() primary key,
  company_id   uuid        references public.companies(id) on delete cascade,
  country_code text        not null default 'RO',
  name         text        not null,
  sku          text        not null,
  points       numeric     default 0,
  price_eur    numeric     not null default 0,
  price_ron    numeric     default 0,   -- deprecat, ignorat în cod
  active       boolean     default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index on public.products(company_id, country_code);
create index on public.products(name);

-- ── GUIDES ────────────────────────────────────────────────────
create table public.guides (
  id                 uuid        default uuid_generate_v4() primary key,
  product_sku        text        not null,
  company_id         uuid        references public.companies(id) on delete cascade,
  language_code      text        not null default 'ro',
  benefits           text,
  usage_instructions text,
  precautions        text,
  created_at         timestamptz default now()
);

create index on public.guides(product_sku, company_id);

-- ── PROTOCOLS ─────────────────────────────────────────────────
create table public.protocols (
  id             uuid        default uuid_generate_v4() primary key,
  company_id     uuid        references public.companies(id) on delete cascade,
  title          text        not null,
  category       text,
  language_code  text        not null default 'ro',
  products_json  jsonb,
  instructions   text,
  precautions    text,
  status         text        not null default 'private'
    check (status in ('private','pending_review','approved','rejected')),
  created_by     uuid        references auth.users(id),
  is_anonymous   boolean     default false,
  rejection_note text,
  reviewed_by    uuid        references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz default now()
);

-- ── PROFILES ──────────────────────────────────────────────────
create table public.profiles (
  id                  uuid        references auth.users(id) on delete cascade primary key,
  company_id          uuid        references public.companies(id),
  country_code        text        default 'RO',
  language_code       text        default 'ro',
  full_name           text,
  phone               text,
  contact_email       text,
  subscription_plan   text        default 'trial'
    check (subscription_plan in ('trial','starter','growth','team','business')),
  subscription_status text        default 'active'
    check (subscription_status in ('active','inactive','past_due','canceled')),
  trial_ends_at       timestamptz default (now() + interval '14 days'),
  stripe_customer_id  text,
  -- Follow-up config
  follow_up_days      integer     default 5,
  max_followups       integer     default 3,
  followup_enabled    boolean     default true,
  -- Admin
  is_admin            boolean     default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── EXCHANGE RATES ────────────────────────────────────────────
create table public.exchange_rates (
  id            uuid        default uuid_generate_v4() primary key,
  from_currency text        not null,
  to_currency   text        not null,
  rate          numeric     not null,
  updated_at    timestamptz default now(),
  unique(from_currency, to_currency)
);

insert into public.exchange_rates (from_currency, to_currency, rate)
values
  ('EUR', 'RON', 5.2523),
  ('EUR', 'USD', 1.1644),
  ('EUR', 'GBP', 0.86723),
  ('EUR', 'CHF', 0.9111),
  ('EUR', 'HUF', 353.69),
  ('EUR', 'PLN', 4.2275),
  ('EUR', 'CZK', 24.282);

-- ── CONTACTS ──────────────────────────────────────────────────
-- NOTĂ: offers_count, total_eur, last_activity_at, last_followup_at
-- NU sunt stocate — se agregă live din offers + followup_log în frontend.
create table public.contacts (
  id                      uuid        default uuid_generate_v4() primary key,
  user_id                 uuid        references auth.users(id) on delete cascade,
  email                   text        not null,  -- placeholder: {timestamp}@noemail.local dacă lipsește
  name                    text,
  phone                   text,
  source                  text,                  -- ex: Instagram, Facebook, recomandare
  status                  text        default 'prospect'
    check (status in ('prospect','in_followup','client_nou','client_fidel','team_member','inactiv')),
  notes                   text,
  conditions_json         jsonb,
  unsubscribed            boolean     default false,
  unsubscribed_at         timestamptz,
  first_offer_at          timestamptz,
  last_purchase_at        timestamptz,
  purchase_count          integer     default 0,
  followup_count          integer     default 0,
  followup_opted_out      boolean     default false,
  manual_high_interest    boolean     default false,
  manual_business_interest boolean    default false,
  -- Communication controls
  email_opt_out            boolean     default false,
  email_opt_out_at         timestamptz,
  communication_blocked    boolean     default false,
  communication_blocked_at timestamptz,
  communication_blocked_reason text,
  -- Email tracking (incrementat de webhook-ul Resend)
  email_opens              integer     default 0,
  email_clicks             integer     default 0,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique(user_id, email)
);

create index on public.contacts(user_id);
create index on public.contacts(user_id, status);        -- filtru CRM + Dashboard
create index on public.contacts(user_id, created_at desc);

-- ── OFFERS ────────────────────────────────────────────────────
create table public.offers (
  id            uuid        default uuid_generate_v4() primary key,
  user_id       uuid        references auth.users(id) on delete cascade,
  contact_id    uuid        references public.contacts(id) on delete set null,
  products_json jsonb       not null,
  transport     numeric     default 0,     -- stocat în EUR
  notes         text,
  total_display numeric,    -- total în moneda selectată (înlocuiește total_ron)
  total_eur     numeric,    -- total în EUR, sursa de adevăr
  exchange_rate numeric,    -- cursul EUR → moneda selectată la momentul trimiterii
  currency      text        default 'RON', -- moneda selectată
  sent_via      text        default 'email'
    check (sent_via in ('email','whatsapp','both')),
  sent_at       timestamptz default now()
);

create index on public.offers(user_id);
create index on public.offers(contact_id);
create index on public.offers(user_id, contact_id, sent_at desc);  -- ContactModal timeline

-- ── FOLLOWUP TEMPLATES ────────────────────────────────────────
-- user_id NULL = template global (pentru toți userii)
-- user_id setat = template personal al userului
create table public.followup_templates (
  id             uuid        default uuid_generate_v4() primary key,
  user_id        uuid        references auth.users(id) on delete cascade,
  company_id     uuid        references public.companies(id),
  plan_required  text        default 'growth',
  trigger_status text        not null,  -- 'prospect' | 'client_nou'
  trigger_day    integer     not null,
  subject        text        not null,
  body_html      text        not null,  -- JSON stringificat: {type, headline, intro, cta, closing}
  language_code  text        default 'ro',
  active         boolean     default true,
  created_at     timestamptz default now()
);

create index on public.followup_templates(user_id);

-- ── FOLLOWUP LOG ──────────────────────────────────────────────
create table public.followup_log (
  id          uuid        default uuid_generate_v4() primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  contact_id  uuid        references public.contacts(id) on delete cascade,
  template_id uuid        references public.followup_templates(id),
  scheduled_at timestamptz,
  sent_at     timestamptz,
  status      text        default 'pending'
    check (status in ('pending','sent','whatsapp_initiated','failed','skipped')),
  created_at  timestamptz default now()
);

create index on public.followup_log(user_id);
create index on public.followup_log(contact_id);

-- ── PRODUCT IMPORT JOBS ───────────────────────────────────────
-- Tracking pentru importuri de produse (sincronizare YL API)
create table public.product_import_jobs (
  id               uuid        default uuid_generate_v4() primary key,
  triggered_by     uuid        references auth.users(id),
  status           text        not null default 'pending'
    check (status in ('pending','running','done','failed')),
  source_url       text,
  country_code     text        not null default 'RO',
  records_total    integer,
  records_imported integer,
  records_failed   integer,
  error_log        jsonb,
  created_at       timestamptz default now(),
  completed_at     timestamptz
);

-- ── WEBHOOK LOG ───────────────────────────────────────────────
-- Tracking pentru webhookuri Resend (unsubscribe, bounce, complained)
-- Acces doar prin service_role — nicio politică RLS pentru useri normali
create table public.webhook_log (
  id           uuid        default uuid_generate_v4() primary key,
  source       text        not null,
  event_type   text        not null,
  payload      jsonb,
  processed_at timestamptz default now(),
  contact_id   uuid        references public.contacts(id) on delete set null,
  notes        text
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.contacts           enable row level security;
alter table public.offers             enable row level security;
alter table public.followup_log       enable row level security;
alter table public.followup_templates enable row level security;
alter table public.products           enable row level security;
alter table public.guides             enable row level security;
alter table public.protocols          enable row level security;
alter table public.companies          enable row level security;
alter table public.exchange_rates     enable row level security;
alter table public.product_import_jobs enable row level security;

-- Products: oricine autentificat poate citi produsele active
create policy "Products viewable by authenticated users"
  on public.products for select to authenticated
  using (active = true);

-- Guides: oricine autentificat poate citi
create policy "Guides viewable by authenticated users"
  on public.guides for select to authenticated
  using (true);

-- Companies: oricine autentificat poate citi
create policy "Companies viewable by authenticated users"
  on public.companies for select to authenticated
  using (active = true);

-- Exchange rates: oricine autentificat poate citi
create policy "Exchange rates viewable by authenticated users"
  on public.exchange_rates for select to authenticated
  using (true);

-- Protocols: approved visible to all, private only owner
create policy "Approved protocols viewable by authenticated"
  on public.protocols for select to authenticated
  using (status = 'approved' or created_by = auth.uid());

create policy "Users can create protocols"
  on public.protocols for insert to authenticated
  with check (created_by = auth.uid());

-- Profiles: users can only see/edit their own
create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- Contacts: users manage only their own
create policy "Users can manage own contacts"
  on public.contacts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Offers: users manage only their own
create policy "Users can manage own offers"
  on public.offers for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Followup log: users see only their own
create policy "Users can manage own followup log"
  on public.followup_log for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Followup templates: user vede propriile + globalele (user_id IS NULL)
create policy "Users can view own and global templates"
  on public.followup_templates for select to authenticated
  using (user_id = auth.uid() or user_id is null);

create policy "Users can manage own templates"
  on public.followup_templates for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own templates"
  on public.followup_templates for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own templates"
  on public.followup_templates for delete to authenticated
  using (user_id = auth.uid());

-- Product import jobs: user vede doar ale lui
create policy "Users can manage own import jobs"
  on public.product_import_jobs for all to authenticated
  using (triggered_by = auth.uid())
  with check (triggered_by = auth.uid());

-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, contact_email, company_id)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    (select id from public.companies where slug = 'young-living' limit 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
