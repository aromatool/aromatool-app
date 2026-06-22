-- ════════════════════════════════════════════════════════════════
-- 20260720_followup_days_default.sql
-- Coborâm intervalul IMPLICIT de follow-up de la 5 → 3 zile.
--
-- Context: după ce trimiteai prima ofertă, prospectul apărea IMEDIAT în
-- „Focus today" cu „necesită follow-up", fără să respecte intervalul setat.
-- Fix-ul (în cod) face ca primul follow-up să aștepte `follow_up_days` de la
-- ofertă. În plus, 5 zile părea prea mult ca default → îl coborâm la 3.
--
-- 1) Schimbăm DEFAULT-ul coloanei (pentru conturile NOI).
-- 2) Migrăm conturile existente rămase pe vechiul default (5) sau NULL la 3.
--    NU atingem userii care au ales explicit alt interval (≠ 5). Oricine
--    poate oricând re-seta valoarea din Setări → Profil.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

-- 1) DEFAULT nou pentru conturile noi
alter table public.profiles
  alter column follow_up_days set default 3;

-- 2) Migrează conturile rămase pe vechiul default (5) sau fără valoare → 3
update public.profiles
   set follow_up_days = 3
 where follow_up_days = 5
    or follow_up_days is null;
