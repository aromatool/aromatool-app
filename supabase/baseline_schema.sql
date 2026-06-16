


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_get_trial_days"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return public.trial_days();
end;
$$;


ALTER FUNCTION "public"."admin_get_trial_days"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_overview"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result json;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  select json_build_object(
    'total_users',    (select count(*) from public.profiles),
    'total_contacts', (select count(*) from public.contacts),
    'total_offers',   (select count(*) from public.offers),
    'new_feedback',   (select count(*) from public.feedback where status = 'new'),
    -- Utilizatori care s-au logat în ultimele 7 zile.
    'active_7d',      (select count(*) from auth.users
                         where last_sign_in_at > now() - interval '7 days'),
    -- Emailuri Daily Focus trimise azi (după data serverului).
    'emails_today',   (select coalesce(sum(emails_sent), 0)
                         from public.daily_focus_jobs
                         where run_at >= date_trunc('day', now()))
  ) into result;
  return result;
end;
$$;


ALTER FUNCTION "public"."admin_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_trial_days"("p_days" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_days is null or p_days < 0 or p_days > 365 then
    raise exception 'Număr de zile invalid (0–365).';
  end if;
  insert into public.app_config (key, value, updated_at)
  values ('trial_days', p_days::text, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();
  return p_days;
end;
$$;


ALTER FUNCTION "public"."admin_set_trial_days"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.profiles
    set free_access = coalesce(p_value, false)
    where id = p_user;
  return coalesce(p_value, false);
end;
$$;


ALTER FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_days is null or p_days < 0 or p_days > 3650 then
    raise exception 'Număr de zile invalid (0–3650).';
  end if;
  v_end := now() + make_interval(days => p_days);
  update public.profiles set trial_ends_at = v_end where id = p_user;
  return v_end;
end;
$$;


ALTER FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_users"() RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "subscription_plan" "text", "subscription_status" "text", "trial_ends_at" timestamp with time zone, "free_access" boolean, "is_admin" boolean, "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "contacts_count" bigint, "offers_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select
      p.id,
      u.email::text,
      p.full_name,
      p.subscription_plan,
      p.subscription_status,
      p.trial_ends_at,
      p.free_access,
      p.is_admin,
      p.created_at,
      u.last_sign_in_at,
      (select count(*) from public.contacts c where c.user_id = p.id),
      (select count(*) from public.offers o where o.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;


ALTER FUNCTION "public"."admin_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_resource_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_resource_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_profile_privileged_cols"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Self-update al unui user ne-admin: blochează schimbarea coloanelor sensibile.
  if auth.uid() is not null
     and auth.uid() = new.id
     and not public.is_admin()
  then
    new.is_admin            := old.is_admin;
    new.free_access         := old.free_access;
    new.subscription_status := old.subscription_status;
    new.subscription_plan   := old.subscription_plan;
    new.trial_ends_at       := old.trial_ends_at;
    new.stripe_customer_id  := old.stripe_customer_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_profile_privileged_cols"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, contact_email, company_id)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    (select id from public.companies where slug = 'young-living' limit 1)
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_company_products"("p_company" "uuid", "p_country" "text" DEFAULT 'RO'::"text", "p_items" "jsonb" DEFAULT '[]'::"jsonb", "p_currency" "text" DEFAULT 'EUR'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_imported    integer := 0;
  v_deactivated integer := 0;
  v_currency    text := coalesce(nullif(trim(p_currency), ''), 'EUR');
begin
  if p_company is null then
    raise exception 'p_company este obligatoriu';
  end if;

  with incoming as (
    select
      nullif(trim(x.name), '') as name,
      trim(x.sku)              as sku,
      coalesce(x.points, 0)    as points,
      coalesce(x.price_eur, 0) as price_eur
    from jsonb_to_recordset(p_items)
      as x(name text, sku text, points numeric, price_eur numeric)
    where x.sku is not null and trim(x.sku) <> ''
  ),
  upserted as (
    insert into public.products
      (company_id, country_code, name, sku, points, price_eur, currency, active, updated_at)
    select p_company, p_country, name, sku, points, price_eur, v_currency, true, now()
    from incoming
    where name is not null
    on conflict (company_id, country_code, sku)
    do update set
      name      = excluded.name,
      points    = excluded.points,
      price_eur = excluded.price_eur,
      currency  = excluded.currency,
      active    = true,
      updated_at = now()
    returning 1
  )
  select count(*) into v_imported from upserted;

  -- Dezactivează produsele companiei care nu mai apar în feed
  update public.products p
  set active = false, updated_at = now()
  where p.company_id = p_company
    and p.country_code = p_country
    and p.active = true
    and not exists (
      select 1
      from jsonb_to_recordset(p_items) as x(sku text)
      where trim(x.sku) = p.sku
    );
  get diagnostics v_deactivated = row_count;

  return jsonb_build_object('imported', v_imported, 'deactivated', v_deactivated);
end;
$$;


ALTER FUNCTION "public"."import_company_products"("p_company" "uuid", "p_country" "text", "p_items" "jsonb", "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


-- has_active_access(): gate-ul de abonament folosit în politicile RLS de
-- scriere (INSERT/UPDATE) pe contacts/offers/followup_log/resources/
-- template_resources/followup_templates. Replică computeHasAccess() din
-- send-email/index.ts. Vezi migrația 20260713.
CREATE OR REPLACE FUNCTION "public"."has_active_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select
      p.is_admin
      or p.free_access
      or p.subscription_status = 'active'
      or (p.trial_ends_at is not null and p.trial_ends_at > now())
    from public.profiles p
    where p.id = auth.uid()
  ), false)
$$;


ALTER FUNCTION "public"."has_active_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_product_countries"() RETURNS TABLE("country_code" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select distinct p.country_code
  from public.products p
  where p.active = true
    and p.company_id = (
      select company_id from public.profiles where id = auth.uid()
    )
  order by p.country_code;
$$;


ALTER FUNCTION "public"."list_product_countries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_old_email_logs"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.followup_log
  where sent_at is not null
    and sent_at < now() - interval '12 months';
$$;


ALTER FUNCTION "public"."purge_old_email_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resource_quota_bytes"("p_plan" "text") RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case coalesce(p_plan, 'trial')
    when 'business' then 10::bigint * 1024 * 1024 * 1024  -- 10 GB
    when 'team'     then 5::bigint  * 1024 * 1024 * 1024  -- 5 GB
    when 'growth'   then 2::bigint  * 1024 * 1024 * 1024  -- 2 GB
    when 'starter'  then 500::bigint * 1024 * 1024         -- 500 MB
    else                 50::bigint  * 1024 * 1024         -- 50 MB (trial/default)
  end;
$$;


ALTER FUNCTION "public"."resource_quota_bytes"("p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_signup_country"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Doar dacă signup-ul a trimis explicit o țară.
  if new.raw_user_meta_data ? 'country_code'
     and coalesce(new.raw_user_meta_data->>'country_code', '') <> '' then
    update public.profiles
       set country_code = new.raw_user_meta_data->>'country_code'
     where id = new.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_signup_country"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."storage_object_size"("p_path" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'storage'
    AS $$
  select (metadata->>'size')::bigint
  from storage.objects
  where bucket_id = 'resources' and name = p_path
  limit 1;
$$;


ALTER FUNCTION "public"."storage_object_size"("p_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_resource_size_and_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sync_resource_size_and_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_resource_link"("p_token" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.resource_links
  set clicked_at = coalesce(clicked_at, now()),
      click_count = click_count + 1
  where token = p_token;
$$;


ALTER FUNCTION "public"."touch_resource_link"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trial_days"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    nullif((select value from public.app_config where key = 'trial_days'), '')::int,
    14
  )
$$;


ALTER FUNCTION "public"."trial_days"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "phone" "text",
    "status" "text" DEFAULT 'prospect'::"text",
    "notes" "text",
    "conditions_json" "jsonb",
    "unsubscribed" boolean DEFAULT false,
    "unsubscribed_at" timestamp with time zone,
    "first_offer_at" timestamp with time zone,
    "last_purchase_at" timestamp with time zone,
    "purchase_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "followup_count" integer DEFAULT 0,
    "followup_opted_out" boolean DEFAULT false,
    "manual_high_interest" boolean DEFAULT false,
    "manual_business_interest" boolean DEFAULT false,
    "source" "text",
    "email_opt_out" boolean DEFAULT false,
    "email_opt_out_at" timestamp with time zone,
    "communication_blocked" boolean DEFAULT false,
    "communication_blocked_at" timestamp with time zone,
    "communication_blocked_reason" "text",
    "email_opens" integer DEFAULT 0,
    "email_clicks" integer DEFAULT 0,
    "language_code" "text" DEFAULT 'ro'::"text",
    CONSTRAINT "contacts_status_check" CHECK (("status" = ANY (ARRAY['prospect'::"text", 'in_followup'::"text", 'client_nou'::"text", 'client_fidel'::"text", 'team_member'::"text", 'inactiv'::"text"])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_focus_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trigger" "text" DEFAULT 'cron'::"text" NOT NULL,
    "users_processed" integer DEFAULT 0 NOT NULL,
    "emails_sent" integer DEFAULT 0 NOT NULL,
    "emails_failed" integer DEFAULT 0 NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "daily_focus_jobs_trigger_check" CHECK (("trigger" = ANY (ARRAY['cron'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."daily_focus_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_send_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "from_currency" "text" NOT NULL,
    "to_currency" "text" NOT NULL,
    "rate" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "type" "text" DEFAULT 'sugestie'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "page" "text",
    "user_email" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'planned'::"text", 'done'::"text"]))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['sugestie'::"text", 'problema'::"text", 'altele'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "contact_id" "uuid",
    "template_id" "uuid",
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "followup_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'whatsapp_initiated'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."followup_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "plan_required" "text" DEFAULT 'growth'::"text",
    "trigger_status" "text" NOT NULL,
    "trigger_day" integer NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "language_code" "text" DEFAULT 'ro'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "trigger_action" "text",
    "title" "text",
    "system_key" "text"
);


ALTER TABLE "public"."followup_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guides" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_sku" "text" NOT NULL,
    "company_id" "uuid",
    "language_code" "text" DEFAULT 'ro'::"text" NOT NULL,
    "benefits" "text",
    "usage_instructions" "text",
    "precautions" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "contact_id" "uuid",
    "products_json" "jsonb" NOT NULL,
    "transport" numeric DEFAULT 0,
    "notes" "text",
    "total_display" numeric,
    "total_eur" numeric,
    "exchange_rate" numeric,
    "sent_via" "text" DEFAULT 'email'::"text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "currency" "text" DEFAULT 'RON'::"text",
    "base_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    CONSTRAINT "offers_sent_via_check" CHECK (("sent_via" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "triggered_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source_url" "text",
    "country_code" "text" DEFAULT 'RO'::"text" NOT NULL,
    "records_total" integer,
    "records_imported" integer,
    "records_failed" integer,
    "error_log" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "product_import_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."product_import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "country_code" "text" DEFAULT 'RO'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "points" numeric DEFAULT 0,
    "price_eur" numeric DEFAULT 0 NOT NULL,
    "price_ron" numeric DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid",
    "country_code" "text" DEFAULT 'RO'::"text",
    "language_code" "text" DEFAULT 'ro'::"text",
    "full_name" "text",
    "phone" "text",
    "contact_email" "text",
    "subscription_plan" "text" DEFAULT 'trial'::"text",
    "subscription_status" "text",
    "trial_ends_at" timestamp with time zone DEFAULT ("now"() + "make_interval"("days" => "public"."trial_days"())),
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "follow_up_days" integer DEFAULT 5,
    "max_followups" integer DEFAULT 3,
    "followup_enabled" boolean DEFAULT true,
    "is_admin" boolean DEFAULT false,
    "email_signature" "text",
    "daily_focus_enabled" boolean DEFAULT false NOT NULL,
    "daily_focus_hour" integer DEFAULT 8 NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Bucharest'::"text" NOT NULL,
    "daily_focus_last_sent" "date",
    "free_access" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_daily_focus_hour_check" CHECK ((("daily_focus_hour" >= 5) AND ("daily_focus_hour" <= 12))),
    CONSTRAINT "profiles_subscription_plan_check" CHECK (("subscription_plan" = ANY (ARRAY['trial'::"text", 'starter'::"text", 'growth'::"text", 'team'::"text", 'business'::"text"]))),
    CONSTRAINT "profiles_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'past_due'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protocols" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "category" "text",
    "language_code" "text" DEFAULT 'ro'::"text" NOT NULL,
    "products_json" "jsonb",
    "instructions" "text",
    "precautions" "text",
    "status" "text" DEFAULT 'private'::"text" NOT NULL,
    "created_by" "uuid",
    "is_anonymous" boolean DEFAULT false,
    "rejection_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "protocols_status_check" CHECK (("status" = ANY (ARRAY['private'::"text", 'pending_review'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."protocols" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "offer_id" "uuid",
    "email_id" "uuid",
    "token" "text" NOT NULL,
    "clicked_at" timestamp with time zone,
    "click_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resource_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_resources" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."template_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "contact_id" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."webhook_log" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_email_key" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."daily_focus_jobs"
    ADD CONSTRAINT "daily_focus_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_from_currency_to_currency_key" UNIQUE ("from_currency", "to_currency");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_log"
    ADD CONSTRAINT "followup_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_templates"
    ADD CONSTRAINT "followup_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_import_jobs"
    ADD CONSTRAINT "product_import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_resources"
    ADD CONSTRAINT "template_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_resources"
    ADD CONSTRAINT "template_resources_template_id_resource_id_key" UNIQUE ("template_id", "resource_id");



ALTER TABLE ONLY "public"."webhook_log"
    ADD CONSTRAINT "webhook_log_pkey" PRIMARY KEY ("id");



CREATE INDEX "contacts_status_idx" ON "public"."contacts" USING "btree" ("status");



CREATE INDEX "contacts_user_blocked_idx" ON "public"."contacts" USING "btree" ("user_id", "communication_blocked") WHERE ("communication_blocked" = true);



CREATE INDEX "contacts_user_created_idx" ON "public"."contacts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "contacts_user_id_idx" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "contacts_user_status_idx" ON "public"."contacts" USING "btree" ("user_id", "status");



CREATE INDEX "daily_focus_jobs_run_idx" ON "public"."daily_focus_jobs" USING "btree" ("run_at" DESC);



CREATE INDEX "email_send_log_user_time_idx" ON "public"."email_send_log" USING "btree" ("user_id", "sent_at" DESC);



CREATE UNIQUE INDEX "exchange_rates_pair_uidx" ON "public"."exchange_rates" USING "btree" ("from_currency", "to_currency");



CREATE INDEX "feedback_status_idx" ON "public"."feedback" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "followup_log_contact_idx" ON "public"."followup_log" USING "btree" ("contact_id", "sent_at" DESC);



CREATE INDEX "followup_templates_action_idx" ON "public"."followup_templates" USING "btree" ("trigger_action");



CREATE UNIQUE INDEX "followup_templates_system_key_lang_idx" ON "public"."followup_templates" USING "btree" ("system_key", "language_code") WHERE ("system_key" IS NOT NULL);



CREATE INDEX "followup_templates_user_id_idx" ON "public"."followup_templates" USING "btree" ("user_id");



CREATE INDEX "followup_templates_user_idx" ON "public"."followup_templates" USING "btree" ("user_id");



CREATE INDEX "guides_product_sku_company_id_idx" ON "public"."guides" USING "btree" ("product_sku", "company_id");



CREATE INDEX "offers_contact_id_idx" ON "public"."offers" USING "btree" ("contact_id");



CREATE INDEX "offers_user_contact_sent_idx" ON "public"."offers" USING "btree" ("user_id", "contact_id", "sent_at" DESC);



CREATE INDEX "offers_user_id_idx" ON "public"."offers" USING "btree" ("user_id");



CREATE INDEX "product_import_jobs_created_idx" ON "public"."product_import_jobs" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "products_company_country_sku_uniq" ON "public"."products" USING "btree" ("company_id", "country_code", "sku");



CREATE INDEX "products_company_id_country_code_idx" ON "public"."products" USING "btree" ("company_id", "country_code");



CREATE INDEX "products_name_idx" ON "public"."products" USING "btree" ("name");



CREATE INDEX "resource_links_resource_idx" ON "public"."resource_links" USING "btree" ("resource_id");



CREATE INDEX "resource_links_token_idx" ON "public"."resource_links" USING "btree" ("token");



CREATE INDEX "resource_links_user_idx" ON "public"."resource_links" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "resources_user_idx" ON "public"."resources" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "template_resources_template_idx" ON "public"."template_resources" USING "btree" ("template_id");



CREATE INDEX "template_resources_user_idx" ON "public"."template_resources" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_enforce_resource_quota" BEFORE INSERT ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_resource_quota"();



CREATE OR REPLACE TRIGGER "trg_guard_profile_privileged_cols" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_privileged_cols"();



CREATE OR REPLACE TRIGGER "trg_sync_resource_size_quota" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."sync_resource_size_and_quota"();



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."followup_log"
    ADD CONSTRAINT "followup_log_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_log"
    ADD CONSTRAINT "followup_log_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."followup_templates"("id");



ALTER TABLE ONLY "public"."followup_log"
    ADD CONSTRAINT "followup_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_templates"
    ADD CONSTRAINT "followup_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."followup_templates"
    ADD CONSTRAINT "followup_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_import_jobs"
    ADD CONSTRAINT "product_import_jobs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_resources"
    ADD CONSTRAINT "template_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_resources"
    ADD CONSTRAINT "template_resources_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."followup_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_resources"
    ADD CONSTRAINT "template_resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_log"
    ADD CONSTRAINT "webhook_log_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



CREATE POLICY "Admin updates feedback" ON "public"."feedback" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin views daily focus jobs" ON "public"."daily_focus_jobs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Approved protocols viewable by authenticated users" ON "public"."protocols" FOR SELECT TO "authenticated" USING ((("status" = 'approved'::"text") OR ("created_by" = "auth"."uid"())));



CREATE POLICY "Companies viewable by authenticated users" ON "public"."companies" FOR SELECT TO "authenticated" USING (("active" = true));



-- NOTĂ: politicile permisive "Exchange rates viewable by all", "Products
-- viewable by all" și "Guides viewable by authenticated users" (USING true)
-- au fost ELIMINATE de migrația 20260630 (expuneau catalogul/ghidurile
-- cross-company, inclusiv anon). Rămân doar variantele scoped pe companie.



CREATE POLICY "Guides viewable by company members" ON "public"."guides" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Products viewable by company members" ON "public"."products" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Resource links are owner-only" ON "public"."resource_links" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



-- resources / template_resources: SELECT+DELETE deschise pe owner; INSERT+UPDATE
-- cu gate de abonament (has_active_access) — vezi migrația 20260713.
CREATE POLICY "Resources: select own" ON "public"."resources" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Resources: delete own" ON "public"."resources" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Resources: insert own with access" ON "public"."resources" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Resources: update own with access" ON "public"."resources" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



CREATE POLICY "Template resources: select own" ON "public"."template_resources" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Template resources: delete own" ON "public"."template_resources" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Template resources: insert own with access" ON "public"."template_resources" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Template resources: update own with access" ON "public"."template_resources" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



CREATE POLICY "Users can create protocols" ON "public"."protocols" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



-- contacts: SELECT+DELETE deschise pe owner; INSERT+UPDATE cu gate de
-- abonament (has_active_access) — vezi migrația 20260713.
CREATE POLICY "Contacts: select own" ON "public"."contacts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Contacts: delete own" ON "public"."contacts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Contacts: insert own with access" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Contacts: update own with access" ON "public"."contacts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



CREATE POLICY "Users can manage own import jobs" ON "public"."product_import_jobs" TO "authenticated" USING (("triggered_by" = "auth"."uid"())) WITH CHECK (("triggered_by" = "auth"."uid"()));



-- offers: SELECT+DELETE deschise pe owner; INSERT+UPDATE cu gate de
-- abonament (has_active_access) — vezi migrația 20260713.
CREATE POLICY "Offers: select own" ON "public"."offers" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Offers: delete own" ON "public"."offers" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Offers: insert own with access" ON "public"."offers" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Offers: update own with access" ON "public"."offers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



-- followup_templates: citire = proprii + sistem (user_id IS NULL); scrierea
-- doar pe cele proprii. INSERT+UPDATE cu gate de abonament. Template-urile de
-- sistem sunt read-only (vezi migrațiile 20260630 + 20260713).
CREATE POLICY "Templates: read own or system" ON "public"."followup_templates" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));
CREATE POLICY "Templates: delete own" ON "public"."followup_templates" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Templates: insert own with access" ON "public"."followup_templates" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Templates: update own with access" ON "public"."followup_templates" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



-- followup_log: SELECT+DELETE deschise pe owner; INSERT+UPDATE cu gate de
-- abonament (has_active_access) — vezi migrația 20260713.
CREATE POLICY "Followup log: select own" ON "public"."followup_log" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Followup log: delete own" ON "public"."followup_log" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Followup log: insert own with access" ON "public"."followup_log" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));
CREATE POLICY "Followup log: update own with access" ON "public"."followup_log" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."has_active_access"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users insert own feedback" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "View own feedback or admin" ON "public"."feedback" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_focus_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exchange_rates_select" ON "public"."exchange_rates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protocols" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_log" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "public"."admin_get_trial_days"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_trial_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_trial_days"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_trial_days"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_overview"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_overview"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_overview"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_trial_days"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_trial_days"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_trial_days"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_trial_days"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_user_free_access"("p_user" "uuid", "p_value" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_user_trial"("p_user" "uuid", "p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_resource_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_resource_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_resource_quota"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_profile_privileged_cols"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_profile_privileged_cols"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_privileged_cols"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_company_products"("p_company" "uuid", "p_country" "text", "p_items" "jsonb", "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_company_products"("p_company" "uuid", "p_country" "text", "p_items" "jsonb", "p_currency" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_product_countries"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_product_countries"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_product_countries"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_old_email_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_old_email_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_old_email_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resource_quota_bytes"("p_plan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resource_quota_bytes"("p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resource_quota_bytes"("p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_signup_country"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_signup_country"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_signup_country"() TO "service_role";



GRANT ALL ON FUNCTION "public"."storage_object_size"("p_path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."storage_object_size"("p_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."storage_object_size"("p_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_resource_size_and_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_resource_size_and_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_resource_size_and_quota"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_resource_link"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_resource_link"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trial_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."trial_days"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trial_days"() TO "service_role";
























GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."daily_focus_jobs" TO "anon";
GRANT ALL ON TABLE "public"."daily_focus_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_focus_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_log" TO "anon";
GRANT ALL ON TABLE "public"."email_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."followup_log" TO "anon";
GRANT ALL ON TABLE "public"."followup_log" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_log" TO "service_role";



GRANT ALL ON TABLE "public"."followup_templates" TO "anon";
GRANT ALL ON TABLE "public"."followup_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_templates" TO "service_role";



GRANT ALL ON TABLE "public"."guides" TO "anon";
GRANT ALL ON TABLE "public"."guides" TO "authenticated";
GRANT ALL ON TABLE "public"."guides" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."product_import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."product_import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."protocols" TO "anon";
GRANT ALL ON TABLE "public"."protocols" TO "authenticated";
GRANT ALL ON TABLE "public"."protocols" TO "service_role";



GRANT ALL ON TABLE "public"."resource_links" TO "anon";
GRANT ALL ON TABLE "public"."resource_links" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_links" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON TABLE "public"."template_resources" TO "anon";
GRANT ALL ON TABLE "public"."template_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."template_resources" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_log" TO "anon";
GRANT ALL ON TABLE "public"."webhook_log" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_log" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































