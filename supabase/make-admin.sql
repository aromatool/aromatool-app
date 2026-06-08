-- Promovează un utilizator la admin (setează profiles.is_admin = true).
-- Rulează în Supabase → SQL Editor. Înlocuiește emailul cu cel al contului tău.

update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and u.email = 'arabuucj@gmail.com';

-- ── Verificare ───────────────────────────────────────────────────────
-- select u.email, p.is_admin
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where u.email = 'arabuucj@gmail.com';
--
-- Dacă update-ul returnează „0 rows": emailul nu se potrivește exact
-- (vezi: select email from auth.users;) sau nu există încă rând în profiles.
-- După succes: refresh / re-login în aplicație → apare secțiunea Admin în Settings.
