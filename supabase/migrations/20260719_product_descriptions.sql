-- ════════════════════════════════════════════════════════════════
-- 20260719_product_descriptions.sql
-- Bibliotecă de DESCRIERI de produse (opțional inserate în oferte).
--
-- Context: liderul scrie o dată o descriere pentru fiecare produs
-- (ex. „Lavandă") și o poate include cu un click în emailul de ofertă,
-- chiar sub produsul respectiv.
--
-- Cheia e (company_id, sku), NU id-ul produsului:
--   • sku e STABIL la re-import (upsert pe company_id, country_code, sku)
--     → descrierile NU se pierd când reimporți catalogul.
--   • același produs are sku identic în toate țările (RO, GB, ...) →
--     o singură descriere se folosește pe toate cataloagele.
--
-- O singură descriere per produs (fără RO/EN deocamdată).
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- ── 1) Tabel descrieri ──────────────────────────────────────────
create table if not exists public.product_descriptions (
  id          uuid        default uuid_generate_v4() primary key,
  company_id  uuid        not null references public.companies(id) on delete cascade,
  sku         text        not null,
  description text        not null default '',
  updated_at  timestamptz not null default now(),
  unique (company_id, sku)
);

create index if not exists product_descriptions_company_idx
  on public.product_descriptions(company_id);

-- ── 2) RLS: scoped pe compania userului (la fel ca `products`) ───
alter table public.product_descriptions enable row level security;

drop policy if exists "Product descriptions by company members" on public.product_descriptions;
create policy "Product descriptions by company members"
  on public.product_descriptions for all to authenticated
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );
