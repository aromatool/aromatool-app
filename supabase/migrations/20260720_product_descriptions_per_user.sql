-- ════════════════════════════════════════════════════════════════
-- 20260720_product_descriptions_per_user.sql
-- FIX confidențialitate: descrierile de produs erau scoped pe `company_id`,
-- iar toți utilizatorii aplicației sunt în aceeași companie → fiecare vedea
-- (și putea edita) descrierile scrise de oricine altcineva.
--
-- Trecem tabelul pe scope PER UTILIZATOR (`user_id`): fiecare cont are
-- propriile descrieri, complet private.
--
-- Date existente: nu avem autorul (s-a salvat doar company_id). Conform
-- deciziei, TOATE rândurile existente se atribuie contului
-- playhappycafe@gmail.com (le-a scris ea); restul utilizatorilor pornesc gol.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ⚠️ ORDINE: aplică ÎNTÂI această migrație, abia apoi se deployează codul nou
--    (codul nou citește/scrie pe `user_id`; fără coloană ar da eroare).
-- ════════════════════════════════════════════════════════════════

-- ── 1) Coloana user_id (nullable la început, ca să putem popula) ─
alter table public.product_descriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ── 2) Atribuie TOATE rândurile existente contului indicat ──────
--    Eșuează zgomotos dacă acel cont nu există (nu vrem să golim tabelul
--    în tăcere dintr-un email greșit).
do $$
declare
  v_uid uuid;
begin
  select id into v_uid
  from auth.users
  where lower(email) = lower('playhappycafe@gmail.com')
  limit 1;

  if v_uid is null then
    raise exception 'Contul playhappycafe@gmail.com nu a fost găsit în auth.users — migrația se oprește.';
  end if;

  update public.product_descriptions
  set user_id = v_uid
  where user_id is null;
end $$;

-- ── 3) Dedupe înainte de cheia unică (user_id, sku) ─────────────
--    Dacă același sku apărea pe mai multe company_id-uri, după atribuire
--    s-ar dubla pe (user_id, sku). Păstrăm rândul cel mai recent.
delete from public.product_descriptions a
using public.product_descriptions b
where a.user_id = b.user_id
  and a.sku = b.sku
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.ctid < b.ctid)
  );

-- ── 4) Curățenie: orice rând rămas fără user_id (siguranță) ─────
delete from public.product_descriptions where user_id is null;

-- ── 5) user_id devine obligatoriu ───────────────────────────────
alter table public.product_descriptions
  alter column user_id set not null;

-- ── 6) Scoatem vechea schemă scoped pe companie ─────────────────
--    ⚠️ Politica veche depinde de coloana company_id → o ștergem ÎNTÂI,
--    altfel `drop column company_id` eșuează (dependență).
drop policy if exists "Product descriptions by company members" on public.product_descriptions;
alter table public.product_descriptions
  drop constraint if exists product_descriptions_company_id_sku_key;
drop index if exists public.product_descriptions_company_idx;
alter table public.product_descriptions
  drop column if exists company_id;

-- ── 7) Cheie unică + index per utilizator ───────────────────────
alter table public.product_descriptions
  drop constraint if exists product_descriptions_user_id_sku_key;
alter table public.product_descriptions
  add constraint product_descriptions_user_id_sku_key unique (user_id, sku);
create index if not exists product_descriptions_user_idx
  on public.product_descriptions(user_id);

-- ── 8) RLS: fiecare vede/scrie DOAR propriile rânduri ───────────
alter table public.product_descriptions enable row level security;

drop policy if exists "Product descriptions by owner" on public.product_descriptions;
create policy "Product descriptions by owner"
  on public.product_descriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
