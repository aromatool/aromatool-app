-- ════════════════════════════════════════════════════════════════
-- 20260718_waitlist.sql
-- Listă de pre-înscriere („waitlist") pentru pagina coming-soon de pe
-- getaromatool.com. Vizitatorii lasă emailul → luni primesc un mail cu
-- codul de lansare (15 zile gratis) + anunțul că app-ul e live.
--
-- Acces: DOAR prin Edge Functions cu service_role (waitlist-signup pentru
-- inserare publică, waitlist-launch pentru trimiterea emailului). RLS e
-- pornit fără policies → anon/authenticated NU pot citi/scrie direct.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,          -- stocat lowercased (vezi funcția)
  consent     boolean not null default true, -- acord explicit pentru a fi anunțat
  source      text,                          -- ex: 'coming_soon'
  user_agent  text,                          -- diagnostic minim, nu marketing
  created_at  timestamptz not null default now(),
  notified_at timestamptz                    -- când a fost trimis emailul de lansare
);

-- Coadă rapidă pentru „cine n-a primit încă emailul de lansare".
create index if not exists idx_waitlist_notified
  on public.waitlist(notified_at);

-- RLS pornit, fără policies → tabelul e invizibil pentru anon/authenticated.
-- Singurul acces e prin service_role (Edge Functions), care ocolește RLS.
alter table public.waitlist enable row level security;
