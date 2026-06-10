-- ============================================================
-- M1: Quota storage pe mărimea REALĂ a fișierului (nu cea trimisă de client)
-- ============================================================
-- Problemă: enforce_resource_quota (BEFORE INSERT) folosea new.file_size,
-- valoare trimisă de client → falsificabilă (insert file_size=0, upload mare).
--
-- Flux real al uploadului (useResources.ts):
--   1) INSERT resources (file_path='', file_size=<declarat>)
--   2) upload în storage la {user}/{id}/{nume}
--   3) UPDATE resources SET file_path=<path>   ← AICI obiectul există deja
--
-- Soluție: la pasul (3) citim mărimea reală din storage.objects.metadata și
-- o scriem în file_size, apoi re-validăm quota pe valori reale. Insert-ul (1)
-- păstrează o verificare ieftină pe valoarea declarată (primă barieră), dar
-- adevărul îl impunem la update. Fiecare fișier e oricum ≤ 10MB (bucket limit).
-- ============================================================

-- Mărimea reală a unui obiect din bucket-ul resources (sau NULL dacă lipsește).
create or replace function public.storage_object_size(p_path text)
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select (metadata->>'size')::bigint
  from storage.objects
  where bucket_id = 'resources' and name = p_path
  limit 1;
$$;

-- Trigger BEFORE UPDATE: când file_path devine ne-gol, sincronizează file_size
-- cu mărimea reală din storage și re-verifică quota planului.
create or replace function public.sync_resource_size_and_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_real  bigint;
  v_plan  text;
  v_quota bigint;
  v_used  bigint;
begin
  -- Rulează doar când se atașează un path nou (insert→upload→update).
  if new.file_path is null or new.file_path = '' then
    return new;
  end if;
  if new.file_path is not distinct from old.file_path then
    return new;
  end if;

  v_real := public.storage_object_size(new.file_path);
  if v_real is not null then
    new.file_size := v_real;  -- adevărul din storage, nu valoarea clientului
  end if;

  select subscription_plan into v_plan from public.profiles where id = new.user_id;
  v_quota := public.resource_quota_bytes(v_plan);

  -- Suma celorlalte resurse ale userului (excludem rândul curent) + mărimea reală.
  select coalesce(sum(file_size), 0) into v_used
  from public.resources
  where user_id = new.user_id and id <> new.id;

  if v_used + coalesce(new.file_size, 0) > v_quota then
    raise exception 'STORAGE_QUOTA_EXCEEDED: % + % > %', v_used, new.file_size, v_quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_resource_size_quota on public.resources;
create trigger trg_sync_resource_size_quota
  before update on public.resources
  for each row execute function public.sync_resource_size_and_quota();
