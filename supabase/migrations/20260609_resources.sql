-- ============================================================
-- RESURSE — bibliotecă de fișiere reutilizabile (PDF/JPG/PNG)
-- Fișierele NU se trimit ca atașamente; se inserează în email ca
-- linkuri securizate cu token, servite prin redirect către un
-- signed URL cu TTL scurt (egress minim, bucket privat).
--
-- Conține: bucket Storage privat + politici, tabel `resources`,
-- tabel `resource_links` (tracking accesare), RLS, indexuri.
-- ============================================================

-- ── 1) BUCKET STORAGE (privat) ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- ── 2) TABEL RESURSE ─────────────────────────────────────────
create table if not exists public.resources (
  id          uuid        default uuid_generate_v4() primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  file_path   text        not null,   -- resources/{user_id}/{resource_id}/{filename}
  file_type   text        not null,   -- application/pdf | image/jpeg | image/png
  file_size   bigint      not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resources_user_idx on public.resources(user_id, created_at desc);

-- ── 3) TABEL LINKURI (tracking accesare) ─────────────────────
create table if not exists public.resource_links (
  id           uuid        default uuid_generate_v4() primary key,
  resource_id  uuid        not null references public.resources(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  contact_id   uuid        references public.contacts(id) on delete set null,
  offer_id     uuid        references public.offers(id) on delete set null,
  email_id     uuid,       -- rezervat pentru viitor (nu avem tabel emails încă)
  token        text        not null unique,
  clicked_at   timestamptz,
  click_count  integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists resource_links_resource_idx on public.resource_links(resource_id);
create index if not exists resource_links_token_idx    on public.resource_links(token);
create index if not exists resource_links_user_idx     on public.resource_links(user_id, created_at desc);

-- ── 4) RLS pe tabele ─────────────────────────────────────────
alter table public.resources      enable row level security;
alter table public.resource_links enable row level security;

-- resources: fiecare user vede/gestionează doar resursele lui
drop policy if exists "Resources are owner-only" on public.resources;
create policy "Resources are owner-only"
  on public.resources for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- resource_links: owner-only la nivel de aplicație.
-- Accesarea publică prin /r/{token} se face cu service_role în Edge Function.
drop policy if exists "Resource links are owner-only" on public.resource_links;
create policy "Resource links are owner-only"
  on public.resource_links for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 5) POLITICI STORAGE (izolare pe user_id în primul folder) ─
-- Path: {user_id}/{resource_id}/{filename}  →  foldername[1] = user_id
drop policy if exists "Resource files: owner can read"   on storage.objects;
drop policy if exists "Resource files: owner can insert" on storage.objects;
drop policy if exists "Resource files: owner can update" on storage.objects;
drop policy if exists "Resource files: owner can delete" on storage.objects;

create policy "Resource files: owner can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Resource files: owner can insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Resource files: owner can update"
  on storage.objects for update to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Resource files: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 6) RPC: marchează accesarea unui link (apelat din Edge Fn) ─
-- SECURITY DEFINER, grant doar pe service_role.
create or replace function public.touch_resource_link(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.resource_links
  set clicked_at = coalesce(clicked_at, now()),
      click_count = click_count + 1
  where token = p_token;
$$;

revoke all on function public.touch_resource_link(text) from public, authenticated, anon;
grant execute on function public.touch_resource_link(text) to service_role;
