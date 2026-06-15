-- ════════════════════════════════════════════════════════════════
-- 20260705_offer_logged_channels.sql
-- Extinde canalele acceptate pentru offers.sent_via
--   → adaugă 'phone' și 'other' (pe lângă 'email','whatsapp','both')
--
-- Context: până acum o ofertă se salva în tabela `offers` DOAR când era
-- trimisă pe email (sent_via='email'). Dacă distribuitorul trimitea oferta
-- pe WhatsApp, o copia, sau o comunica la telefon, nu rămânea nicio urmă în
-- CRM → contactul rămânea blocat pe „Trimite prima ofertă", iar Focus/Today
-- îl semnala la nesfârșit.
--
-- Adăugăm o acțiune „Marchează ca trimisă" în Calculator, care salvează
-- oferta fără email, cu canalul ales de user. Pentru asta avem nevoie de
-- valori suplimentare în CHECK-ul pe `sent_via`:
--   'whatsapp' — exista deja
--   'phone'    — ofertă comunicată telefonic/verbal (NOU)
--   'other'    — alt canal: SMS, Messenger, în persoană etc. (NOU)
--
-- Idempotent: dacă rulezi de două ori, drop-ul cu IF EXISTS + re-add nu strică
-- nimic. Datele existente (toate au 'email'/'whatsapp'/'both') rămân valide.
--
-- Se aplică MANUAL în Supabase SQL Editor (NU `supabase db push`).
-- ════════════════════════════════════════════════════════════════

alter table public.offers
  drop constraint if exists offers_sent_via_check;

alter table public.offers
  add constraint offers_sent_via_check
  check (sent_via = any (array['email', 'whatsapp', 'both', 'phone', 'other']));
