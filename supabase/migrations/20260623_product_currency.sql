-- ════════════════════════════════════════════════════════════════
-- 20260623_product_currency.sql
-- Suport cataloage non-EUR (ex: UK = GBP).
--
-- Context: până acum TOATE prețurile erau ancorate în EUR (coloana
-- `price_eur`), iar zona suportată la lansare era doar EUR. UK însă
-- returnează prețuri în GBP (£). Ca să nu mislabel-uim GBP drept EUR,
-- adăugăm o coloană `currency` care spune în ce monedă e stocat
-- `price_eur` (numele coloanei rămâne, dar valoarea e moneda NATIVĂ a
-- catalogului — EUR pentru zona euro, GBP pentru UK, etc.).
--
-- `import_company_products` primește acum `p_currency text default 'EUR'`
-- și o setează pe rândurile inserate/actualizate. Backward-compatible:
-- apelurile vechi (fără p_currency) rămân EUR.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- ── 1) Coloană currency pe produse ──────────────────────────────
alter table public.products
  add column if not exists currency text not null default 'EUR';

-- ── 1b) Moneda de bază a ofertei (pentru re-randarea ofertelor salvate) ──
-- `total_eur` / `price_eur` din ofertă sunt exprimate în ACEASTĂ monedă;
-- `exchange_rate` devine factor bază → afișare. Default EUR → ofertele vechi
-- (toate în EUR) rămân corecte fără migrare de date.
alter table public.offers
  add column if not exists base_currency text not null default 'EUR';

-- ── 2) RPC import: acceptă moneda catalogului ───────────────────
-- Recreăm funcția cu parametrul nou (default EUR → compat înapoi).
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
  v_imported    integer := 0;
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
  upserted as (
    insert into public.products
      (company_id, country_code, name, sku, points, price_eur, currency, active, updated_at)
    select p_company, p_country, name, sku, points, price_eur, v_currency, true, now()
    from incoming
    where name is not null
    on conflict (company_id, country_code, sku)
    do update set
      name      = excluded.name,
      points    = excluded.points,
      price_eur = excluded.price_eur,
      currency  = excluded.currency,
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

-- Vechea semnătură (uuid, text, jsonb) rămâne în DB ca overload separat;
-- o eliminăm explicit ca să nu existe ambiguitate de rezoluție.
drop function if exists public.import_company_products(uuid, text, jsonb);

revoke all on function public.import_company_products(uuid, text, jsonb, text) from public;
revoke all on function public.import_company_products(uuid, text, jsonb, text) from anon;
revoke all on function public.import_company_products(uuid, text, jsonb, text) from authenticated;
grant execute on function public.import_company_products(uuid, text, jsonb, text) to service_role;
