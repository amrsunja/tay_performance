-- 0005 — business RPCs: quote, availability, holds, booking lifecycle, admin ops, pricing publication
-- Contract: docs/04_BUSINESS_LOGIC.md. Error vocabulary (docs 04 §13) is raised via `raise exception '<CODE>'`.
-- All public entry points: SECURITY DEFINER, pinned search_path, explicit grants at the bottom.

-- =====================================================================
-- internal helpers (no grants — callable only from definer functions)
-- =====================================================================

create or replace function public._require_admin()
returns void language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

create or replace function public._tz()
returns text language sql stable
set search_path = public
as $$ select coalesce(public._setting_text('timezone'), 'Europe/Paris') $$;

create or replace function public._purge_expired_holds()
returns void language sql volatile security definer
set search_path = public
as $$ delete from public.booking_holds where expires_at < now() $$;

-- Compute the authoritative quote for a variant + specs.
-- p_specs: [{"zone_code":"rear_sides","vlt_percent":20}, …]
create or replace function public._compute_quote(p_variant_id uuid, p_specs jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_version_id  uuid;
  v_variant     record;
  v_rule        record;
  v_gran        int := coalesce(public._setting_int('slot_granularity_min'), 30);
  v_limo_thr    int := coalesce(public._setting_int('limo_vlt_threshold'), 20);
  v_limo_amt    numeric := coalesce(public._setting_numeric('limo_supplement'), 0);
  v_specs       jsonb := '[]'::jsonb;
  v_spec        record;
  v_zones_total numeric := 0;
  v_minutes_raw int;
  v_duration    int;
  v_labor       numeric;
  v_limo        numeric := 0;
  v_total       numeric;
  v_compliant   boolean := true;
  v_has_limo    boolean := false;
  v_count       int;
  v_distinct    int;
begin
  if p_specs is null or jsonb_typeof(p_specs) <> 'array' or jsonb_array_length(p_specs) = 0 then
    raise exception 'INVALID_SPECS';
  end if;

  select count(*), count(distinct e->>'zone_code')
    into v_count, v_distinct
    from jsonb_array_elements(p_specs) e;
  if v_count <> v_distinct then
    raise exception 'INVALID_SPECS'; -- duplicate zones
  end if;

  v_version_id := public.current_pricing_version_id();
  if v_version_id is null then
    raise exception 'NO_PUBLISHED_PRICING';
  end if;

  select vv.*, bs.code as body_code
    into v_variant
    from public.vehicle_variants vv
    join public.body_styles bs on bs.code = vv.body_style_code
    where vv.id = p_variant_id and vv.is_active;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select pr.* into v_rule
    from public.pricing_rules pr
    where pr.version_id = v_version_id and pr.body_style_code = v_variant.body_style_code;
  if not found then
    raise exception 'PRICING_INCOMPLETE';
  end if;

  v_minutes_raw := v_variant.base_labor_minutes;

  for v_spec in
    select (e->>'zone_code')::public.tint_zone_code as zone_code,
           (e->>'vlt_percent')::int                 as vlt_percent
      from jsonb_array_elements(p_specs) e
  loop
    declare
      v_zone  public.tint_zones%rowtype;
      v_vlt   public.vlt_levels%rowtype;
      v_delta numeric;
      v_legal boolean;
    begin
      select * into v_zone from public.tint_zones where code = v_spec.zone_code and is_active;
      if not found then raise exception 'INVALID_SPECS'; end if;
      select * into v_vlt from public.vlt_levels where vlt_percent = v_spec.vlt_percent and is_active;
      if not found then raise exception 'INVALID_SPECS'; end if;

      select zp.price_delta into v_delta
        from public.zone_pricing zp
        where zp.version_id = v_version_id
          and zp.zone_code = v_spec.zone_code
          and zp.vlt_percent = v_spec.vlt_percent;
      if v_delta is null then raise exception 'PRICING_INCOMPLETE'; end if;

      v_legal := (not v_zone.is_front) or v_vlt.is_front_legal;
      if not v_legal then v_compliant := false; end if;
      if v_spec.vlt_percent <= v_limo_thr then v_has_limo := true; end if;

      v_zones_total := v_zones_total + v_delta;
      v_minutes_raw := v_minutes_raw + v_zone.base_minutes;
      v_specs := v_specs || jsonb_build_object(
        'zone_code',   v_spec.zone_code,
        'vlt_percent', v_spec.vlt_percent,
        'delta',       v_delta,
        'minutes',     v_zone.base_minutes,
        'is_legal',    v_legal,
        'label_fr',    v_zone.label_fr
      );
    end;
  end loop;

  v_duration := (ceil(v_minutes_raw::numeric / v_gran) * v_gran)::int;
  v_labor    := round(v_duration * v_rule.labor_rate_per_min, 2);
  if v_has_limo then v_limo := v_limo_amt; end if;
  v_total    := round(v_rule.base_price + v_zones_total + v_labor + v_limo, 2);

  return jsonb_build_object(
    'variant_id',   p_variant_id,
    'duration_min', v_duration,
    'compliant',    v_compliant,
    'specs',        v_specs,
    'breakdown', jsonb_build_object(
      'base',  v_rule.base_price,
      'zones', v_zones_total,
      'labor', jsonb_build_object('minutes', v_duration, 'rate', v_rule.labor_rate_per_min, 'amount', v_labor),
      'limo_supplement', v_limo,
      'total', v_total,
      'pricing_version_id', v_version_id
    )
  );
end;
$$;

-- Is [p_start, p_end) free on p_bay? Ignores holds of p_ignore_user (the caller's own hold).
create or replace function public._slot_is_free(
  p_bay int, p_start timestamptz, p_end timestamptz, p_ignore_user uuid default null
) returns boolean language sql stable security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.bookings b
    where b.bay_index = p_bay
      and b.status in ('requested','confirmed','in_progress')
      and tstzrange(b.slot_start, b.slot_end) && tstzrange(p_start, p_end)
  ) and not exists (
    select 1 from public.booking_holds h
    where h.bay_index = p_bay
      and h.expires_at > now()
      and (p_ignore_user is null or h.user_id is distinct from p_ignore_user)
      and tstzrange(h.slot_start, h.slot_end) && tstzrange(p_start, p_end)
  );
$$;

-- All slot candidates of one day. state: available | taken | held_by_me
create or replace function public._day_slots(p_day date, p_duration_min int, p_user uuid)
returns table (slot_start timestamptz, slot_end timestamptz, bay_index int, state text)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_tz     text := public._tz();
  v_gran   int  := coalesce(public._setting_int('slot_granularity_min'), 30);
  v_bays   int  := coalesce(public._setting_int('bay_count'), 1);
  v_lead   int  := coalesce(public._setting_int('min_lead_time_hours'), 0);
  v_hours  public.workshop_hours%rowtype;
  v_open   timestamptz;
  v_close  timestamptz;
  v_min    timestamptz := now() + make_interval(hours => v_lead);
  v_bay    int;
  v_gs     timestamptz;
begin
  select * into v_hours from public.workshop_hours
    where weekday = extract(isodow from p_day)::int;
  if not found or not v_hours.is_open then return; end if;
  if exists (select 1 from public.blackout_dates where day = p_day) then return; end if;

  v_open  := (p_day + v_hours.open_time)  at time zone v_tz;
  v_close := (p_day + v_hours.close_time) at time zone v_tz;
  if v_open + make_interval(mins => p_duration_min) > v_close then return; end if;

  for v_bay in 1..v_bays loop
    for v_gs in
      select gs from generate_series(
        v_open,
        v_close - make_interval(mins => p_duration_min),
        make_interval(mins => v_gran)
      ) gs
    loop
      declare
        v_s timestamptz := v_gs;
        v_e timestamptz := v_gs + make_interval(mins => p_duration_min);
      begin
        slot_start := v_s;
        slot_end   := v_e;
        bay_index  := v_bay;
        if v_gs < v_min then
          state := 'taken';
        elsif p_user is not null and exists (
          select 1 from public.booking_holds h
          where h.user_id = p_user and h.bay_index = v_bay and h.expires_at > now()
            and tstzrange(h.slot_start, h.slot_end) && tstzrange(v_s, v_e)
        ) then
          state := 'held_by_me';
        elsif public._slot_is_free(v_bay, v_s, v_e, p_user) then
          state := 'available';
        else
          state := 'taken';
        end if;
        return next;
      end;
    end loop;
  end loop;
end;
$$;

-- =====================================================================
-- public read RPCs
-- =====================================================================

create or replace function public.quote_booking(p_variant_id uuid, p_specs jsonb)
returns jsonb language sql stable security definer
set search_path = public
as $$ select public._compute_quote(p_variant_id, p_specs) $$;

create or replace function public.get_available_slots(p_day date, p_duration_min int)
returns table (slot_start timestamptz, slot_end timestamptz, bay_index int, state text)
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_tz      text := public._tz();
  v_today   date := (now() at time zone v_tz)::date;
  v_horizon int  := coalesce(public._setting_int('booking_horizon_days'), 90);
begin
  if p_duration_min is null or p_duration_min < 15 or p_duration_min > 600 then
    raise exception 'INVALID_SPECS';
  end if;
  if p_day < v_today or p_day > v_today + v_horizon then
    return;
  end if;
  perform public._purge_expired_holds();
  return query select * from public._day_slots(p_day, p_duration_min, auth.uid());
end;
$$;

create or replace function public.get_month_availability(p_year int, p_month int, p_duration_min int)
returns table (day date, state text, free_count int)
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_tz      text := public._tz();
  v_today   date := (now() at time zone v_tz)::date;
  v_horizon int  := coalesce(public._setting_int('booking_horizon_days'), 90);
  v_first   date := make_date(p_year, p_month, 1);
  v_day     date;
  v_free    int;
  v_hours   public.workshop_hours%rowtype;
begin
  if p_duration_min is null or p_duration_min < 15 or p_duration_min > 600 then
    raise exception 'INVALID_SPECS';
  end if;
  perform public._purge_expired_holds();
  for v_day in select d::date from generate_series(v_first, (v_first + interval '1 month' - interval '1 day')::date, interval '1 day') d
  loop
    day := v_day;
    if v_day < v_today then
      state := 'past'; free_count := 0;
    elsif v_day > v_today + v_horizon then
      state := 'closed'; free_count := 0;
    else
      select * into v_hours from public.workshop_hours where weekday = extract(isodow from v_day)::int;
      if not found or not v_hours.is_open
         or exists (select 1 from public.blackout_dates b where b.day = v_day) then
        state := 'closed'; free_count := 0;
      else
        select count(*)::int into v_free
          from public._day_slots(v_day, p_duration_min, auth.uid()) s
          where s.state in ('available','held_by_me');
        free_count := v_free;
        state := case when v_free = 0 then 'full' else 'available' end;
      end if;
    end if;
    return next;
  end loop;
end;
$$;

-- =====================================================================
-- holds
-- =====================================================================

create or replace function public.hold_slot(p_slot_start timestamptz, p_duration_min int, p_bay int default 1)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_tz    text := public._tz();
  v_ttl   int  := coalesce(public._setting_int('hold_ttl_minutes'), 10);
  v_day   date;
  v_ok    boolean;
  v_hold  public.booking_holds%rowtype;
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  if p_duration_min is null or p_duration_min < 15 or p_duration_min > 600 then
    raise exception 'INVALID_SPECS';
  end if;

  perform public._purge_expired_holds();
  delete from public.booking_holds where user_id = v_uid;  -- one live hold per user

  v_day := (p_slot_start at time zone v_tz)::date;
  select exists (
    select 1 from public._day_slots(v_day, p_duration_min, v_uid) s
    where s.bay_index = p_bay and s.slot_start = p_slot_start and s.state = 'available'
  ) into v_ok;
  if not v_ok then raise exception 'SLOT_TAKEN'; end if;

  begin
    insert into public.booking_holds (user_id, bay_index, slot_start, slot_end, expires_at)
    values (v_uid, p_bay, p_slot_start,
            p_slot_start + make_interval(mins => p_duration_min),
            now() + make_interval(mins => v_ttl))
    returning * into v_hold;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return jsonb_build_object(
    'hold_id', v_hold.id, 'bay_index', v_hold.bay_index,
    'slot_start', v_hold.slot_start, 'slot_end', v_hold.slot_end,
    'expires_at', v_hold.expires_at
  );
end;
$$;

create or replace function public.release_hold()
returns void language sql volatile security definer
set search_path = public
as $$ delete from public.booking_holds where user_id = auth.uid() $$;

-- =====================================================================
-- booking creation (client)
-- =====================================================================

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
  v_uid      uuid := auth.uid();
  v_hold     public.booking_holds%rowtype;
  v_quote    jsonb;
  v_duration int;
  v_flag     public.legal_flag := 'compliant';
  v_booking  public.bookings%rowtype;
  v_spec     jsonb;
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  if p_contact_name is null or btrim(p_contact_name) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_phone is null or btrim(p_contact_phone) = '' then raise exception 'INVALID_CONTACT'; end if;

  select * into v_hold from public.booking_holds
    where id = p_hold_id and user_id = v_uid
    for update;
  if not found or v_hold.expires_at <= now() then
    raise exception 'HOLD_EXPIRED';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles where id = p_vehicle_id and user_id = v_uid
  ) then
    raise exception 'NOT_FOUND';
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
      public.next_booking_reference(), v_uid, p_vehicle_id, p_variant_id, v_hold.bay_index,
      v_hold.slot_start, v_hold.slot_start + make_interval(mins => v_duration),
      v_duration, 'requested', v_flag,
      (v_quote->'breakdown'->>'total')::numeric, v_quote->'breakdown',
      (v_quote->'breakdown'->>'pricing_version_id')::uuid,
      btrim(p_contact_name), btrim(p_contact_phone), nullif(btrim(coalesce(p_contact_email,'')), ''),
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

  -- opportunistically enrich the (possibly anonymous) profile
  update public.profiles
    set full_name = coalesce(nullif(btrim(full_name), ''), btrim(p_contact_name)),
        phone     = coalesce(nullif(btrim(coalesce(phone,'')), ''), btrim(p_contact_phone)),
        updated_at = now()
    where id = v_uid;

  delete from public.booking_holds where id = v_hold.id;

  return jsonb_build_object(
    'id', v_booking.id, 'reference', v_booking.reference,
    'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end,
    'duration_min', v_booking.duration_min, 'status', v_booking.status,
    'legal_flag', v_booking.legal_flag, 'price_total', v_booking.price_total,
    'price_breakdown', v_booking.price_breakdown, 'specs', v_quote->'specs'
  );
end;
$$;

-- =====================================================================
-- client cancel / reschedule
-- =====================================================================

create or replace function public.cancel_booking_client(p_booking_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_cutoff  int := coalesce(public._setting_int('cancellation_cutoff_hours'), 24);
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  select * into v_booking from public.bookings
    where id = p_booking_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.status not in ('requested','confirmed') then raise exception 'ILLEGAL_TRANSITION'; end if;
  if now() >= v_booking.slot_start - make_interval(hours => v_cutoff) then
    raise exception 'CUTOFF_PASSED';
  end if;

  update public.bookings
    set status = 'cancelled',
        cancellation_reason = nullif(btrim(coalesce(p_reason,'')), '')
    where id = p_booking_id;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, 'cancelled', v_uid, 'annulation client');
end;
$$;

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
  p_vehicle_id     uuid default null
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
    p_client_notes, p_ack, p_vehicle_id
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

-- =====================================================================
-- admin: status lifecycle & manual booking
-- =====================================================================

create or replace function public._transition_allowed(p_from public.booking_status, p_to public.booking_status)
returns boolean language sql immutable
as $$
  select case p_from
    when 'requested'   then p_to in ('confirmed','cancelled')
    when 'confirmed'   then p_to in ('in_progress','cancelled','no_show')
    when 'in_progress' then p_to in ('completed','cancelled')
    else false
  end;
$$;

create or replace function public.set_booking_status(
  p_booking_id uuid, p_status public.booking_status, p_note text default null
) returns void language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  perform public._require_admin();
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public._transition_allowed(v_booking.status, p_status) then
    raise exception 'ILLEGAL_TRANSITION';
  end if;

  update public.bookings set status = p_status where id = p_booking_id;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, p_status, auth.uid(), nullif(btrim(coalesce(p_note,'')), ''));
end;
$$;

create or replace function public.admin_create_booking(
  p_variant_id    uuid,
  p_specs         jsonb,
  p_slot_start    timestamptz,
  p_contact_name  text,
  p_contact_phone text,
  p_contact_email text default null,
  p_client_notes  text default null,
  p_bay           int default 1,
  p_user_id       uuid default null,
  p_vehicle_id    uuid default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_quote    jsonb;
  v_duration int;
  v_flag     public.legal_flag := 'compliant';
  v_booking  public.bookings%rowtype;
  v_spec     jsonb;
begin
  perform public._require_admin();
  if p_contact_name is null or btrim(p_contact_name) = '' then raise exception 'INVALID_CONTACT'; end if;
  if p_contact_phone is null or btrim(p_contact_phone) = '' then raise exception 'INVALID_CONTACT'; end if;

  v_quote := public._compute_quote(p_variant_id, p_specs);
  v_duration := (v_quote->>'duration_min')::int;
  if not (v_quote->>'compliant')::boolean then
    v_flag := 'non_compliant_ack';  -- admin books it knowingly (walk-in / phone ack)
  end if;

  perform public._purge_expired_holds();
  if not public._slot_is_free(p_bay, p_slot_start, p_slot_start + make_interval(mins => v_duration)) then
    raise exception 'SLOT_TAKEN';
  end if;

  begin
    insert into public.bookings (
      reference, user_id, vehicle_id, variant_id, bay_index,
      slot_start, slot_end, duration_min, status, legal_flag,
      price_total, price_breakdown, pricing_version_id,
      contact_name, contact_phone, contact_email, client_notes, created_by_admin
    ) values (
      public.next_booking_reference(), p_user_id, p_vehicle_id, p_variant_id, p_bay,
      p_slot_start, p_slot_start + make_interval(mins => v_duration),
      v_duration, 'confirmed', v_flag,
      (v_quote->'breakdown'->>'total')::numeric, v_quote->'breakdown',
      (v_quote->'breakdown'->>'pricing_version_id')::uuid,
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
  values (v_booking.id, null, 'confirmed', auth.uid(), 'création manuelle admin');

  return jsonb_build_object(
    'id', v_booking.id, 'reference', v_booking.reference,
    'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end,
    'duration_min', v_booking.duration_min, 'status', v_booking.status,
    'price_total', v_booking.price_total
  );
end;
$$;

-- =====================================================================
-- admin: pricing versioning
-- =====================================================================

create or replace function public.clone_pricing_version()
returns uuid language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_draft uuid;
  v_pub   uuid;
begin
  perform public._require_admin();
  select id into v_draft from public.pricing_versions where status = 'draft' limit 1;
  if v_draft is not null then return v_draft; end if;

  v_pub := public.current_pricing_version_id();
  if v_pub is null then raise exception 'NO_PUBLISHED_PRICING'; end if;

  insert into public.pricing_versions (status, label, created_by)
  values ('draft', 'Brouillon ' || to_char(now(), 'DD/MM/YYYY'), auth.uid())
  returning id into v_draft;

  insert into public.pricing_rules (version_id, body_style_code, base_price, labor_rate_per_min)
  select v_draft, body_style_code, base_price, labor_rate_per_min
    from public.pricing_rules where version_id = v_pub;

  insert into public.zone_pricing (version_id, zone_code, vlt_percent, price_delta)
  select v_draft, zone_code, vlt_percent, price_delta
    from public.zone_pricing where version_id = v_pub;

  return v_draft;
end;
$$;

create or replace function public.publish_pricing(p_version_id uuid)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_status public.pricing_status;
begin
  perform public._require_admin();
  select status into v_status from public.pricing_versions where id = p_version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'draft' then raise exception 'ILLEGAL_TRANSITION'; end if;

  -- completeness: every active body style priced, every active zone × VLT priced
  if exists (
    select 1 from public.body_styles bs
    where not exists (select 1 from public.pricing_rules pr
                      where pr.version_id = p_version_id and pr.body_style_code = bs.code)
  ) or exists (
    select 1 from public.tint_zones z cross join public.vlt_levels v
    where z.is_active and v.is_active
      and not exists (select 1 from public.zone_pricing zp
                      where zp.version_id = p_version_id
                        and zp.zone_code = z.code and zp.vlt_percent = v.vlt_percent)
  ) then
    raise exception 'PRICING_INCOMPLETE';
  end if;

  update public.pricing_versions set status = 'archived'
    where status = 'published';
  update public.pricing_versions
    set status = 'published', published_at = now()
    where id = p_version_id;
end;
$$;

-- =====================================================================
-- admin: taxonomy leads & clients listing
-- =====================================================================

create or replace function public.resolve_vehicle_request(p_request_id uuid, p_variant_id uuid)
returns void language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  if not exists (select 1 from public.vehicle_variants where id = p_variant_id) then
    raise exception 'NOT_FOUND';
  end if;
  update public.vehicle_requests
    set status = 'resolved', resolved_variant_id = p_variant_id,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id and status = 'new';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

create or replace function public.reject_vehicle_request(p_request_id uuid)
returns void language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  update public.vehicle_requests
    set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id and status = 'new';
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_list_clients(p_search text default null)
returns table (
  id uuid, full_name text, email text, phone text, is_anonymous boolean,
  vehicles_count bigint, bookings_count bigint, last_visit timestamptz, created_at timestamptz
) language sql stable security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.phone, p.is_anonymous,
         (select count(*) from public.vehicles v where v.user_id = p.id),
         (select count(*) from public.bookings b where b.user_id = p.id),
         (select max(b.slot_start) from public.bookings b
            where b.user_id = p.id and b.status = 'completed'),
         p.created_at
    from public.profiles p
    where p.role = 'client'
      and public.is_admin()
      and (
        p_search is null or btrim(p_search) = ''
        or p.full_name ilike '%' || p_search || '%'
        or p.email     ilike '%' || p_search || '%'
        or p.phone     ilike '%' || p_search || '%'
        or exists (select 1 from public.vehicles v
                   where v.user_id = p.id and v.plate ilike '%' || p_search || '%')
      )
    order by p.created_at desc
    limit 200;
$$;

-- =====================================================================
-- grants (deny by default, allow the entry points)
-- =====================================================================
revoke all on function public._require_admin()                              from public;
revoke all on function public._tz()                                         from public;
revoke all on function public._purge_expired_holds()                        from public;
revoke all on function public._compute_quote(uuid, jsonb)                   from public;
revoke all on function public._slot_is_free(int, timestamptz, timestamptz, uuid) from public;
revoke all on function public._day_slots(date, int, uuid)                   from public;
revoke all on function public._transition_allowed(public.booking_status, public.booking_status) from public;
revoke all on function public.quote_booking(uuid, jsonb)                    from public;
revoke all on function public.get_available_slots(date, int)                from public;
revoke all on function public.get_month_availability(int, int, int)         from public;
revoke all on function public.hold_slot(timestamptz, int, int)              from public;
revoke all on function public.release_hold()                                from public;
revoke all on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, boolean, uuid) from public;
revoke all on function public.cancel_booking_client(uuid, text)             from public;
revoke all on function public.reschedule_booking(uuid, uuid, uuid, jsonb, text, text, text, text, boolean, uuid) from public;
revoke all on function public.set_booking_status(uuid, public.booking_status, text) from public;
revoke all on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid) from public;
revoke all on function public.clone_pricing_version()                       from public;
revoke all on function public.publish_pricing(uuid)                         from public;
revoke all on function public.resolve_vehicle_request(uuid, uuid)           from public;
revoke all on function public.reject_vehicle_request(uuid)                  from public;
revoke all on function public.admin_list_clients(text)                      from public;

grant execute on function public.quote_booking(uuid, jsonb)             to anon, authenticated;
grant execute on function public.get_available_slots(date, int)         to anon, authenticated;
grant execute on function public.get_month_availability(int, int, int)  to anon, authenticated;
grant execute on function public.hold_slot(timestamptz, int, int)       to authenticated;
grant execute on function public.release_hold()                         to authenticated;
grant execute on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, boolean, uuid) to authenticated;
grant execute on function public.cancel_booking_client(uuid, text)      to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, uuid, jsonb, text, text, text, text, boolean, uuid) to authenticated;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.admin_create_booking(uuid, jsonb, timestamptz, text, text, text, text, int, uuid, uuid) to authenticated;
grant execute on function public.clone_pricing_version()                to authenticated;
grant execute on function public.publish_pricing(uuid)                  to authenticated;
grant execute on function public.resolve_vehicle_request(uuid, uuid)    to authenticated;
grant execute on function public.reject_vehicle_request(uuid)           to authenticated;
grant execute on function public.admin_list_clients(text)               to authenticated;

-- realtime: clients get their own booking changes, admins get all (RLS applies)
do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception when undefined_object or duplicate_object then
  null; -- publication absent on bare Postgres (tests) or table already added
end $$;
