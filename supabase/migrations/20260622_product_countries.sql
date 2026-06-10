-- ════════════════════════════════════════════════════════════════
-- 20260622_product_countries.sql
-- Lista distinctă de țări cu produse importate (pentru selectorul de catalog).
--
-- Problemă: frontend-ul lua country_code din `products` și deduplica pe client,
-- dar query-ul PostgREST întoarce MAX 1000 rânduri implicit. Cu mai multe
-- cataloage (~600 produse/țară), țările importate ultimele nu mai încăpeau în
-- primele 1000 de rânduri → nu apăreau în selector.
--
-- Soluție: DISTINCT direct în DB. Scoped pe compania userului (ca restul RPC-urilor).
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

create or replace function public.list_product_countries()
returns table (country_code text)
language sql
security definer
set search_path = public
as $$
  select distinct p.country_code
  from public.products p
  where p.active = true
    and p.company_id = (
      select company_id from public.profiles where id = auth.uid()
    )
  order by p.country_code;
$$;

revoke all on function public.list_product_countries() from public;
revoke all on function public.list_product_countries() from anon;
grant execute on function public.list_product_countries() to authenticated;
