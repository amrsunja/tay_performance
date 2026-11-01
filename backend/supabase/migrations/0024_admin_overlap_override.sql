-- 0024 — the admin may knowingly book over an existing RDV
--
-- One car at a time stays the rule (0019) for everyone else. In the new-reservation dialogs the
-- admin can pick any time; if it overlaps something he is shown what and must confirm. Such a
-- booking carries overlap_forced = true and is left out of the exclusion constraint.
--   • clients: _slot_is_free still reads every active booking → the time stays taken for them
--   • without p_allow_overlap, an overlap is still refused (SLOT_TAKEN)
--   • admin_reschedule_booking never overrides, and a move clears the flag
--
-- Also: admin_create_custom_booking takes the client picked from the list (p_user_id), and
-- admin_create_booking refuses a past start like the custom path (a free time input now reaches it).

alter table public.bookings add column if not exists overlap_forced boolean not null default false;

alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  tstzrange(slot_start, slot_end) with &&
) where (status in ('requested','confirmed','in_progress') and not overlap_forced);

-- new parameters: drop first, a second signature would make the named calls ambiguous
drop function public.admin_confirm_service_request(uuid, text, timestamptz, int, numeric, text, text, text);
drop function public.admin_create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text);
drop function public._create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text, uuid, uuid, text);
drop function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid, numeric);

create function public._create_custom_booking(
  p_title          text,
  p_slot_start     timestamptz,
  p_duration_min   int,
  p_contact_name   text,
  p_contact_phone  text,
  p_contact_email  text,
  p_client_notes   text,
  p_vehicle        text,
  p_price          numeric,
  p_admin_message  text,
  p_user_id        uuid,
  p_request_id     uuid,
  p_history_note   text,
  p_allow_overlap  boolean
) returns public.bookings language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
  v_phone   text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_end     timestamptz;
  v_free    boolean;
  v_booking public.bookings%rowtype;
begin
  if v_title is null or char_length(v_title) < 2 then raise exception 'INVALID_TITLE'; end if;
  if v_phone is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_slot_start is null or p_duration_min is null or p_duration_min < 15 or p_duration_min > 600 then
    raise exception 'INVALID_SLOT';
  end if;
  if p_slot_start < now() then raise exception 'SLOT_IN_PAST'; end if;
  if p_price is not null and (p_price < 0 or p_price > 100000) then raise exception 'INVALID_PRICE'; end if;

  v_end := p_slot_start + make_interval(mins => p_duration_min);
  perform public._purge_expired_holds();
  v_free := public._slot_is_free(1, p_slot_start, v_end);
  if not v_free and not coalesce(p_allow_overlap, false) then raise exception 'SLOT_TAKEN'; end if;

  begin
    insert into public.bookings (
      reference, user_id, service_type, bay_index, slot_start, slot_end, duration_min, status,
      price_total, price_breakdown, contact_name, contact_phone, contact_email, client_notes,
      created_by_admin, custom_title, custom_vehicle, admin_message, service_request_id, overlap_forced
    ) values (
      public.next_booking_reference(), p_user_id, 'custom', 1, p_slot_start, v_end, p_duration_min, 'confirmed',
      round(p_price, 2), jsonb_build_object('custom', true, 'total', round(p_price, 2)),
      nullif(btrim(coalesce(p_contact_name, '')), ''), v_phone,
      nullif(lower(btrim(coalesce(p_contact_email, ''))), ''),
      nullif(btrim(coalesce(p_client_notes, '')), ''), true, v_title,
      nullif(btrim(coalesce(p_vehicle, '')), ''), nullif(btrim(coalesce(p_admin_message, '')), ''), p_request_id,
      not v_free
    ) returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  -- null → confirmed: the e-mail + SMS pipeline sends the confirmation, same as admin_create_booking
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (v_booking.id, null, 'confirmed', auth.uid(), p_history_note);

  return v_booking;
end;
$$;

create function public.admin_confirm_service_request(
  p_request_id    uuid,
  p_title         text,
  p_slot_start    timestamptz,
  p_duration_min  int,
  p_price         numeric default null,
  p_admin_message text default null,
  p_contact_name  text default null,
  p_vehicle       text default null,
  p_allow_overlap boolean default false
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_req     public.service_requests%rowtype;
  v_booking public.bookings%rowtype;
begin
  perform public._require_admin();
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_req.status <> 'new' then raise exception 'ILLEGAL_TRANSITION'; end if;

  v_booking := public._create_custom_booking(
    p_title, p_slot_start, p_duration_min,
    coalesce(nullif(btrim(coalesce(p_contact_name, '')), ''), v_req.contact_name),
    v_req.contact_phone, v_req.contact_email, v_req.message,
    coalesce(nullif(btrim(coalesce(p_vehicle, '')), ''), v_req.vehicle_text),
    p_price, p_admin_message, v_req.user_id, v_req.id,
    'devis confirmé · ' || v_req.reference, p_allow_overlap);

  update public.service_requests
     set status = 'confirmed', handled_by = auth.uid(), handled_at = now()
   where id = p_request_id;

  return jsonb_build_object('id', v_booking.id, 'reference', v_booking.reference,
                            'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end);
end;
$$;

create function public.admin_create_custom_booking(
  p_title         text,
  p_slot_start    timestamptz,
  p_duration_min  int,
  p_contact_phone text,
  p_contact_name  text default null,
  p_contact_email text default null,
  p_client_notes  text default null,
  p_vehicle       text default null,
  p_price         numeric default null,
  p_admin_message text default null,
  p_user_id       uuid default null,
  p_allow_overlap boolean default false
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare v_booking public.bookings%rowtype;
begin
  perform public._require_admin();
  v_booking := public._create_custom_booking(
    p_title, p_slot_start, p_duration_min, p_contact_name, p_contact_phone, p_contact_email,
    p_client_notes, p_vehicle, p_price, p_admin_message,
    coalesce(p_user_id, public._user_id_for_phone(p_contact_phone)), null,
    'création manuelle admin · prestation personnalisée', p_allow_overlap);
  return jsonb_build_object('id', v_booking.id, 'reference', v_booking.reference,
                            'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end);
end;
$$;

create function public.admin_create_booking(
  p_variant_id     uuid,
  p_specs          jsonb,
  p_slot_start     timestamptz,
  p_contact_name   text,
  p_contact_phone  text,
  p_contact_email  text default null,
  p_client_notes   text default null,
  p_bay            int default 1,
  p_user_id        uuid default null,
  p_vehicle_id     uuid default null,
  p_price_override numeric default null,
  p_allow_overlap  boolean default false
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_quote     jsonb;
  v_duration  int;
  v_flag      public.legal_flag := 'compliant';
  v_booking   public.bookings%rowtype;
  v_spec      jsonb;
  v_total     numeric;
  v_breakdown jsonb;
  v_override  boolean := false;
  v_free      boolean;
begin
  perform public._require_admin();
  if p_contact_phone is null or btrim(p_contact_phone) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_slot_start is null then raise exception 'INVALID_SLOT'; end if;
  if p_slot_start < now() then raise exception 'SLOT_IN_PAST'; end if;

  v_quote := public._compute_quote(p_variant_id, p_specs);
  v_duration := (v_quote->>'duration_min')::int;
  if not (v_quote->>'compliant')::boolean then
    v_flag := 'non_compliant_ack';  -- admin books it knowingly (walk-in / phone ack)
  end if;

  v_total := (v_quote->'breakdown'->>'total')::numeric;   -- null when sur devis
  v_breakdown := v_quote->'breakdown';
  if p_price_override is not null and (v_total is null or p_price_override <> v_total) then
    if p_price_override < 0 or p_price_override > 100000 then raise exception 'INVALID_INPUT'; end if;
    v_override := v_total is not null;   -- setting the price of a "sur devis" booking is not an override
    v_breakdown := v_breakdown
      || jsonb_build_object('computed_total', v_total, 'total', round(p_price_override, 2), 'overridden_by', auth.uid());
    v_total := round(p_price_override, 2);
  end if;

  perform public._purge_expired_holds();
  v_free := public._slot_is_free(p_bay, p_slot_start, p_slot_start + make_interval(mins => v_duration));
  if not v_free and not coalesce(p_allow_overlap, false) then raise exception 'SLOT_TAKEN'; end if;

  begin
    insert into public.bookings (
      reference, user_id, vehicle_id, variant_id, bay_index,
      slot_start, slot_end, duration_min, status, legal_flag,
      price_total, price_breakdown, pricing_version_id, price_overridden,
      contact_name, contact_phone, contact_email, client_notes, created_by_admin, overlap_forced
    ) values (
      public.next_booking_reference(), coalesce(p_user_id, public._user_id_for_phone(p_contact_phone)), p_vehicle_id, p_variant_id, p_bay,
      p_slot_start, p_slot_start + make_interval(mins => v_duration),
      v_duration, 'confirmed', v_flag,
      v_total, v_breakdown,
      (v_quote->'breakdown'->>'pricing_version_id')::uuid, v_override,
      nullif(btrim(coalesce(p_contact_name,'')), ''), btrim(p_contact_phone), nullif(btrim(coalesce(p_contact_email,'')), ''),
      nullif(btrim(coalesce(p_client_notes,'')), ''), true, not v_free
    ) returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  for v_spec in select * from jsonb_array_elements(v_quote->'specs')
  loop
    insert into public.booking_tint_specs (booking_id, zone_code, vlt_percent, price_delta, minutes, is_legal)
    values (
      v_booking.id,
      (v_spec->>'zone_code')::public.tint_zone_code,
      (v_spec->>'vlt_percent')::int,
      (v_spec->>'delta')::numeric,
      (v_spec->>'minutes')::int,
      (v_spec->>'is_legal')::boolean
    );
  end loop;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (v_booking.id, null, 'confirmed', auth.uid(),
          'création manuelle admin' || case when v_override then ' · prix modifié' else '' end);

  return jsonb_build_object(
    'id', v_booking.id, 'reference', v_booking.reference,
    'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end,
    'duration_min', v_booking.duration_min, 'status', v_booking.status,
    'price_total', v_booking.price_total, 'price_overridden', v_override
  );
end;
$$;

-- a move never overrides (the check below refuses any overlap), so the moved booking is a normal one again
create or replace function public.admin_reschedule_booking(
  p_booking_id uuid,
  p_new_start  timestamptz,
  p_reason     text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_end     timestamptz;
begin
  perform public._require_admin();
  if p_new_start is null then raise exception 'INVALID_SLOT'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.status not in ('requested','confirmed') then raise exception 'ILLEGAL_TRANSITION'; end if;
  if p_new_start = v_booking.slot_start then
    return jsonb_build_object('changed', false, 'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end);
  end if;
  if p_new_start < now() then raise exception 'SLOT_IN_PAST'; end if;

  v_end := p_new_start + (v_booking.slot_end - v_booking.slot_start);

  -- one car at a time in the workshop: any other active booking or live hold blocks the slot
  perform public._purge_expired_holds();
  if exists (
       select 1 from public.bookings b
        where b.id <> v_booking.id
          and b.status in ('requested','confirmed','in_progress')
          and tstzrange(b.slot_start, b.slot_end) && tstzrange(p_new_start, v_end))
     or exists (
       select 1 from public.booking_holds h
        where h.expires_at > now()
          and tstzrange(h.slot_start, h.slot_end) && tstzrange(p_new_start, v_end))
  then
    raise exception 'SLOT_TAKEN';
  end if;

  begin
    update public.bookings
       set slot_start = p_new_start, slot_end = v_end, rescheduled_at = now(), updated_at = now(), overlap_forced = false
     where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, v_booking.status, auth.uid(),
          'reschedule|' || (to_json(v_booking.slot_start) #>> '{}') || '|' || (to_json(p_new_start) #>> '{}')
          || '|' || coalesce(btrim(p_reason), ''));

  return jsonb_build_object(
    'changed', true,
    'previous_start', v_booking.slot_start,
    'slot_start', p_new_start,
    'slot_end', v_end
  );
end;
$$;

-- ============ grants ============
revoke all on function public._create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_confirm_service_request(uuid, text, timestamptz, int, numeric, text, text, text, boolean) from public;
revoke all on function public.admin_create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text, uuid, boolean) from public;
revoke all on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid, numeric, boolean) from public;
grant execute on function public.admin_confirm_service_request(uuid, text, timestamptz, int, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.admin_create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text, uuid, boolean) to authenticated;
grant execute on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid, numeric, boolean) to authenticated;
