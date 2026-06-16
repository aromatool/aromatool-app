-- ============================================================
-- Migration: tracking click first-party (fără pixel/tracking Resend)
-- Data: 2026-07-15
-- Rulează în: Supabase Dashboard → SQL Editor
--
-- CONTEXT: Panoul „Email Tracking" de pe contact (email_clicks) se alimenta
-- DOAR din webhook-urile Resend (email.clicked), care NU se trimit cât timp
-- open/click tracking e dezactivat în Resend. Iar tracking-ul Resend îl ținem
-- OPRIT intenționat (pixel + rescriere linkuri → Promotions/spam).
--
-- SOLUȚIE: folosim click-ul first-party pe care îl avem deja — `resource-redirect`
-- apelează touch_resource_link() la fiecare accesare de link de resursă, iar
-- `resource_links` are deja `contact_id`. Extindem funcția să incrementeze și
-- `contacts.email_clicks` + un timestamp de ultimă activitate. Zero cost de
-- livrabilitate, semnal 100% real (acțiune umană pe domeniul nostru).
--
-- LIMITARE cunoscută: se prinde doar click pe linkuri de resursă incluse în
-- email. Ofertele fără resursă atașată nu generează click (acoperirea completă
-- vine post-lansare din pagina „Vezi oferta completă").
-- ============================================================

-- 1. Timestamp „ultima activitate prin click" (idempotent)
alter table public.contacts
  add column if not exists last_clicked_at timestamp with time zone;

-- 2. La fiecare click pe link de resursă, incrementăm și contorul contactului
create or replace function public.touch_resource_link(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  with bumped as (
    update public.resource_links
    set clicked_at = coalesce(clicked_at, now()),
        click_count = click_count + 1
    where token = p_token
    returning contact_id
  )
  update public.contacts c
  set email_clicks    = coalesce(c.email_clicks, 0) + 1,
      last_clicked_at = now()
  from bumped b
  where b.contact_id is not null
    and c.id = b.contact_id;
$$;

-- Permisiunile rămân ca înainte (apelată de service_role din resource-redirect)
revoke all on function public.touch_resource_link(text) from public;
grant execute on function public.touch_resource_link(text) to service_role;
