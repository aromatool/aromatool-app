-- ============================================================
-- 20260712_admin_email_usage.sql
-- RPC admin pentru cardul „Consum email" din Admin.
--
-- Numără emailurile trimise PRIN APLICAȚIE (oferte + emailuri de cont)
-- pe luna calendaristică curentă și pe ziua curentă (UTC), ca adminul
-- să vadă cât din limita Resend a consumat.
--
-- Surse:
--   • offers   — ofertele trimise pe email (sent_via in 'email','both').
--   • account_email_log — emailuri de cont (trial reminders etc.).
--
-- NU include emailurile de autentificare (confirmare signup, resetare
-- parolă, schimbare email) care pleacă prin SMTP Resend și nu sunt logate
-- la noi. Numărul e deci o limită INFERIOARĂ a consumului real Resend.
--
-- SECURITY DEFINER + guard is_admin() → poate citi rândurile TUTUROR
-- userilor (altfel RLS ar limita la rândurile proprii).
--
-- Rulează în: Supabase Dashboard → SQL Editor. Idempotent.
-- ============================================================

create or replace function public.admin_email_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start  timestamptz := date_trunc('month', now());
  v_day_start    timestamptz := date_trunc('day', now());
  v_offers_month  int;
  v_offers_day    int;
  v_account_month int;
  v_account_day   int;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_offers_month
    from public.offers
    where sent_at >= v_month_start
      and sent_via in ('email', 'both');

  select count(*) into v_offers_day
    from public.offers
    where sent_at >= v_day_start
      and sent_via in ('email', 'both');

  select count(*) into v_account_month
    from public.account_email_log
    where sent_at >= v_month_start;

  select count(*) into v_account_day
    from public.account_email_log
    where sent_at >= v_day_start;

  return jsonb_build_object(
    'month_offers',  v_offers_month,
    'month_account', v_account_month,
    'month_total',   v_offers_month + v_account_month,
    'day_offers',    v_offers_day,
    'day_account',   v_account_day,
    'day_total',     v_offers_day + v_account_day
  );
end;
$$;

revoke all on function public.admin_email_usage() from public;
grant execute on function public.admin_email_usage() to authenticated;
