-- ════════════════════════════════════════════════════════════════
-- 20260717_retail_price.sql
-- Preț RETAIL pe lângă preț ANGRO (wholesale).
--
-- Context: feed-ul YL trimite două prețuri pe produs:
--   • wholesaleDisplayPrice  → prețul de Brand Partner (stocat în price_eur)
--   • retailDisplayPrice     → prețul de listă, mai mare
-- Adăugăm coloana `retail_price_eur` (în ACEEAȘI monedă ca `price_eur`,
-- vezi coloana `currency`). Un selector în app alege care preț se folosește
-- în ofertă; implicit rămâne angro (ca acum).
--
-- Backward-compatible: produsele fără retail (import vechi) au
-- retail_price_eur = 0 → app-ul cade înapoi pe price_eur.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- ── 1) Coloană retail pe produse ────────────────────────────────
alter table public.products
  add column if not exists retail_price_eur numeric not null default 0;

-- ── 2) RPC import: acceptă și prețul retail ─────────────────────
-- Rescriere a versiunii din 20260703 cu retail_price_eur în
-- incoming / diff / upsert. Restul logicii (NOI vs MODIFICATE,
-- dezactivare) rămâne identic.
create or replace function public.import_company_products(
  p_company  uuid,
  p_country  text  default 'RO',
  p_items    jsonb default '[]'::jsonb,
  p_currency text  default 'EUR'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total       integer := 0;
  v_new         integer := 0;
  v_updated     integer := 0;
  v_deactivated integer := 0;
  v_currency    text := coalesce(nullif(trim(p_currency), ''), 'EUR');
begin
  if p_company is null then
    raise exception 'p_company este obligatoriu';
  end if;

  -- ── 1) Numără NOI vs MODIFICATE comparând cu starea curentă ────────
  with incoming as (
    select
      nullif(trim(x.name), '')        as name,
      trim(x.sku)                     as sku,
      coalesce(x.points, 0)           as points,
      coalesce(x.price_eur, 0)        as price_eur,
      coalesce(x.retail_price_eur, 0) as retail_price_eur
    from jsonb_to_recordset(p_items)
      as x(name text, sku text, points numeric, price_eur numeric, retail_price_eur numeric)
    where x.sku is not null and trim(x.sku) <> ''
  ),
  filtered as (
    select * from incoming where name is not null
  ),
  diffed as (
    select
      (p.sku is null) as is_new,
      (p.sku is not null and (
            p.name             is distinct from f.name
         or p.points           is distinct from f.points
         or p.price_eur        is distinct from f.price_eur
         or p.retail_price_eur is distinct from f.retail_price_eur
         or p.currency         is distinct from v_currency
         or p.active           is distinct from true
      )) as is_changed
    from filtered f
    left join public.products p
      on p.company_id   = p_company
     and p.country_code = p_country
     and p.sku          = f.sku
  )
  select
    count(*),
    count(*) filter (where is_new),
    count(*) filter (where is_changed)
  into v_total, v_new, v_updated
  from diffed;

  -- ── 2) Upsert (actualizează doar ce chiar diferă) ─────────────────
  insert into public.products
    (company_id, country_code, name, sku, points, price_eur, retail_price_eur, currency, active, updated_at)
  select
    p_company, p_country,
    nullif(trim(x.name), ''), trim(x.sku),
    coalesce(x.points, 0), coalesce(x.price_eur, 0), coalesce(x.retail_price_eur, 0),
    v_currency, true, now()
  from jsonb_to_recordset(p_items)
    as x(name text, sku text, points numeric, price_eur numeric, retail_price_eur numeric)
  where x.sku is not null and trim(x.sku) <> ''
    and nullif(trim(x.name), '') is not null
  on conflict (company_id, country_code, sku)
  do update set
    name             = excluded.name,
    points           = excluded.points,
    price_eur        = excluded.price_eur,
    retail_price_eur = excluded.retail_price_eur,
    currency         = excluded.currency,
    active            = true,
    updated_at = now()
  where products.name             is distinct from excluded.name
     or products.points           is distinct from excluded.points
     or products.price_eur        is distinct from excluded.price_eur
     or products.retail_price_eur is distinct from excluded.retail_price_eur
     or products.currency         is distinct from excluded.currency
     or products.active           is distinct from true;

  -- ── 3) Dezactivează produsele care nu mai apar în feed ────────────
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

  return jsonb_build_object(
    'imported',    v_total,
    'new',         v_new,
    'updated',     v_updated,
    'deactivated', v_deactivated
  );
end;
$$;

revoke all on function public.import_company_products(uuid, text, jsonb, text) from public;
revoke all on function public.import_company_products(uuid, text, jsonb, text) from anon;
revoke all on function public.import_company_products(uuid, text, jsonb, text) from authenticated;
grant execute on function public.import_company_products(uuid, text, jsonb, text) to service_role;
