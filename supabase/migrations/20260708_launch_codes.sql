-- ============================================================
-- LAUNCH / PROMO CODES — coduri redeemabile în app care acordă
-- zile gratuite (extind trial_ends_at). Ex: 100 coduri „fondatori"
-- de +15 zile la lansare.
--
-- Reduceri pe abonament NU se fac aici — alea sunt promotion codes
-- în Stripe (deja activate la checkout prin allow_promotion_codes).
-- Coloana `kind` lasă schema extensibilă pentru viitor.
--
-- Rulează în: Supabase Dashboard → SQL Editor. Idempotent.
-- ============================================================

-- ── 1) Tabel coduri ─────────────────────────────────────────
create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,           -- stocat MAJUSCULE
  kind            text not null default 'trial_days'
                    check (kind in ('trial_days')),
  trial_days      int  not null default 15
                    check (trial_days > 0 and trial_days <= 3650),
  max_redemptions int,                            -- null = nelimitat
  redeemed_count  int  not null default 0,
  expires_at      timestamptz,                    -- null = nu expiră
  active          boolean not null default true,
  note            text,                           -- etichetă internă (ex. „Lansare")
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ── 2) Tabel redeem-uri (o singură dată per user/cod) ───────
create table if not exists public.promo_code_redemptions (
  code_id            uuid not null references public.promo_codes(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  trial_days_granted int  not null,
  redeemed_at        timestamptz not null default now(),
  primary key (code_id, user_id)
);

create index if not exists idx_promo_redemptions_user
  on public.promo_code_redemptions(user_id);

-- ── 3) RLS: acces DOAR prin RPC (SECURITY DEFINER) ──────────
alter table public.promo_codes            enable row level security;
alter table public.promo_code_redemptions enable row level security;
-- Fără policies → userii obișnuiți nu pot citi/scrie direct.

-- ── 4) Helper: generează un cod aleatoriu lizibil ───────────
-- Fără caractere ambigue (0/O, 1/I/L). Prefix opțional.
create or replace function public.gen_promo_code(p_prefix text default '')
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  for i in 1..8 loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  if coalesce(p_prefix, '') <> '' then
    return upper(p_prefix) || '-' || out;
  end if;
  return out;
end;
$$;

-- ── 5) REDEEM (user autentificat) ───────────────────────────
-- Întoarce jsonb cu status, ca front-end-ul să traducă mesajul (i18n).
-- Statusuri: ok | not_found | inactive | expired | exhausted | already
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  public.promo_codes;
  v_base  timestamptz;
  v_end   timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Blocăm rândul codului pentru a evita curse pe max_redemptions.
  select * into v_code
    from public.promo_codes
    where code = upper(trim(p_code))
    for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not v_code.active then
    return jsonb_build_object('status', 'inactive');
  end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  -- Deja folosit de acest user?
  if exists (
    select 1 from public.promo_code_redemptions
    where code_id = v_code.id and user_id = v_uid
  ) then
    return jsonb_build_object('status', 'already');
  end if;

  -- Limita de utilizări atinsă?
  if v_code.max_redemptions is not null
     and v_code.redeemed_count >= v_code.max_redemptions then
    return jsonb_build_object('status', 'exhausted');
  end if;

  -- Extinde din trial_ends_at curent dacă e în viitor, altfel din acum.
  select greatest(coalesce(trial_ends_at, now()), now()) into v_base
    from public.profiles where id = v_uid;
  v_end := v_base + make_interval(days => v_code.trial_days);

  -- Trigger-ul anti-escaladare (guard_profile_privileged_cols) ar reverti
  -- trial_ends_at pentru un self-update ne-admin. Setăm un flag tranzacțional
  -- (al treilea arg = true ⇒ valabil DOAR în această tranzacție) ca guard-ul
  -- să lase această modificare controlată să treacă. Îl resetăm imediat după.
  perform set_config('aromatool.bypass_profile_guard', 'on', true);
  update public.profiles set trial_ends_at = v_end where id = v_uid;
  perform set_config('aromatool.bypass_profile_guard', 'off', true);

  insert into public.promo_code_redemptions (code_id, user_id, trial_days_granted)
    values (v_code.id, v_uid, v_code.trial_days);

  update public.promo_codes
    set redeemed_count = redeemed_count + 1
    where id = v_code.id;

  return jsonb_build_object(
    'status', 'ok',
    'days', v_code.trial_days,
    'trial_ends_at', v_end
  );
end;
$$;

revoke all on function public.redeem_promo_code(text) from public;
grant execute on function public.redeem_promo_code(text) to authenticated;

-- ── 6) ADMIN: creează un cod ────────────────────────────────
create or replace function public.admin_create_promo_code(
  p_code            text,
  p_trial_days      int default 15,
  p_max_redemptions int default 1,
  p_expires_at      timestamptz default null,
  p_note            text default null
)
returns public.promo_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.promo_codes;
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  -- Cod gol → generează automat unul unic (ce promite UI-ul).
  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' then
    loop
      v_code := public.gen_promo_code('');
      exit when not exists (
        select 1 from public.promo_codes where code = v_code
      );
    end loop;
  elsif exists (select 1 from public.promo_codes where code = v_code) then
    raise exception 'Codul % există deja.', v_code using errcode = 'unique_violation';
  end if;
  insert into public.promo_codes (code, trial_days, max_redemptions, expires_at, note, created_by)
    values (v_code, p_trial_days, p_max_redemptions, p_expires_at, p_note, auth.uid())
    returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.admin_create_promo_code(text, int, int, timestamptz, text) from public;
grant execute on function public.admin_create_promo_code(text, int, int, timestamptz, text) to authenticated;

-- ── 7) ADMIN: generează în masă (ex. 100 coduri single-use) ──
-- Întoarce codurile generate. Fiecare e single-use (max_redemptions = 1).
create or replace function public.admin_bulk_create_promo_codes(
  p_count       int,
  p_trial_days  int default 15,
  p_prefix      text default '',
  p_expires_at  timestamptz default null,
  p_note        text default null
)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_i    int := 0;
  v_try  int;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_count is null or p_count < 1 or p_count > 1000 then
    raise exception 'Număr invalid (1–1000).';
  end if;

  while v_i < p_count loop
    -- Reîncearcă dacă se nimerește o coliziune de cod (foarte rar).
    v_try := 0;
    loop
      v_code := public.gen_promo_code(p_prefix);
      begin
        insert into public.promo_codes (code, trial_days, max_redemptions, expires_at, note, created_by)
          values (v_code, p_trial_days, 1, p_expires_at, p_note, auth.uid());
        exit; -- inserat cu succes
      exception when unique_violation then
        v_try := v_try + 1;
        if v_try > 5 then raise exception 'Nu pot genera cod unic.'; end if;
      end;
    end loop;
    v_i := v_i + 1;
    return next v_code;
  end loop;
end;
$$;

revoke all on function public.admin_bulk_create_promo_codes(int, int, text, timestamptz, text) from public;
grant execute on function public.admin_bulk_create_promo_codes(int, int, text, timestamptz, text) to authenticated;

-- ── 8) ADMIN: listează codurile ─────────────────────────────
create or replace function public.admin_list_promo_codes()
returns setof public.promo_codes
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
    select * from public.promo_codes order by created_at desc;
end;
$$;

revoke all on function public.admin_list_promo_codes() from public;
grant execute on function public.admin_list_promo_codes() to authenticated;

-- ── 9) ADMIN: activează/dezactivează un cod ─────────────────
create or replace function public.admin_set_promo_code_active(
  p_id    uuid,
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
  update public.promo_codes set active = coalesce(p_value, false) where id = p_id;
  return coalesce(p_value, false);
end;
$$;

revoke all on function public.admin_set_promo_code_active(uuid, boolean) from public;
grant execute on function public.admin_set_promo_code_active(uuid, boolean) to authenticated;
