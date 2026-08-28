-- Business-logic + RLS test suite (bare-Postgres harness OR local Supabase stack)
-- psql -v ON_ERROR_STOP=1 -f business_tests.sql
-- Fixture values are passed into DO blocks via session GUCs (test.*) because
-- psql :variables do not interpolate inside dollar-quoted bodies.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------------------------------------------------------------
-- fixtures: users (2 anonymous clients + 1 admin)
-- ---------------------------------------------------------------
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', null, true),
  ('00000000-0000-0000-0000-00000000000b', null, true),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.local', false);
update public.profiles set role = 'admin', full_name = 'Admin Test'
  where id = '00000000-0000-0000-0000-0000000000ad';

-- variant under test: BMW Série 3 G20 berline_4p (overhead 15)
select set_config('test.variant_id', (
  select vv.id::text
  from public.vehicle_variants vv
  join public.generations g on g.id = vv.generation_id and g.name = 'G20'
), false);

-- next Monday ≥ 7 days out (workshop open 09:00–18:00)
select set_config('test.day', (
  select d::date::text
  from generate_series(current_date + 7, current_date + 20, interval '1 day') d
  where extract(isodow from d) = 1
  limit 1
), false);

-- ---------------------------------------------------------------
-- T1 — quote math (docs 02 §8): berline, rear_sides 20 + rear_window 20
--       15 + 35 + 30 = 80 min → snap 90 · labor 90×0.40 = 36
--       total = 240 + (70+50=120) + 36 + 30 (limo) = 426.00
-- ---------------------------------------------------------------
do $$
declare q jsonb;
begin
  q := public._compute_quote(current_setting('test.variant_id')::uuid,
    '[{"zone_code":"rear_sides","vlt_percent":20},{"zone_code":"rear_window","vlt_percent":20}]');
  if (q->>'duration_min')::int <> 90 then
    raise exception 'T1 duration: got %', q->>'duration_min';
  end if;
  if (q->'breakdown'->>'total')::numeric <> 426.00 then
    raise exception 'T1 total: got %', q->'breakdown'->>'total';
  end if;
  if not (q->>'compliant')::boolean then
    raise exception 'T1 compliant flag wrong';
  end if;
end $$;

-- T2 — front zone below 70 ⇒ non-compliant, no limo at 50%
do $$
declare q jsonb;
begin
  q := public._compute_quote(current_setting('test.variant_id')::uuid,
    '[{"zone_code":"front_sides","vlt_percent":50}]');
  if (q->>'compliant')::boolean then raise exception 'T2 should be non-compliant'; end if;
  if (q->'breakdown'->>'limo_supplement')::numeric <> 0 then raise exception 'T2 limo should be 0'; end if;
  -- 15+30=45 → 60 min · labor 24 · total 240+60+24 = 324
  if (q->'breakdown'->>'total')::numeric <> 324.00 then
    raise exception 'T2 total: got %', q->'breakdown'->>'total';
  end if;
end $$;

-- T3 — duplicate zone rejected
do $$
begin
  begin
    perform public._compute_quote(current_setting('test.variant_id')::uuid,
      '[{"zone_code":"rear_sides","vlt_percent":20},{"zone_code":"rear_sides","vlt_percent":5}]');
    raise exception 'T3 duplicate zones accepted';
  exception when others then
    if sqlerrm <> 'INVALID_SPECS' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------
-- T4 — availability + hold + create_booking as anonymous user A
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.get_available_slots(current_setting('test.day')::date, 90)
    where state = 'available';
  if n < 5 then raise exception 'T4 expected many available slots, got %', n; end if;
end $$;

do $$
declare h jsonb; s timestamptz;
begin
  select slot_start into s from public.get_available_slots(current_setting('test.day')::date, 90)
    where state = 'available' order by slot_start offset 2 limit 1;
  h := public.hold_slot(s, 90, 1);
  if (h->>'hold_id') is null then raise exception 'T4 hold failed'; end if;
end $$;

-- email is REQUIRED (0008): booking without it must be rejected
do $$
declare hid uuid;
begin
  select id into hid from public.booking_holds limit 1;
  begin
    perform public.create_booking(hid, current_setting('test.variant_id')::uuid,
      '[{"zone_code":"rear_window","vlt_percent":35}]',
      'Karim Test', '0612440931', null, null, false, null);
    raise exception 'T4 missing email accepted';
  exception when others then
    if sqlerrm <> 'INVALID_CONTACT' then raise; end if;
  end;
end $$;

-- illegal spec without ack must be rejected
do $$
declare hid uuid;
begin
  select id into hid from public.booking_holds limit 1;  -- own hold via RLS
  begin
    perform public.create_booking(hid, current_setting('test.variant_id')::uuid,
      '[{"zone_code":"front_sides","vlt_percent":50}]',
      'Karim Test', '0612440931', 'karim@test.local', null, false, null);
    raise exception 'T4 illegal spec accepted without ack';
  exception when others then
    if sqlerrm <> 'ILLEGAL_SPEC_REQUIRES_ACK' then raise; end if;
  end;
end $$;

-- legal booking succeeds (hold survived the aborted sub-block above)
do $$
declare hid uuid; b jsonb;
begin
  select id into hid from public.booking_holds limit 1;
  b := public.create_booking(hid, current_setting('test.variant_id')::uuid,
    '[{"zone_code":"rear_sides","vlt_percent":20},{"zone_code":"rear_window","vlt_percent":20}]',
    'Karim Test', '0612440931', 'karim@test.local', 'Le plus sombre possible.', false, null);
  if (b->>'status') <> 'requested' then raise exception 'T4 status %', b->>'status'; end if;
  if (b->>'reference') not like 'TP-%' then raise exception 'T4 reference %', b->>'reference'; end if;
  if (b->>'price_total')::numeric <> 426.00 then raise exception 'T4 price %', b->>'price_total'; end if;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.booking_holds;
  if n <> 0 then raise exception 'T4 hold not consumed'; end if;
  select count(*) into n from public.vehicles where user_id = auth.uid();
  if n <> 1 then raise exception 'T4 vehicle not auto-added to garage: %', n; end if;
end $$;

-- profile is always synced with the booking contact (0008)
do $$
declare p record;
begin
  select full_name, phone, email into p from public.profiles where id = auth.uid();
  if p.full_name <> 'Karim Test' or p.phone <> '0612440931' or p.email <> 'karim@test.local' then
    raise exception 'T4 profile not synced: % % %', p.full_name, p.phone, p.email;
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------
-- T5 — RLS isolation + the booked slot is gone + double-booking impossible
-- ---------------------------------------------------------------
select set_config('test.booking_a', (select id::text from public.bookings limit 1), false);
select set_config('test.booked_start', (select slot_start::text from public.bookings limit 1), false);

select set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.bookings;
  if n <> 0 then raise exception 'T5 RLS leak: B can read A''s booking'; end if;
end $$;

do $$
declare taken int;
begin
  select count(*) into taken from public.get_available_slots(current_setting('test.day')::date, 90)
    where slot_start = current_setting('test.booked_start')::timestamptz and state = 'available';
  if taken <> 0 then raise exception 'T5 booked slot still offered'; end if;
  begin
    perform public.hold_slot(current_setting('test.booked_start')::timestamptz, 90, 1);
    raise exception 'T5 hold over booking accepted';
  exception when others then
    if sqlerrm <> 'SLOT_TAKEN' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.cancel_booking_client(current_setting('test.booking_a')::uuid, 'hack');
    raise exception 'T5 B cancelled A''s booking';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'T5 self-promotion allowed';
  exception when insufficient_privilege or check_violation then
    null; -- expected: policy WITH CHECK rejection
  end;
end $$;

reset role;

-- direct overlapping insert (superuser, bypassing RLS) must hit the exclusion constraint
do $$
begin
  begin
    insert into public.bookings (reference, variant_id, bay_index, slot_start, slot_end,
      duration_min, status, price_total, price_breakdown, pricing_version_id,
      contact_name, contact_phone)
    values ('TP-TEST-OVERLAP', current_setting('test.variant_id')::uuid, 1,
      current_setting('test.booked_start')::timestamptz + interval '30 minutes',
      current_setting('test.booked_start')::timestamptz + interval '120 minutes',
      90, 'confirmed', 100, '{}'::jsonb, public.current_pricing_version_id(),
      'Overlap Test', '0600000000');
    raise exception 'T5 exclusion constraint did not fire';
  exception when exclusion_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------
-- T6 — admin lifecycle: transitions + admin_create_booking + admin-notes RLS
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-0000000000ad', false);
set role authenticated;

do $$
begin
  perform public.set_booking_status(current_setting('test.booking_a')::uuid, 'confirmed', 'validé');
  begin
    perform public.set_booking_status(current_setting('test.booking_a')::uuid, 'completed', null);
    raise exception 'T6 confirmed→completed accepted';
  exception when others then
    if sqlerrm <> 'ILLEGAL_TRANSITION' then raise; end if;
  end;
  perform public.set_booking_status(current_setting('test.booking_a')::uuid, 'in_progress', null);
  perform public.set_booking_status(current_setting('test.booking_a')::uuid, 'completed', null);
end $$;

do $$
declare b jsonb; s timestamptz;
begin
  select slot_start into s from public._day_slots(current_setting('test.day')::date, 60, null)
    where state = 'available' order by slot_start desc limit 1;
  b := public.admin_create_booking(current_setting('test.variant_id')::uuid,
    '[{"zone_code":"rear_window","vlt_percent":35}]',
    s, 'Walk-in Client', '0700000000', null, null, 1, null, null);
  if (b->>'status') <> 'confirmed' then raise exception 'T6 admin booking status %', b->>'status'; end if;
end $$;

insert into public.booking_admin_notes (booking_id, notes, updated_by)
values (current_setting('test.booking_a')::uuid, 'note interne — jamais visible client', auth.uid());

do $$
declare n int;
begin
  select count(*) into n from public.admin_list_clients(null);
  if n < 1 then raise exception 'T6 admin_list_clients empty'; end if;
end $$;

reset role;

-- client A must NOT see admin notes; must see own history
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.booking_admin_notes;
  if n <> 0 then raise exception 'T6 RLS leak: client reads admin notes'; end if;
  select count(*) into n from public.booking_status_history
    where booking_id = current_setting('test.booking_a')::uuid;
  if n < 4 then raise exception 'T6 history rows missing: %', n; end if;
end $$;
reset role;

-- ---------------------------------------------------------------
-- T7 — client cancel + cutoff enforcement
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$
declare h jsonb; b jsonb; s timestamptz;
begin
  select slot_start into s from public.get_available_slots(current_setting('test.day')::date, 60)
    where state = 'available' order by slot_start limit 1;
  h := public.hold_slot(s, 60, 1);
  b := public.create_booking((h->>'hold_id')::uuid, current_setting('test.variant_id')::uuid,
    '[{"zone_code":"rear_window","vlt_percent":35}]',
    'Sophie Test', '0768207745', 'sophie@test.local', null, false, null);
  perform public.cancel_booking_client((b->>'id')::uuid, 'changement de plan');
end $$;
reset role;

update public.app_settings set value = '100000' where key = 'cancellation_cutoff_hours';
select set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$
declare h jsonb; b jsonb; s timestamptz;
begin
  select slot_start into s from public.get_available_slots(current_setting('test.day')::date, 60)
    where state = 'available' order by slot_start limit 1;
  h := public.hold_slot(s, 60, 1);
  b := public.create_booking((h->>'hold_id')::uuid, current_setting('test.variant_id')::uuid,
    '[{"zone_code":"rear_window","vlt_percent":35}]',
    'Sophie Test', '0768207745', 'sophie@test.local', null, false, null);
  begin
    perform public.cancel_booking_client((b->>'id')::uuid, null);
    raise exception 'T7 cutoff not enforced';
  exception when others then
    if sqlerrm <> 'CUTOFF_PASSED' then raise; end if;
  end;
end $$;
reset role;
update public.app_settings set value = '24' where key = 'cancellation_cutoff_hours';

-- ---------------------------------------------------------------
-- T8 — released/expired holds
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare h jsonb; hid uuid; s timestamptz;
begin
  select slot_start into s from public.get_available_slots(current_setting('test.day')::date, 60)
    where state = 'available' order by slot_start limit 1;
  h := public.hold_slot(s, 60, 1);
  hid := (h->>'hold_id')::uuid;
  perform public.release_hold();
  if exists (select 1 from public.booking_holds) then
    raise exception 'T8 release_hold left rows';
  end if;
  begin
    perform public.create_booking(hid, current_setting('test.variant_id')::uuid,
      '[{"zone_code":"rear_window","vlt_percent":35}]',
      'Karim Test', '0612440931', 'karim@test.local', null, false, null);
    raise exception 'T8 create with released hold accepted';
  exception when others then
    if sqlerrm <> 'HOLD_EXPIRED' then raise; end if;
  end;
end $$;
reset role;

-- expiry purge path: superuser plants an expired hold; availability must purge & re-offer
insert into public.booking_holds (user_id, bay_index, slot_start, slot_end, expires_at)
select '00000000-0000-0000-0000-00000000000b', 1,
       (current_setting('test.day')::date + time '14:00') at time zone 'Europe/Paris',
       (current_setting('test.day')::date + time '15:00') at time zone 'Europe/Paris',
       now() - interval '1 minute';
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
begin
  if not exists (
    select 1 from public.get_available_slots(current_setting('test.day')::date, 60)
    where slot_start = (current_setting('test.day')::date + time '14:00') at time zone 'Europe/Paris'
      and state = 'available'
  ) then
    raise exception 'T8 expired hold still blocks the 14:00 slot';
  end if;
end $$;
reset role;

-- ---------------------------------------------------------------
-- T9 — pricing versioning: clone → edit → publish; client sees only published
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-0000000000ad', false);
set role authenticated;
do $$
declare d uuid; pub uuid;
begin
  d := public.clone_pricing_version();
  update public.zone_pricing set price_delta = 75.00
    where version_id = d and zone_code = 'rear_sides' and vlt_percent = 20;
  perform public.publish_pricing(d);
  pub := public.current_pricing_version_id();
  if pub <> d then raise exception 'T9 publish did not switch versions'; end if;
end $$;
reset role;

select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare n int; q jsonb;
begin
  select count(distinct version_id) into n from public.zone_pricing;
  if n <> 1 then raise exception 'T9 client sees % pricing versions', n; end if;
  q := public.quote_booking(current_setting('test.variant_id')::uuid,
       '[{"zone_code":"rear_sides","vlt_percent":20}]');
  -- 15+35=50 → 60 min · labor 24 · 240 + 75 + 24 + 30 = 369
  if (q->'breakdown'->>'total')::numeric <> 369.00 then
    raise exception 'T9 new grid not applied: %', q->'breakdown'->>'total';
  end if;
end $$;
reset role;

-- ---------------------------------------------------------------
-- T10 — vehicle requests + garage RLS + admin resolution
-- ---------------------------------------------------------------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.vehicle_requests (user_id, raw_text, contact_email)
values (auth.uid(), 'Alpine A110 2022, coupé', 'laura@test.local');
insert into public.vehicles (user_id, variant_id, year, nickname)
values (auth.uid(), current_setting('test.variant_id')::uuid, 2021, 'Daily');
reset role;

select set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.vehicle_requests;
  if n <> 0 then raise exception 'T10 RLS leak: requests'; end if;
  select count(*) into n from public.vehicles where user_id <> auth.uid();
  if n <> 0 then raise exception 'T10 RLS leak: vehicles'; end if;
end $$;
reset role;

select set_config('test.uid', '00000000-0000-0000-0000-0000000000ad', false);
set role authenticated;
do $$
declare r uuid;
begin
  select id into r from public.vehicle_requests where status = 'new' limit 1;
  perform public.resolve_vehicle_request(r, current_setting('test.variant_id')::uuid);
  if not exists (select 1 from public.vehicle_requests where id = r and status = 'resolved') then
    raise exception 'T10 resolve failed';
  end if;
end $$;
reset role;

select 'ALL TESTS PASSED' as result;
