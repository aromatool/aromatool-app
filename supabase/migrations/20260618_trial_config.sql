-- ============================================================
-- TRIAL CONFIG — perioada de trial devine configurabilă.
-- • app_config: tabel cheie/valoare pentru setări globale.
-- • trial_days(): citește durata trialului (fallback 14).
-- • default-ul pe profiles.trial_ends_at folosește funcția, deci
--   schimbarea duratei NU mai cere migrație — doar un UPDATE.
-- • RPC admin pentru: citire/setare durată globală + prelungire
--   trial per utilizator. Toate protejate cu is_admin().
-- ============================================================

-- ── 1) Tabel config global ──────────────────────────────────
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Fără policies pentru useri obișnuiți: accesul se face doar prin
-- funcții SECURITY DEFINER (citire) și RPC admin (scriere).

-- Valoare implicită: 14 zile de trial.
insert into public.app_config (key, value)
values ('trial_days', '14')
on conflict (key) do nothing;

-- ── 2) Funcția care întoarce durata trialului ───────────────
create or replace function public.trial_days()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif((select value from public.app_config where key = 'trial_days'), '')::int,
    14
  )
$$;

-- Necesită execute pentru rolul care inserează profilul nou
-- (default-ul coloanei apelează funcția la INSERT).
grant execute on function public.trial_days() to anon, authenticated, service_role;

-- ── 3) Default-ul coloanei folosește funcția ────────────────
alter table public.profiles
  alter column trial_ends_at
  set default (now() + make_interval(days => public.trial_days()));

-- ── 4) Citire durată globală (admin) ────────────────────────
create or replace function public.admin_get_trial_days()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return public.trial_days();
end;
$$;

revoke all on function public.admin_get_trial_days() from public;
grant execute on function public.admin_get_trial_days() to authenticated;

-- ── 5) Setare durată globală (admin) ────────────────────────
create or replace function public.admin_set_trial_days(p_days int)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_days is null or p_days < 0 or p_days > 365 then
    raise exception 'Număr de zile invalid (0–365).';
  end if;
  insert into public.app_config (key, value, updated_at)
  values ('trial_days', p_days::text, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();
  return p_days;
end;
$$;

revoke all on function public.admin_set_trial_days(int) from public;
grant execute on function public.admin_set_trial_days(int) to authenticated;

-- ── 6) Prelungire/setare trial per utilizator (admin) ───────
-- Setează data de expirare la now() + p_days (zile de azi înainte).
create or replace function public.admin_set_user_trial(p_user uuid, p_days int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_days is null or p_days < 0 or p_days > 3650 then
    raise exception 'Număr de zile invalid (0–3650).';
  end if;
  v_end := now() + make_interval(days => p_days);
  update public.profiles set trial_ends_at = v_end where id = p_user;
  return v_end;
end;
$$;

revoke all on function public.admin_set_user_trial(uuid, int) from public;
grant execute on function public.admin_set_user_trial(uuid, int) to authenticated;

-- ── 7) admin_users(): adaugă trial_ends_at + subscription_status ──
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (
  id                  uuid,
  email               text,
  full_name           text,
  subscription_plan   text,
  subscription_status text,
  trial_ends_at       timestamptz,
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
