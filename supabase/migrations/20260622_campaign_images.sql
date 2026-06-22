-- ============================================================
-- CAMPAIGN IMAGES — poze pentru emailurile „trimite în grup".
-- Spre deosebire de bucket-ul `resources` (PRIVAT, servit prin
-- redirect cu token), aici avem nevoie de un bucket PUBLIC:
-- clienții de email (Gmail/Outlook) trebuie să poată descărca
-- direct poza prin <img src=...>, fără autentificare.
--
-- Izolare pe user: scriere/ștergere doar în folderul propriu
-- ({user_id}/...), citire publică (necesar pentru afișarea în email).
-- Limită de 3 MB/fișier + doar imagini (defensiv; clientul oricum
-- comprimă înainte de upload).
-- ============================================================

-- ── BUCKET STORAGE (public) ──────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-images',
  'campaign-images',
  true,
  3145728, -- 3 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── POLITICI STORAGE ─────────────────────────────────────────
-- Path: {user_id}/{uuid}.{ext}  →  foldername[1] = user_id
drop policy if exists "Campaign images: public read"    on storage.objects;
drop policy if exists "Campaign images: owner insert"   on storage.objects;
drop policy if exists "Campaign images: owner update"   on storage.objects;
drop policy if exists "Campaign images: owner delete"   on storage.objects;

-- Citire publică (orice email client poate afișa poza).
create policy "Campaign images: public read"
  on storage.objects for select
  using (bucket_id = 'campaign-images');

-- Scriere doar în folderul propriu, doar utilizatori autentificați.
create policy "Campaign images: owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Campaign images: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'campaign-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Campaign images: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-images' and (storage.foldername(name))[1] = auth.uid()::text);
