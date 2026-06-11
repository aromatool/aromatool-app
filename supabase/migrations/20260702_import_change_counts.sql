-- ─────────────────────────────────────────────────────────────────────
-- Import catalog: numără produsele NOI / MODIFICATE / SCOASE, nu doar totalul
-- ─────────────────────────────────────────────────────────────────────
-- Până acum `import_company_products` făcea UPSERT pe TOATE produsele
-- vandabile la fiecare rulare (rescria toate ~587, indiferent dacă s-a
-- schimbat ceva) și raporta doar `imported` (= total). Nu se vedea câte
-- produse chiar s-au modificat.
--
-- Acum:
--   • UPDATE-ul se aplică DOAR dacă nume/puncte/preț/monedă/active diferă
--     (WHERE ... is distinct from ...), deci nu mai rescrie degeaba.
--   • Separăm INSERT (nou) de UPDATE (modificat) prin trucul system column
--     xmax = 0 (rând proaspăt inserat) vs xmax <> 0 (rând actualizat).
--   • Returnăm { imported, new, updated, deactivated }.
--   • Stocăm noile numere în product_import_jobs (coloane noi).
-- ─────────────────────────────────────────────────────────────────────

-- ── 1) Coloane noi pe joburile de import ─────────────────────────────
alter table public.product_import_jobs
  add column if not exists records_new         integer,
  add column if not exists records_updated     integer,
  add column if not exists records_deactivated integer;

-- ── 2) Rescriere funcție import (aceeași semnătură 4-arg) ────────────
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
  filtered as (
    select * from incoming where name is not null
  ),
  upserted as (
    insert into public.products
      (company_id, country_code, name, sku, points, price_eur, currency, active, updated_at)
    select p_company, p_country, name, sku, points, price_eur, v_currency, true, now()
    from filtered
    on conflict (company_id, country_code, sku)
    do update set
      name       = excluded.name,
      points     = excluded.points,
      price_eur  = excluded.price_eur,
      currency   = excluded.currency,
      active     = true,
      updated_at = now()
    -- Doar dacă s-a schimbat ceva (sau produsul era dezactivat și revine).
    where products.name      is distinct from excluded.name
       or products.points    is distinct from excluded.points
       or products.price_eur is distinct from excluded.price_eur
       or products.currency  is distinct from excluded.currency
       or products.active    is distinct from true
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted),
    count(*) filter (where not inserted)
  into v_new, v_updated
  from upserted;

  -- Total produse vandabile procesate (cu nume valid).
  select count(*) into v_total from filtered;

  -- Dezactivează produsele companiei care nu mai apar în feed.
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
