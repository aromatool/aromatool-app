-- ============================================================
-- Fundație multi-companie
-- • companies.config (jsonb) — feature flags / câmpuri / sursă import per companie
-- • products.meta   (jsonb) — câmpuri specifice unei companii
-- • catalog scoped pe (company_id, country_code, sku)
-- • RPC import_company_products(p_company, p_country, p_items)
-- • RLS: userii văd doar produsele companiei lor
-- ============================================================

-- ── 1) Config per companie ──────────────────────────────────────────────
alter table public.companies
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Config implicit pentru Young Living
update public.companies
set config = jsonb_build_object(
  'features',        jsonb_build_object('protocols', true, 'points', true, 'enroll_link', true),
  'terminology',     jsonb_build_object('points', 'PV'),
  'product_fields',  jsonb_build_array('points', 'price_eur'),
  'default_country', 'RO',
  'import_source',   jsonb_build_object(
                       'type', 'api',
                       'url',  'https://www.youngliving.com/api/shopping/product-catalog/ro-RO/RO/2'
                     ),
  'branding',        jsonb_build_object('primary', '#5C7A5C')
)
where slug = 'young-living';

-- ── 2) Câmpuri specifice per produs ─────────────────────────────────────
alter table public.products
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- ── 3) Catalog scoped pe companie ───────────────────────────────────────
-- Sub modelul nou, produsele de catalog au ÎNTOTDEAUNA company_id.
-- Curăță orfanii globali (company_id IS NULL) rămași din modelul vechi.
delete from public.products where company_id is null;

-- Dedupe pe (company_id, country_code, sku) înainte de indexul unic.
delete from public.products a
using public.products b
where a.company_id = b.company_id
  and a.country_code = b.country_code
  and a.sku = b.sku
  and a.ctid < b.ctid;

-- Înlocuiește indexul parțial vechi (global) cu unul complet pe companie.
drop index if exists public.products_global_country_sku_uniq;
create unique index if not exists products_company_country_sku_uniq
  on public.products (company_id, country_code, sku);

-- ── 4) RPC import per companie ──────────────────────────────────────────
-- Înlocuiește vechiul import_yl_products (era hardcodat pe company_id NULL).
drop function if exists public.import_yl_products(jsonb, text);

create or replace function public.import_company_products(
  p_company uuid,
  p_country text  default 'RO',
  p_items   jsonb default '[]'::jsonb
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
  if p_company is null then
    raise exception 'p_company este obligatoriu';
  end if;

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
    select p_company, p_country, name, sku, points, price_eur, true, now()
    from incoming
    where name is not null
    on conflict (company_id, country_code, sku)
    do update set
      name      = excluded.name,
      points    = excluded.points,
      price_eur = excluded.price_eur,
      active    = true,
      updated_at = now()
    returning 1
  )
  select count(*) into v_imported from upserted;

  -- Dezactivează produsele companiei care nu mai apar în feed
  update public.products p
  set active = false, updated_at = now()
  where p.company_id = p_company
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

revoke all on function public.import_company_products(uuid, text, jsonb) from public;
revoke all on function public.import_company_products(uuid, text, jsonb) from anon;
revoke all on function public.import_company_products(uuid, text, jsonb) from authenticated;
grant execute on function public.import_company_products(uuid, text, jsonb) to service_role;

-- ── 5) RLS: produse scoped pe compania userului ─────────────────────────
drop policy if exists "Products viewable by authenticated users" on public.products;
drop policy if exists "Products viewable by company members"      on public.products;
create policy "Products viewable by company members"
  on public.products for select to authenticated
  using (
    active = true
    and company_id = (select company_id from public.profiles where id = auth.uid())
  );
