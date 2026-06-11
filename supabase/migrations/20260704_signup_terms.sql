-- ════════════════════════════════════════════════════════════════
-- 20260704_signup_terms.sql
-- Dovada acceptării Termeni + Confidențialitate la signup
--   → profiles.terms_accepted_at
--
-- Context: formularul de înregistrare (AuthPage) cere acum o bifă
-- OBLIGATORIE de acceptare a Termenilor și a Politicii de confidențialitate
-- (nebifată implicit → consimțământ activ, conform GDPR). Ca să avem DOVADA
-- acceptării (nu doar gate-ul din UI), înregistrăm momentul acceptării în
-- profil.
--
-- SECURITATE: NU salvăm un timestamp trimis de client (raw_user_meta_data
-- e controlat de client și poate fi falsificat). Clientul trimite doar un
-- flag boolean `terms_accepted: true`; momentul (`now()`) e pus de SERVER,
-- deci e de încredere.
--
-- La fel ca set_signup_country: trigger SUPLIMENTAR care rulează DUPĂ
-- handle_new_user (ordine alfabetică a numelui), ca să NU atingem trigger-ul
-- principal. Profilul există deja când rulează acesta.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- 1) Coloana pentru dovada acceptării (null = nu s-a înregistrat acceptarea).
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- 2) Trigger: dacă signup-ul a trimis flag-ul de acceptare, marcăm momentul
--    pe server. Punem doar dacă încă e null (idempotent, nu suprascrie).
create or replace function public.set_signup_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean, false) then
    update public.profiles
       set terms_accepted_at = now()
     where id = new.id
       and terms_accepted_at is null;
  end if;
  return new;
end;
$$;

-- Numele sortează DUPĂ `on_auth_user_created`, deci profilul creat de
-- handle_new_user e deja vizibil când rulează acest trigger.
drop trigger if exists on_auth_user_created_terms on auth.users;
create trigger on_auth_user_created_terms
  after insert on auth.users
  for each row execute function public.set_signup_terms();
