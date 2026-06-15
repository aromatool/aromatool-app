-- ============================================================
-- Migration: RLS multi-tenant hardening
-- Data: 2026-06-30
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- Remediază probleme descoperite la auditul schemei de producție:
--   A. followup_templates: orice user putea ȘTERGE/MODIFICA template-urile
--      de sistem (user_id IS NULL), partajate de toți. Le facem read-only.
--   B. products: politica "USING (true)" expunea TOT catalogul (toate
--      companiile) public, inclusiv anon. Păstrăm doar scoping pe companie.
--   C. guides: vizibile tuturor indiferent de companie → scoping pe companie.
--   D. handle_new_user(): SECURITY DEFINER fără search_path fix (hardening).
--   E. exchange_rates: eliminăm politica publică redundantă (rămâne cea
--      pentru authenticated).
-- ============================================================

-- ── A. followup_templates ────────────────────────────────────
-- Citire: template-urile proprii + cele de sistem (user_id IS NULL).
-- Scriere (insert/update/delete): DOAR cele proprii. Template-urile de
-- sistem devin intangibile pentru useri.
drop policy if exists "Users can manage own templates" on public.followup_templates;

drop policy if exists "Templates: read own or system" on public.followup_templates;
create policy "Templates: read own or system"
  on public.followup_templates for select to authenticated
  using (user_id = auth.uid() or user_id is null);

drop policy if exists "Templates: insert own" on public.followup_templates;
create policy "Templates: insert own"
  on public.followup_templates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Templates: update own" on public.followup_templates;
create policy "Templates: update own"
  on public.followup_templates for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Templates: delete own" on public.followup_templates;
create policy "Templates: delete own"
  on public.followup_templates for delete to authenticated
  using (user_id = auth.uid());

-- ── B. products ──────────────────────────────────────────────
-- Eliminăm politica publică care anula scoping-ul pe companie.
-- Rămâne "Products viewable by company members" (active + aceeași companie).
drop policy if exists "Products viewable by all" on public.products;

-- ── C. guides ────────────────────────────────────────────────
drop policy if exists "Guides viewable by authenticated users" on public.guides;

drop policy if exists "Guides viewable by company members" on public.guides;
create policy "Guides viewable by company members"
  on public.guides for select to authenticated
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- ── D. handle_new_user(): pin search_path ────────────────────
alter function public.handle_new_user() set search_path = public;

-- ── E. exchange_rates: drop politica publică redundantă ───────
drop policy if exists "Exchange rates viewable by all" on public.exchange_rates;
