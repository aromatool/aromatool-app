-- ============================================================
-- C1: GUARD anti-escaladare de privilegii pe public.profiles
-- ============================================================
-- PROBLEMA: frontendul își actualizează propriul profil direct
--   (SettingsPage: supabase.from('profiles').update({...}).eq('id', uid)).
-- Asta presupune o politică RLS UPDATE „self" (id = auth.uid()).
-- PostgreSQL RLS NU poate restricționa CARE coloane sunt scrise, iar un
-- GRANT UPDATE la nivel de TABEL acoperă oricum toate coloanele (un REVOKE
-- pe coloane individuale e ignorat cât timp există grantul pe tabel).
-- => fără protecție, orice user autentificat ar putea rula din browser:
--      update profiles set is_admin = true            → devine admin
--      update profiles set free_access = true         → acces gratuit
--      update profiles set subscription_status='active'→ bypass plată
--      update profiles set trial_ends_at = '2099-…'   → trial infinit
--
-- SOLUȚIE: trigger BEFORE UPDATE care, DOAR pentru self-update-ul unui user
-- ne-admin, forțează păstrarea valorilor vechi pe coloanele privilegiate.
-- Robust indiferent de granturi/policy și fără mentenanță la adăugarea de
-- coloane noi ne-privilegiate.
--
-- Cine NU e afectat (corect):
--   • service_role (webhook Stripe, Edge Functions) → auth.uid() IS NULL.
--   • RPC-urile admin (SECURITY DEFINER) care scriu pe ALT user → new.id <> auth.uid().
--   • un admin care își editează propriul profil → public.is_admin() = true.
-- ============================================================

create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Self-update al unui user ne-admin: blochează schimbarea coloanelor sensibile.
  if auth.uid() is not null
     and auth.uid() = new.id
     and not public.is_admin()
  then
    new.is_admin            := old.is_admin;
    new.free_access         := old.free_access;
    new.subscription_status := old.subscription_status;
    new.subscription_plan   := old.subscription_plan;
    new.trial_ends_at       := old.trial_ends_at;
    new.stripe_customer_id  := old.stripe_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged_cols on public.profiles;
create trigger trg_guard_profile_privileged_cols
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_cols();

-- Notă: dacă vreo coloană privilegiată nu există în schema ta (ex: nu folosești
-- subscription_plan), șterge linia respectivă din funcție înainte de a rula.
