-- ============================================================
-- ACCESS OVERRIDES — acces fără plată, controlat de admin.
-- • profiles.free_access: cont căruia adminul îi dă acces gratuit
--   (fără abonament, fără trial), dar FĂRĂ drepturi de admin.
-- • Adminii au oricum acces total (gestionat în aplicație).
-- • Regula finală de acces:
--     admin  SAU  free_access  SAU  abonament activ  SAU  în trial.
-- ============================================================

-- ── 1) Flag acces gratuit ───────────────────────────────────
alter table public.profiles
  add column if not exists free_access boolean not null default false;

-- ── 2) Toggle acces gratuit per utilizator (admin) ──────────
create or replace function public.admin_set_user_free_access(
  p_user  uuid,
  p_value boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.profiles
    set free_access = coalesce(p_value, false)
    where id = p_user;
  return coalesce(p_value, false);
end;
$$;

revoke all on function public.admin_set_user_free_access(uuid, boolean) from public;
grant execute on function public.admin_set_user_free_access(uuid, boolean) to authenticated;

-- ── 3) admin_users(): adaugă free_access ────────────────────
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (
  id                  uuid,
  email               text,
  full_name           text,
  subscription_plan   text,
  subscription_status text,
  trial_ends_at       timestamptz,
  free_access         boolean,
  is_admin            boolean,
  created_at          timestamptz,
  last_sign_in_at     timestamptz,
  contacts_count      bigint,
  offers_count        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select
      p.id,
      u.email::text,
      p.full_name,
      p.subscription_plan,
      p.subscription_status,
      p.trial_ends_at,
      p.free_access,
      p.is_admin,
      p.created_at,
      u.last_sign_in_at,
      (select count(*) from public.contacts c where c.user_id = p.id),
      (select count(*) from public.offers o where o.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
