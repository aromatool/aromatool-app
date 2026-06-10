-- ============================================================
-- H4: Hardening bucket Storage „resources"
-- ============================================================
-- Risc inițial: bucket fără restricție de tip → un user putea încărca
-- HTML/SVG/JS care, servit inline, ar rula script (stored XSS), mai ales
-- că linkurile de resurse sunt deschise de clienții (prospecții) lor.
--
-- Fix: restricționăm tipurile MIME ACCEPTATE la nivel de bucket (autoritativ,
-- server-side — chiar dacă clientul minte content-type-ul la upload, Storage
-- îl respinge dacă nu e în listă). Tipurile permise (pdf/jpeg/png) NU execută
-- script inline, deci vizualizarea inline rămâne sigură. Adăugăm și o limită
-- de dimensiune per fișier.
-- ============================================================

update storage.buckets
set
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'],
  file_size_limit    = 10485760  -- 10 MB / fișier
where id = 'resources';

-- Verificare:
--   select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'resources';
