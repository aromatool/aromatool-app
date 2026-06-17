-- ============================================================
-- ȘTERGERE CONTACT → ȘTERGE TOT CE-I LEGAT (cascade complet)
-- ------------------------------------------------------------
-- Bug: la ștergerea unui contact, ofertele lui rămâneau orfane
-- (contact_id devenea NULL, dar rândul din `offers` rămânea).
-- Cauza: FK-urile spre contacts erau ON DELETE SET NULL.
--
-- Fix: trecem pe ON DELETE CASCADE pentru datele „per contact":
--   • offers              → la ștergerea contactului dispar ofertele
--   • resource_links      → linkurile de tracking ale contactului
--   • resource_links.offer_id → când o ofertă e ștearsă (cascadă de
--                               la contact), dispare și linkul ei
--
-- Rămâne neschimbat:
--   • followup_log        → era deja ON DELETE CASCADE
--   • webhook_log         → rămâne SET NULL (log de audit / conformitate
--                           unsubscribe, nu e date vizibile în UI)
-- ============================================================

-- offers.contact_id → CASCADE
alter table public.offers
  drop constraint if exists offers_contact_id_fkey;
alter table public.offers
  add  constraint offers_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete cascade;

-- resource_links.contact_id → CASCADE
alter table public.resource_links
  drop constraint if exists resource_links_contact_id_fkey;
alter table public.resource_links
  add  constraint resource_links_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete cascade;

-- resource_links.offer_id → CASCADE
alter table public.resource_links
  drop constraint if exists resource_links_offer_id_fkey;
alter table public.resource_links
  add  constraint resource_links_offer_id_fkey
  foreign key (offer_id) references public.offers(id) on delete cascade;
