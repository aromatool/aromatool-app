-- ============================================================
-- FEEDBACK + FUNCȚII ADMIN
-- 1. is_admin() — helper SECURITY DEFINER, evită recursia RLS.
-- 2. feedback — tabel pentru sugestii/probleme lăsate de utilizatori.
-- 3. admin_overview() / admin_users() — citiri agregate pentru panoul
--    de admin, fără a deschide RLS pe toate tabelele (guard în funcție).
-- ============================================================

-- ── Helper: e adminul curent? ──────────────────────────────
-- SECURITY DEFINER + search_path fix => citește profiles fără RLS,
-- deci nu intră în recursiune când e folosit în policies pe profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ── FEEDBACK ───────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid        default uuid_generate_v4() primary key,
  user_id     uuid        references auth.users(id) on delete set null,
  type        text        not null default 'sugestie'
                check (type in ('sugestie','problema','altele')),
  message     text        not null,
  page        text,
  user_email  text,
  status      text        not null default 'new'
                check (status in ('new','reviewed')),
  created_at  timestamptz default now()
);

create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- Userul își creează propriul feedback.
create policy "Users insert own feedback"
  on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

-- Userul își vede feedback-ul propriu; adminul le vede pe toate.
create policy "View own feedback or admin"
  on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Doar adminul poate marca feedback-ul (ex: 'reviewed').
create policy "Admin updates feedback"
  on public.feedback for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── ADMIN: statistici platformă ────────────────────────────
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
    'new_feedback',   (select count(*) from public.feedback where status = 'new')
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

-- ── ADMIN: listă utilizatori cu agregate ───────────────────
create or replace function public.admin_users()
returns table (
  id                uuid,
  email             text,
  full_name         text,
  subscription_plan text,
  is_admin          boolean,
  created_at        timestamptz,
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
      (select count(*) from public.contacts c where c.user_id = p.id),
      (select count(*) from public.offers o where o.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

-- ── ADMIN: acordă / retrage rolul de admin ─────────────────
-- SECURITY DEFINER ca să poată scrie pe alt profil fără a deschide
-- RLS de update pe profiles. Protecții:
--   • doar un admin poate apela;
--   • nu te poți retrage pe tine însuți (eviți să rămâi fără admin).
create or replace function public.admin_set_user_admin(
  target_id uuid,
  make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if target_id = auth.uid() and make_admin = false then
    raise exception 'Nu îți poți retrage singur drepturile de admin.';
  end if;
  update public.profiles
     set is_admin = make_admin,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_set_user_admin(uuid, boolean) from public;
grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;
