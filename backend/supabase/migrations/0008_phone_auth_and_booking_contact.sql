-- 0008 — phone-OTP account model + stricter booking contact + auto-garage
--
-- Product changes (Amir, 2026-08-27):
--  * Clients sign in / sign up with PHONE + SMS OTP only (no passwords, no magic email links).
--    An anonymous session is converted in place by linking a phone (updateUser → verifyOtp
--    'phone_change'); returning users sign in with signInWithOtp('sms').
--  * Email AND phone are required for every client booking.
--  * create_booking always saves name/phone/email onto the profile, and automatically
--    attaches the selected vehicle to the client's garage when none was passed.

-- ---------------------------------------------------------------
-- sync profiles when an anonymous user links a phone (mirror of the email trigger)
-- ---------------------------------------------------------------
create or replace function public.handle_user_phone_linked()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.phone is not null and new.phone is distinct from old.phone then
    update public.profiles
      set phone = new.phone, is_anonymous = false, updated_at = now()
      where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_phone_linked on auth.users;
create trigger on_auth_user_phone_linked
  after update of phone on auth.users
  for each row execute function public.handle_user_phone_linked();

-- also copy the phone on user creation (sign-up directly by phone OTP)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_anonymous, email, phone)
  values (new.id, coalesce(new.is_anonymous, true), new.email, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- create_booking v2: email required · profile always updated · vehicle auto-attached
-- (drop first: the signature is unchanged but the body contract evolves)
-- ---------------------------------------------------------------
create or replace function public.create_booking(
  p_hold_id       uuid,
  p_variant_id    uuid,
  p_specs         jsonb,
  p_contact_name  text,
  p_contact_phone text,
  p_contact_email text default null,
  p_client_notes  text default null,
  p_ack           boolean default false,
  p_vehicle_id    uuid default null
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
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  -- phone AND email are required for client bookings (product rule)
  if p_contact_name is null or btrim(p_contact_name) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_phone is null or char_length(btrim(p_contact_phone)) < 6 then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_email is null or btrim(p_contact_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_CONTACT';
  end if;

  select * into v_hold from public.booking_holds
    where id = p_hold_id and user_id = v_uid
    for update;
  if not found or v_hold.expires_at <= now() then
    raise exception 'HOLD_EXPIRED';
  end if;

  -- vehicle: validate ownership when provided; otherwise reuse or create a garage
  -- entry for this variant so the client's car lands in "Mon Garage" automatically
  if v_vehicle_id is not null then
    if not exists (select 1 from public.vehicles where id = v_vehicle_id and user_id = v_uid) then
      raise exception 'NOT_FOUND';
    end if;
  else
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
      contact_name, contact_phone, contact_email, client_notes
    ) values (
      public.next_booking_reference(), v_uid, v_vehicle_id, p_variant_id, v_hold.bay_index,
      v_hold.slot_start, v_hold.slot_start + make_interval(mins => v_duration),
      v_duration, 'requested', v_flag,
      (v_quote->'breakdown'->>'total')::numeric, v_quote->'breakdown',
      (v_quote->'breakdown'->>'pricing_version_id')::uuid,
      btrim(p_contact_name), btrim(p_contact_phone), btrim(p_contact_email),
      nullif(btrim(coalesce(p_client_notes,'')), '')
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

  -- the profile IS the client record: always sync the latest contact info.
  -- (auth-verified phone/email from the triggers above take precedence later —
  --  they overwrite these values again on link.)
  update public.profiles
    set full_name = btrim(p_contact_name),
        phone     = btrim(p_contact_phone),
        email     = btrim(p_contact_email),
        updated_at = now()
    where id = v_uid;

  delete from public.booking_holds where id = v_hold.id;

  return jsonb_build_object(
    'id', v_booking.id, 'reference', v_booking.reference,
    'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end,
    'duration_min', v_booking.duration_min, 'status', v_booking.status,
    'legal_flag', v_booking.legal_flag, 'price_total', v_booking.price_total,
    'price_breakdown', v_booking.price_breakdown, 'specs', v_quote->'specs',
    'vehicle_id', v_vehicle_id
  );
end;
$$;
