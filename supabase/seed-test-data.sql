-- ============================================================
-- SEED date de test — 15 contacte, un caz de fiecare
-- Acoperă toate statusurile + cazurile-limită de comunicare,
-- cu oferte și loguri de follow-up aferente.
--
-- ⚠️ Rulează DUPĂ:
--   1) supabase/reset-all.sql
--   2) importul de produse (butonul Admin sau seed-products.mjs)
--      — ofertele iau produse reale din catalog.
--
-- Rulează în Supabase → SQL Editor. Înlocuiește emailul dacă e cazul.
-- ============================================================

do $$
declare
  me_email text := 'arabuucj@gmail.com';
  me uuid;
  prod jsonb;
  my_company uuid;
  rate numeric := 5.0523;  -- EUR→RON exemplu
  -- id-uri contacte
  c_prospect      uuid;
  c_prospect_off  uuid;
  c_followup1     uuid;
  c_followup2     uuid;
  c_client_nou    uuid;
  c_client_fidel  uuid;
  c_team          uuid;
  c_inactiv       uuid;
  c_noemail       uuid;
  c_unsub         uuid;
  c_optout        uuid;
  c_blocked       uuid;
  c_fu_optout     uuid;
  c_high_interest uuid;
  c_engaged       uuid;
begin
  select id into me from auth.users where email = me_email;
  if me is null then
    raise exception 'Contul % nu există.', me_email;
  end if;

  -- Compania userului (catalogul e scoped pe companie)
  select company_id into my_company from public.profiles where id = me;
  if my_company is null then
    raise exception 'Profilul nu are company_id setat.';
  end if;

  -- Eșantion de 3 produse reale din catalogul companiei (pentru products_json)
  select coalesce(jsonb_agg(
           jsonb_build_object('name', name, 'sku', sku, 'qty', 1, 'disc', 0, 'price_eur', price_eur)
         ), '[]'::jsonb)
  into prod
  from (
    select name, sku, price_eur
    from public.products
    where active = true and company_id = my_company
    order by price_eur desc
    limit 3
  ) p;

  if jsonb_array_length(prod) = 0 then
    raise exception 'Nu există produse în catalog. Rulează întâi importul.';
  end if;

  -- ── CONTACTE ───────────────────────────────────────────────
  insert into public.contacts (user_id,email,name,phone,source,status,notes,created_at) values
    (me,'ana.prospect@example.com','Ana Ionescu','0722000001','Instagram','prospect','Lead nou de pe Instagram, interesată de ulei pt. somn', now()-interval '2 days')
    returning id into c_prospect;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,created_at) values
    (me,'bogdan.oferta@example.com','Bogdan Pop','0722000002','Facebook','prospect','A primit o ofertă, încă nu a răspuns', now()-interval '4 days', now()-interval '10 days')
    returning id into c_prospect_off;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,followup_count,created_at) values
    (me,'cristina.fu1@example.com','Cristina Marin','0722000003','Recomandare','in_followup','Follow-up 1 trimis', now()-interval '8 days', 1, now()-interval '12 days')
    returning id into c_followup1;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,followup_count,created_at) values
    (me,'dan.fu2@example.com','Dan Georgescu','0722000004','Eveniment','in_followup','Follow-up 2 trimis, încă decide', now()-interval '15 days', 2, now()-interval '20 days')
    returning id into c_followup2;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,last_purchase_at,purchase_count,created_at) values
    (me,'elena.nou@example.com','Elena Dumitru','0722000005','Instagram','client_nou','Prima comandă plasată', now()-interval '20 days', now()-interval '3 days', 1, now()-interval '25 days')
    returning id into c_client_nou;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,last_purchase_at,purchase_count,created_at) values
    (me,'florin.fidel@example.com','Florin Stan','0722000006','Recomandare','client_fidel','Cumpără lunar, foarte mulțumit', now()-interval '120 days', now()-interval '5 days', 6, now()-interval '130 days')
    returning id into c_client_fidel;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,last_purchase_at,purchase_count,manual_business_interest,created_at) values
    (me,'gabriela.team@example.com','Gabriela Lung','0722000007','Recomandare','team_member','Înscrisă în echipă, construiește business', now()-interval '7 days', 4, true, now()-interval '90 days')
    returning id into c_team;

  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,created_at) values
    (me,'horia.inactiv@example.com','Horia Vasile','0722000008','Facebook','inactiv','Nu a mai răspuns de luni de zile', now()-interval '200 days', now()-interval '210 days')
    returning id into c_inactiv;

  -- Contact fără email (placeholder @noemail.local)
  insert into public.contacts (user_id,email,name,phone,source,status,notes,created_at) values
    (me, extract(epoch from now())::bigint || '@noemail.local','Ioana (doar telefon)','0722000009','Târg','prospect','Nu are email, doar telefon', now()-interval '1 day')
    returning id into c_noemail;

  -- Dezabonat
  insert into public.contacts (user_id,email,name,phone,source,status,notes,unsubscribed,unsubscribed_at,created_at) values
    (me,'jana.unsub@example.com','Jana Radu','0722000010','Instagram','prospect','S-a dezabonat din email', true, now()-interval '6 days', now()-interval '30 days')
    returning id into c_unsub;

  -- Email opt-out
  insert into public.contacts (user_id,email,name,phone,source,status,notes,email_opt_out,email_opt_out_at,created_at) values
    (me,'karina.optout@example.com','Karina Toma','0722000011','Facebook','client_nou','A cerut să nu mai primească emailuri', true, now()-interval '3 days', now()-interval '40 days')
    returning id into c_optout;

  -- Comunicare blocată
  insert into public.contacts (user_id,email,name,phone,source,status,notes,communication_blocked,communication_blocked_at,communication_blocked_reason,created_at) values
    (me,'lucian.blocked@example.com','Lucian Barbu','0722000012','Recomandare','inactiv','Blocat — a reclamat spam', true, now()-interval '2 days','complaint', now()-interval '50 days')
    returning id into c_blocked;

  -- Ieșit din follow-up (opted out)
  insert into public.contacts (user_id,email,name,phone,source,status,notes,followup_opted_out,followup_count,created_at) values
    (me,'maria.fuoptout@example.com','Maria Neagu','0722000013','Instagram','in_followup','A cerut oprirea follow-up-urilor', true, 1, now()-interval '18 days')
    returning id into c_fu_optout;

  -- High interest + business interest (marcaj manual)
  insert into public.contacts (user_id,email,name,phone,source,status,notes,manual_high_interest,manual_business_interest,created_at) values
    (me,'nicu.interes@example.com','Nicu Albu','0722000014','Eveniment','prospect','Foarte interesat, posibil partener de business', true, true, now()-interval '5 days')
    returning id into c_high_interest;

  -- Engaged — deschideri & click-uri email
  insert into public.contacts (user_id,email,name,phone,source,status,notes,first_offer_at,email_opens,email_clicks,created_at) values
    (me,'oana.engaged@example.com','Oana Sava','0722000015','Instagram','prospect','Deschide și dă click pe emailuri', now()-interval '3 days', 7, 3, now()-interval '14 days')
    returning id into c_engaged;

  -- ── OFERTE ─────────────────────────────────────────────────
  -- prospect cu ofertă (RON)
  insert into public.offers (user_id,contact_id,products_json,transport,notes,total_display,total_eur,exchange_rate,currency,sent_via,sent_at)
  values (me,c_prospect_off,prod,5,'Ofertă inițială',round(122.20*rate,2),122.20,rate,'RON','email', now()-interval '4 days');

  -- in_followup 1
  insert into public.offers (user_id,contact_id,products_json,transport,total_display,total_eur,exchange_rate,currency,sent_via,sent_at)
  values (me,c_followup1,prod,0,round(98.50*rate,2),98.50,rate,'RON','email', now()-interval '8 days');

  -- client_nou (cumpărat)
  insert into public.offers (user_id,contact_id,products_json,transport,total_display,total_eur,exchange_rate,currency,sent_via,sent_at)
  values (me,c_client_nou,prod,5,round(150.00*rate,2),150.00,rate,'RON','email', now()-interval '20 days');

  -- client_fidel — 2 oferte (istoric)
  insert into public.offers (user_id,contact_id,products_json,transport,total_display,total_eur,exchange_rate,currency,sent_via,sent_at)
  values
    (me,c_client_fidel,prod,0,210.00,210.00,1,'EUR','email', now()-interval '60 days'),
    (me,c_client_fidel,prod,5,round(185.00*rate,2),185.00,rate,'RON','both', now()-interval '5 days');

  -- engaged
  insert into public.offers (user_id,contact_id,products_json,transport,total_display,total_eur,exchange_rate,currency,sent_via,sent_at)
  values (me,c_engaged,prod,0,round(75.00*rate,2),75.00,rate,'RON','email', now()-interval '3 days');

  -- ── FOLLOWUP LOG ───────────────────────────────────────────
  -- followup1: unul trimis + unul pending
  insert into public.followup_log (user_id,contact_id,scheduled_at,sent_at,status)
  values
    (me,c_followup1, now()-interval '3 days', now()-interval '3 days','sent'),
    (me,c_followup1, now()+interval '2 days', null,'pending');

  -- followup2: două trimise
  insert into public.followup_log (user_id,contact_id,scheduled_at,sent_at,status)
  values
    (me,c_followup2, now()-interval '10 days', now()-interval '10 days','sent'),
    (me,c_followup2, now()-interval '5 days',  now()-interval '5 days','sent');

  -- fu_optout: unul skipped
  insert into public.followup_log (user_id,contact_id,scheduled_at,sent_at,status)
  values (me,c_fu_optout, now()-interval '2 days', null,'skipped');

  raise notice 'Seed gata: 15 contacte, 6 oferte, 5 loguri follow-up pentru %', me_email;
end $$;
