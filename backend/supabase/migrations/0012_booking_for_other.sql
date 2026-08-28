-- 0012 — "réserver pour une autre personne"
--
-- A signed-in / anonymous profile can book for himself (contact = his profile, vehicle
-- auto-attached to his garage, profile synced) OR for someone else: the booking stays
-- attached to his user_id (visible in "Mes réservations"), bookings.contact_* holds the
-- OTHER person's details, `for_other = true`, no profile sync and no garage attach.
-- Admin sees "réservé par <profil> pour <contact>". The booker's own contact must be
-- complete on the profile (or passed as p_booker_*) so the workshop can reach him too.

alter table public.bookings add column if not exists for_other boolean not null default false;

-- the 9/10-arg overloads are superseded (same names, extra defaulted params) — drop them first
drop function if exists public.create_booking(uuid, uuid, jsonb, text, text, text, text, boolean, uuid);
drop function if exists public.reschedule_booking(uuid, uuid, uuid, jsonb, text, text, text, text, boolean, uuid);

-- create_booking v3 — same signature + p_for_other / p_booker_* (all default → v2 behaviour)
create or replace function public.create_booking(
  p_hold_id       uuid,
  p_variant_id    uuid,
  p_specs         jsonb,
  p_contact_name  text,
  p_contact_phone text,
  p_contact_email text default null,
  p_client_notes  text default null,
  p_ack           boolean default false,
  p_vehicle_id    uuid default null,
  p_for_other     boolean default false,
  p_booker_name   text default null,
  p_booker_phone  text default null,
  p_booker_email  text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_hold       public.booking_holds%rowtype;
  v_quote      jsonb;
  v_duration   int;
  v_flag       public.legal_flag := 'compliant';
  v_booking    public.bookings%rowtype;
  v_spec       jsonb;
  v_vehicle_id uuid := p_vehicle_id;
  v_for_other  boolean := coalesce(p_for_other, false);
  v_bk_name    text;
  v_bk_phone   text;
  v_bk_email   text;
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  -- the person the RDV is for: name + phone + email always required
  if p_contact_name is null or btrim(p_contact_name) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_phone is null or char_length(btrim(p_contact_phone)) < 6 then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_email is null or btrim(p_contact_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_CONTACT';
  end if;

  -- booking for someone else: the booker's own contact must be known (profile or params)
  if v_for_other then
    select coalesce(nullif(btrim(p_booker_name), ''),  p.full_name),
           coalesce(nullif(btrim(p_booker_phone), ''), p.phone),
           coalesce(nullif(lower(btrim(p_booker_email)), ''), p.email)
      into v_bk_name, v_bk_phone, v_bk_email
      from public.profiles p where p.id = v_uid;
    if v_bk_name is null or v_bk_phone is null or char_length(v_bk_phone) < 6
       or v_bk_email is null or v_bk_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'BOOKER_CONTACT_REQUIRED';
    end if;
  end if;

  select * into v_hold from public.booking_holds
    where id = p_hold_id and user_id = v_uid
    for update;
  if not found or v_hold.expires_at <= now() then
    raise exception 'HOLD_EXPIRED';
  end if;

  -- vehicle: validate ownership when provided; for the booker himself, reuse or create a
  -- garage entry; for another person the car is NOT added to the booker's garage
  if v_vehicle_id is not null then
    if not exists (select 1 from public.vehicles where id = v_vehicle_id and user_id = v_uid) then
      raise exception 'NOT_FOUND';
    end if;
  elsif not v_for_other then
    select id into v_vehicle_id from public.vehicles
      where user_id = v_uid and variant_id = p_variant_id
      order by created_at limit 1;
    if v_vehicle_id is null then
      insert into public.vehicles (user_id, variant_id)
      values (v_uid, p_variant_id)
      returning id into v_vehicle_id;
    end if;
  end if;

  v_quote := public._compute_quote(p_variant_id, p_specs);
  v_duration := (v_quote->>'duration_min')::int;
  if v_hold.slot_end - v_hold.slot_start < make_interval(mins => v_duration) then
    raise exception 'DURATION_CHANGED';
  end if;

  if not (v_quote->>'compliant')::boolean then
    if not coalesce(p_ack, false) then
      raise exception 'ILLEGAL_SPEC_REQUIRES_ACK';
    end if;
    v_flag := 'non_compliant_ack';
  end if;

  begin
    insert into public.bookings (
      reference, user_id, vehicle_id, variant_id, bay_index,
      slot_start, slot_end, duration_min, status, legal_flag,
      price_total, price_breakdown, pricing_version_id,
      contact_name, contact_phone, contact_email, client_notes, for_other
    ) values (
      public.next_booking_reference(), v_uid, v_vehicle_id, p_variant_id, v_hold.bay_index,
      v_hold.slot_start, v_hold.slot_start + make_interval(mins => v_duration),
      v_duration, 'requested', v_flag,
      (v_quote->'breakdown'->>'total')::numeric, v_quote->'breakdown',
      (v_quote->'breakdown'->>'pricing_version_id')::uuid,
      btrim(p_contact_name), btrim(p_contact_phone), lower(btrim(p_contact_email)),
      nullif(btrim(coalesce(p_client_notes,'')), ''), v_for_other
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

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by)
  values (v_booking.id, null, 'requested', v_uid);

  -- the profile IS the client record
  if v_for_other then
    update public.profiles
      set full_name = v_bk_name, phone = v_bk_phone, email = v_bk_email, updated_at = now()
      where id = v_uid;
  else
    update public.profiles
      set full_name = btrim(p_contact_name),
          phone     = btrim(p_contact_phone),
          email     = lower(btrim(p_contact_email)),
          updated_at = now()
      where id = v_uid;
  end if;

  delete from public.booking_holds where id = v_hold.id;

  return jsonb_build_object(
    'id', v_booking.id, 'reference', v_booking.reference,
    'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end,
    'duration_min', v_booking.duration_min, 'status', v_booking.status,
    'legal_flag', v_booking.legal_flag, 'price_total', v_booking.price_total,
    'price_breakdown', v_booking.price_breakdown, 'specs', v_quote->'specs',
    'vehicle_id', v_vehicle_id, 'for_other', v_for_other
  );
end;
$$;

-- reschedule keeps the "for other" nature of the original unless overridden
create or replace function public.reschedule_booking(
  p_old_booking_id uuid,
  p_hold_id        uuid,
  p_variant_id     uuid,
  p_specs          jsonb,
  p_contact_name   text,
  p_contact_phone  text,
  p_contact_email  text default null,
  p_client_notes   text default null,
  p_ack            boolean default false,
  p_vehicle_id     uuid default null,
  p_for_other      boolean default null,
  p_booker_name    text default null,
  p_booker_phone   text default null,
  p_booker_email   text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_old     public.bookings%rowtype;
  v_cutoff  int := coalesce(public._setting_int('cancellation_cutoff_hours'), 24);
  v_new     jsonb;
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  select * into v_old from public.bookings
    where id = p_old_booking_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_old.status not in ('requested','confirmed') then raise exception 'ILLEGAL_TRANSITION'; end if;
  if now() >= v_old.slot_start - make_interval(hours => v_cutoff) then
    raise exception 'CUTOFF_PASSED';
  end if;

  v_new := public.create_booking(
    p_hold_id, p_variant_id, p_specs,
    p_contact_name, p_contact_phone, p_contact_email,
    p_client_notes, p_ack, p_vehicle_id,
    coalesce(p_for_other, v_old.for_other), p_booker_name, p_booker_phone, p_booker_email
  );

  update public.bookings
    set status = 'cancelled',
        cancellation_reason = 'Reprogrammé → ' || (v_new->>'reference')
    where id = p_old_booking_id;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_old_booking_id, v_old.status, 'cancelled', v_uid, 'reprogrammation → ' || (v_new->>'reference'));

  return v_new || jsonb_build_object('old_reference', v_old.reference);
end;
$$;


revoke all on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, boolean, uuid, boolean, text, text, text) from public;
revoke all on function public.reschedule_booking(uuid, uuid, uuid, jsonb, text, text, text, text, boolean, uuid, boolean, text, text, text) from public;
grant execute on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, boolean, uuid, boolean, text, text, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, uuid, jsonb, text, text, text, text, boolean, uuid, boolean, text, text, text) to authenticated;
