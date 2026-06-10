-- ════════════════════════════════════════════════════════════════
-- 20260621_signup_country.sql
-- Auto-detect țară la signup → profiles.country_code
--
-- Context: frontend-ul (src/lib/auth.tsx → signUp) trimite acum în
-- raw_user_meta_data un câmp `country_code` detectat din locale-ul
-- browserului (doar țări suportate la lansare — zona EUR; altfel RO).
--
-- handle_new_user() (trigger on_auth_user_created) NU e versionat în repo
-- și inserează doar id/full_name/contact_email/company_id, lăsând restul
-- coloanelor pe default. Ca să NU atingem acel trigger (risc de a strica
-- rezolvarea company_id), adăugăm un trigger SUPLIMENTAR care rulează
-- DUPĂ el (ordine alfabetică a numelui de trigger) și completează doar
-- country_code din metadata, dacă a fost trimis.
--
-- country_code rămâne editabil oricând din Setări.
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

create or replace function public.set_signup_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Doar dacă signup-ul a trimis explicit o țară.
  if new.raw_user_meta_data ? 'country_code'
     and coalesce(new.raw_user_meta_data->>'country_code', '') <> '' then
    update public.profiles
       set country_code = new.raw_user_meta_data->>'country_code'
     where id = new.id;
  end if;
  return new;
end;
$$;

-- Numele sortează DUPĂ `on_auth_user_created`, deci profilul creat de
-- handle_new_user e deja vizibil când rulează acest trigger.
drop trigger if exists on_auth_user_created_country on auth.users;
create trigger on_auth_user_created_country
  after insert on auth.users
  for each row execute function public.set_signup_country();
