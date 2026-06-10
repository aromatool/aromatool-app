-- Migration: import / sincronizare produse din catalogul Young Living
-- Adaugă: index unic pentru upsert, funcția de import în masă, index pe joburi.

-- ── 1) Dedupe produse globale duplicate pe (country_code, sku) ──────────
-- Necesar înainte de a crea indexul unic. Păstrează un singur rând/cheie.
delete from public.products a
using public.products b
where a.company_id is null
  and b.company_id is null
  and a.country_code = b.country_code
  and a.sku = b.sku
  and a.ctid < b.ctid;

-- ── 2) Index unic parțial pentru catalogul global (company_id IS NULL) ──
-- Permite upsert ON CONFLICT (country_code, sku) pentru produsele YL.
create unique index if not exists products_global_country_sku_uniq
  on public.products (country_code, sku)
  where company_id is null;

-- ── 2.5) Tabel joburi de import (dacă nu există încă) ───────────────────
-- (Definit în supabase-schema.sql, dar e posibil să nu fi fost aplicat în DB.)
create table if not exists public.product_import_jobs (
  id               uuid        default gen_random_uuid() primary key,
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

alter table public.product_import_jobs enable row level security;

-- Userii văd doar joburile declanșate de ei (Edge Function folosește service_role).
drop policy if exists "Users can manage own import jobs" on public.product_import_jobs;
create policy "Users can manage own import jobs"
  on public.product_import_jobs for all to authenticated
  using (triggered_by = auth.uid())
  with check (triggered_by = auth.uid());

-- ── 3) Index pe joburi (pentru a lua rapid ultimul import) ──────────────
create index if not exists product_import_jobs_created_idx
  on public.product_import_jobs (created_at desc);

-- ── 4) Funcție de import în masă + dezactivare produse dispărute ────────
-- Primește un array JSON de { name, sku, points, price_eur } și:
--   • upsert (insert/update) produsele primite, marcându-le active=true
--   • dezactivează (active=false) produsele globale care nu mai sunt în feed
-- Rulează ca SECURITY DEFINER; acces doar pentru service_role (Edge Function).
create or replace function public.import_yl_products(
  p_items   jsonb,
  p_country text default 'RO'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imported    integer := 0;
  v_deactivated integer := 0;
begin
  -- Upsert produse din feed
  with incoming as (
    select
      nullif(trim(x.name), '') as name,
      trim(x.sku)              as sku,
      coalesce(x.points, 0)    as points,
      coalesce(x.price_eur, 0) as price_eur
    from jsonb_to_recordset(p_items)
      as x(name text, sku text, points numeric, price_eur numeric)
    where x.sku is not null and trim(x.sku) <> ''
  ),
  upserted as (
    insert into public.products
      (company_id, country_code, name, sku, points, price_eur, active, updated_at)
    select null, p_country, name, sku, points, price_eur, true, now()
    from incoming
    where name is not null
    on conflict (country_code, sku) where company_id is null
    do update set
      name      = excluded.name,
      points    = excluded.points,
      price_eur = excluded.price_eur,
      active    = true,
      updated_at = now()
    returning 1
  )
  select count(*) into v_imported from upserted;

  -- Dezactivează produsele globale care nu mai apar în feed
  update public.products p
  set active = false, updated_at = now()
  where p.company_id is null
    and p.country_code = p_country
    and p.active = true
    and not exists (
      select 1
      from jsonb_to_recordset(p_items) as x(sku text)
      where trim(x.sku) = p.sku
    );
  get diagnostics v_deactivated = row_count;

  return jsonb_build_object('imported', v_imported, 'deactivated', v_deactivated);
end;
$$;

-- Acces strict: doar service_role poate executa (apelată din Edge Function)
revoke all on function public.import_yl_products(jsonb, text) from public;
revoke all on function public.import_yl_products(jsonb, text) from anon;
revoke all on function public.import_yl_products(jsonb, text) from authenticated;
grant execute on function public.import_yl_products(jsonb, text) to service_role;
