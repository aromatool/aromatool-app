-- ============================================================
-- Migration: paywall server-side în RLS (gate de scriere pe abonament)
-- Data: 2026-07-13
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- PROBLEMĂ (audit, HIGH): paywall-ul era doar pe client. RLS verifica doar
-- `user_id = auth.uid()`, fără `subscription_status`. Singura barieră
-- server-side era la send-email. Un user cu trial expirat putea folosi CRM-ul
-- direct prin API (creare/editare contacte, oferte, follow-up) → pierdere de
-- venit. Gate-ul de UI (src/lib/subscription.tsx) e ușor de ocolit.
--
-- SOLUȚIE: replicăm computeHasAccess() din send-email/index.ts ca funcție SQL
-- și o aplicăm pe INSERT + UPDATE (acțiunile „plătite" = a crea/modifica date).
--
-- CE NU gate-uim intenționat:
--   • SELECT — userul cu trial expirat trebuie să-și poată VEDEA datele
--     (și pentru exportul GDPR din Setări).
--   • DELETE — trebuie să-și poată ȘTERGE datele oricând (drept GDPR + cleanup).
-- Astfel, expirarea blochează doar crearea/modificarea de conținut nou, nu
-- accesul la datele existente.
-- ============================================================

-- ── 0. FUNCȚIA DE ACCES ───────────────────────────────────────
-- Replică server-side a regulii din UI și din send-email:
--   hasAccess = is_admin || free_access || subscription_status='active'
--             || (trial valid: trial_ends_at în viitor)
-- SECURITY DEFINER + search_path fix: citește profilul propriu indiferent de
-- RLS, fără riscul de a fi păcălită prin search_path.
create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.is_admin
      or p.free_access
      or p.subscription_status = 'active'
      or (p.trial_ends_at is not null and p.trial_ends_at > now())
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.has_active_access() from public;
grant execute on function public.has_active_access() to authenticated;

-- ── 1. CONTACTS ───────────────────────────────────────────────
drop policy if exists "Users can manage own contacts" on public.contacts;

drop policy if exists "Contacts: select own" on public.contacts;
create policy "Contacts: select own"
  on public.contacts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Contacts: delete own" on public.contacts;
create policy "Contacts: delete own"
  on public.contacts for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Contacts: insert own with access" on public.contacts;
create policy "Contacts: insert own with access"
  on public.contacts for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Contacts: update own with access" on public.contacts;
create policy "Contacts: update own with access"
  on public.contacts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ── 2. OFFERS ─────────────────────────────────────────────────
drop policy if exists "Users can manage own offers" on public.offers;

drop policy if exists "Offers: select own" on public.offers;
create policy "Offers: select own"
  on public.offers for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Offers: delete own" on public.offers;
create policy "Offers: delete own"
  on public.offers for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Offers: insert own with access" on public.offers;
create policy "Offers: insert own with access"
  on public.offers for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Offers: update own with access" on public.offers;
create policy "Offers: update own with access"
  on public.offers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ── 3. FOLLOWUP_LOG ───────────────────────────────────────────
drop policy if exists "Users can view own followup log" on public.followup_log;

drop policy if exists "Followup log: select own" on public.followup_log;
create policy "Followup log: select own"
  on public.followup_log for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Followup log: delete own" on public.followup_log;
create policy "Followup log: delete own"
  on public.followup_log for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Followup log: insert own with access" on public.followup_log;
create policy "Followup log: insert own with access"
  on public.followup_log for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Followup log: update own with access" on public.followup_log;
create policy "Followup log: update own with access"
  on public.followup_log for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ── 4. RESOURCES ──────────────────────────────────────────────
drop policy if exists "Resources are owner-only" on public.resources;

drop policy if exists "Resources: select own" on public.resources;
create policy "Resources: select own"
  on public.resources for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Resources: delete own" on public.resources;
create policy "Resources: delete own"
  on public.resources for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Resources: insert own with access" on public.resources;
create policy "Resources: insert own with access"
  on public.resources for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Resources: update own with access" on public.resources;
create policy "Resources: update own with access"
  on public.resources for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ── 5. TEMPLATE_RESOURCES ─────────────────────────────────────
drop policy if exists "Template resources are owner-only" on public.template_resources;

drop policy if exists "Template resources: select own" on public.template_resources;
create policy "Template resources: select own"
  on public.template_resources for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Template resources: delete own" on public.template_resources;
create policy "Template resources: delete own"
  on public.template_resources for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Template resources: insert own with access" on public.template_resources;
create policy "Template resources: insert own with access"
  on public.template_resources for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Template resources: update own with access" on public.template_resources;
create policy "Template resources: update own with access"
  on public.template_resources for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ── 6. FOLLOWUP_TEMPLATES ─────────────────────────────────────
-- Politicile de SELECT (own + sistem) și DELETE (own) rămân cum sunt din
-- 20260630. Doar adăugăm gate-ul de acces pe INSERT și UPDATE.
drop policy if exists "Templates: insert own" on public.followup_templates;
drop policy if exists "Templates: insert own with access" on public.followup_templates;
create policy "Templates: insert own with access"
  on public.followup_templates for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "Templates: update own" on public.followup_templates;
drop policy if exists "Templates: update own with access" on public.followup_templates;
create policy "Templates: update own with access"
  on public.followup_templates for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());
