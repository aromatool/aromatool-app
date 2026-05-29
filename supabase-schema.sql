-- ============================================================
-- AromaTool Database Schema v1.0
-- Rulează în Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── COMPANIES ─────────────────────────────────────────────
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  name text not null,
  active boolean default true,
  created_at timestamptz default now()
);

insert into public.companies (slug, name) values ('young-living', 'Young Living');

-- ── PRODUCTS ──────────────────────────────────────────────
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  country_code text not null default 'RO',
  name text not null,
  sku text not null,
  points numeric default 0,
  price_eur numeric not null default 0,
  price_ron numeric default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on public.products(company_id, country_code);
create index on public.products(name);

-- ── GUIDES ────────────────────────────────────────────────
create table public.guides (
  id uuid default uuid_generate_v4() primary key,
  product_sku text not null,
  company_id uuid references public.companies(id) on delete cascade,
  language_code text not null default 'ro',
  benefits text,
  usage_instructions text,
  precautions text,
  created_at timestamptz default now()
);

create index on public.guides(product_sku, company_id);

-- ── PROTOCOLS ─────────────────────────────────────────────
create table public.protocols (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  category text,
  language_code text not null default 'ro',
  products_json jsonb,
  instructions text,
  precautions text,
  status text not null default 'private'
    check (status in ('private','pending_review','approved','rejected')),
  created_by uuid references auth.users(id),
  is_anonymous boolean default false,
  rejection_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ── PROFILES ──────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  company_id uuid references public.companies(id),
  country_code text default 'RO',
  language_code text default 'ro',
  full_name text,
  phone text,
  contact_email text,
  subscription_plan text default 'trial'
    check (subscription_plan in ('trial','starter','growth','team','business')),
  subscription_status text default 'active'
    check (subscription_status in ('active','inactive','past_due','canceled')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── EXCHANGE RATES ─────────────────────────────────────────
create table public.exchange_rates (
  id uuid default uuid_generate_v4() primary key,
  from_currency text not null,
  to_currency text not null,
  rate numeric not null,
  updated_at timestamptz default now(),
  unique(from_currency, to_currency)
);

insert into public.exchange_rates (from_currency, to_currency, rate)
values ('EUR', 'RON', 5.2444);

-- ── CONTACTS ──────────────────────────────────────────────
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  status text default 'prospect'
    check (status in ('prospect','client_nou','client_fidel')),
  notes text,
  conditions_json jsonb,
  unsubscribed boolean default false,
  unsubscribed_at timestamptz,
  first_offer_at timestamptz,
  last_purchase_at timestamptz,
  purchase_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, email)
);

create index on public.contacts(user_id);
create index on public.contacts(status);

-- ── OFFERS ────────────────────────────────────────────────
create table public.offers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  products_json jsonb not null,
  transport numeric default 0,
  notes text,
  total_ron numeric,
  total_eur numeric,
  exchange_rate numeric,
  sent_via text default 'email'
    check (sent_via in ('email','whatsapp','both')),
  sent_at timestamptz default now()
);

create index on public.offers(user_id);
create index on public.offers(contact_id);

-- ── FOLLOWUP TEMPLATES ────────────────────────────────────
create table public.followup_templates (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id),
  plan_required text default 'growth',
  trigger_status text not null,
  trigger_day integer not null,
  subject text not null,
  body_html text not null,
  language_code text default 'ro',
  active boolean default true,
  created_at timestamptz default now()
);

-- ── FOLLOWUP LOG ──────────────────────────────────────────
create table public.followup_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  template_id uuid references public.followup_templates(id),
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.offers enable row level security;
alter table public.followup_log enable row level security;
alter table public.products enable row level security;
alter table public.guides enable row level security;
alter table public.protocols enable row level security;
alter table public.companies enable row level security;
alter table public.exchange_rates enable row level security;

-- Products: oricine autentificat poate citi
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
create policy "Approved protocols viewable by authenticated users"
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
create policy "Users can view own followup log"
  on public.followup_log for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────
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
