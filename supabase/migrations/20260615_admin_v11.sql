-- ============================================================
-- ADMIN v1.1
-- 1. feedback: 4 statusuri (new / reviewed / planned / done).
-- 2. admin_overview(): + utilizatori activi (7z) + emailuri Focus azi.
-- 3. admin_users(): + last_sign_in_at (ultimul login).
-- Orientat pe operare: niciun analytics complex, doar semnale utile.
-- ============================================================

-- ── FEEDBACK: extinde statusurile ──────────────────────────
alter table public.feedback
  drop constraint if exists feedback_status_check;
alter table public.feedback
  add constraint feedback_status_check
    check (status in ('new','reviewed','planned','done'));

-- ── ADMIN OVERVIEW: carduri extinse ────────────────────────
create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  select json_build_object(
    'total_users',    (select count(*) from public.profiles),
    'total_contacts', (select count(*) from public.contacts),
    'total_offers',   (select count(*) from public.offers),
    'new_feedback',   (select count(*) from public.feedback where status = 'new'),
    -- Utilizatori care s-au logat în ultimele 7 zile.
    'active_7d',      (select count(*) from auth.users
                         where last_sign_in_at > now() - interval '7 days'),
    -- Emailuri Daily Focus trimise azi (după data serverului).
    'emails_today',   (select coalesce(sum(emails_sent), 0)
                         from public.daily_focus_jobs
                         where run_at >= date_trunc('day', now()))
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

-- ── ADMIN USERS: + ultimul login ───────────────────────────
-- Drop necesar: schimbăm signatura (adăugăm last_sign_in_at), iar
-- `create or replace` nu poate modifica tipul returnat al funcției.
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (
  id                uuid,
  email             text,
  full_name         text,
  subscription_plan text,
  is_admin          boolean,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  contacts_count    bigint,
  offers_count      bigint
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
