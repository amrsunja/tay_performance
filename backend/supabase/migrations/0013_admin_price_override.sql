-- 0013 — admin manual booking: optional price override
-- The quote is still computed (duration, specs, breakdown) but the admin may replace the
-- total. The original computed total is kept in price_breakdown->'computed_total' and the
-- row is flagged so the UI can show "prix modifié".

alter table public.bookings add column if not exists price_overridden boolean not null default false;

drop function if exists public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid);

create or replace function public.admin_create_booking(
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
  p_price_override numeric default null
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
begin
  perform public._require_admin();
  if p_contact_name is null or btrim(p_contact_name) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_phone is null or btrim(p_contact_phone) = '' then raise exception 'INVALID_CONTACT'; end if;

  v_quote := public._compute_quote(p_variant_id, p_specs);
  v_duration := (v_quote->>'duration_min')::int;
  if not (v_quote->>'compliant')::boolean then
    v_flag := 'non_compliant_ack';  -- admin books it knowingly (walk-in / phone ack)
  end if;

  v_total := (v_quote->'breakdown'->>'total')::numeric;
  v_breakdown := v_quote->'breakdown';
  if p_price_override is not null and p_price_override <> v_total then
    if p_price_override < 0 or p_price_override > 100000 then raise exception 'INVALID_INPUT'; end if;
    v_override := true;
    v_breakdown := v_breakdown
      || jsonb_build_object('computed_total', v_total, 'total', round(p_price_override, 2), 'overridden_by', auth.uid());
    v_total := round(p_price_override, 2);
  end if;

  perform public._purge_expired_holds();
  if not public._slot_is_free(p_bay, p_slot_start, p_slot_start + make_interval(mins => v_duration)) then
    raise exception 'SLOT_TAKEN';
  end if;

  begin
    insert into public.bookings (
      reference, user_id, vehicle_id, variant_id, bay_index,
      slot_start, slot_end, duration_min, status, legal_flag,
      price_total, price_breakdown, pricing_version_id, price_overridden,
      contact_name, contact_phone, contact_email, client_notes, created_by_admin
    ) values (
      public.next_booking_reference(), p_user_id, p_vehicle_id, p_variant_id, p_bay,
      p_slot_start, p_slot_start + make_interval(mins => v_duration),
      v_duration, 'confirmed', v_flag,
      v_total, v_breakdown,
      (v_quote->'breakdown'->>'pricing_version_id')::uuid, v_override,
      btrim(p_contact_name), btrim(p_contact_phone), nullif(btrim(coalesce(p_contact_email,'')), ''),
      nullif(btrim(coalesce(p_client_notes,'')), ''), true
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

revoke all on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid, numeric) from public;
grant execute on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid, numeric) to authenticated;
