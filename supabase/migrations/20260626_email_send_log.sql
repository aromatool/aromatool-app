-- ============================================================
-- H1: Rate-limit pentru send-email
-- ============================================================
-- Tabel intern (nu per-user UI): un rând per email trimis cu succes prin
-- Edge Function `send-email`. Folosit DOAR pentru rate-limiting server-side
-- (numărăm trimiterile userului într-o fereastră de timp). Scris exclusiv de
-- service_role din funcție; clienții nu au acces (RLS fără policy).
-- ============================================================

create table if not exists public.email_send_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  sent_at   timestamptz not null default now()
);

-- Index pentru interogarea „câte a trimis userul X în ultima oră/zi".
create index if not exists email_send_log_user_time_idx
  on public.email_send_log (user_id, sent_at desc);

-- RLS pornit, fără policy → clienții nu pot citi/scrie; service_role bypassează.
alter table public.email_send_log enable row level security;

-- Curățare opțională a istoricului mai vechi de 30 de zile (igienă).
-- Rulează manual sau dintr-un cron existent dacă vrei.
--   delete from public.email_send_log where sent_at < now() - interval '30 days';
