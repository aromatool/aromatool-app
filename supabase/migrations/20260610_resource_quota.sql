-- ============================================================
-- ENFORCEMENT QUOTĂ STORAGE (server-side)
-- Plafonul din client (useResources.ts) e doar UX. Aici garantăm
-- pe server că un user nu poate depăși quota planului — protecție
-- reală împotriva costurilor necontrolate.
--
-- ⚠️ Valorile trebuie ținute în sync cu QUOTA_BY_PLAN din
--    src/hooks/useResources.ts
-- ============================================================

-- ── Quota în bytes per plan ──────────────────────────────────
create or replace function public.resource_quota_bytes(p_plan text)
returns bigint
language sql
immutable
as $$
  select case coalesce(p_plan, 'trial')
    when 'business' then 10::bigint * 1024 * 1024 * 1024  -- 10 GB
    when 'team'     then 5::bigint  * 1024 * 1024 * 1024  -- 5 GB
    when 'growth'   then 2::bigint  * 1024 * 1024 * 1024  -- 2 GB
    when 'starter'  then 500::bigint * 1024 * 1024         -- 500 MB
    else                 50::bigint  * 1024 * 1024         -- 50 MB (trial/default)
  end;
$$;

-- ── Trigger: respinge insert dacă depășește quota ────────────
create or replace function public.enforce_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_quota bigint;
  v_used  bigint;
begin
  select subscription_plan into v_plan
  from public.profiles where id = new.user_id;

  v_quota := public.resource_quota_bytes(v_plan);

  select coalesce(sum(file_size), 0) into v_used
  from public.resources where user_id = new.user_id;

  if v_used + coalesce(new.file_size, 0) > v_quota then
    raise exception 'STORAGE_QUOTA_EXCEEDED: % + % > %', v_used, new.file_size, v_quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_resource_quota on public.resources;
create trigger trg_enforce_resource_quota
  before insert on public.resources
  for each row execute function public.enforce_resource_quota();
