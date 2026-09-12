-- 0016 — pricing v2 (client tarif sheet, 2026-08-30)
--
-- The v1 formula (base + Σ delta(zone, VLT) + minutes × rate + film limousine) cannot express
-- the workshop's real price list, which is per BODY STYLE and per PACK:
--   • « Vitres arrière » = 3 rear windows (2 latérales + lunette) sold as ONE zone
--   • « Vitres avant »   = the 2 front side windows
--   • « Pare-brise »     = from 180 €, depends on the car size
--   • TLV (VLT) never changes the price · no limousine supplement
--   • per-model override (Tesla Model 3 : arrière 200 € / avant 80 €)
--   • utilitaire / pick-up : « sur devis » — the booking is taken WITHOUT a price, the admin
--     analyses the car and sets it (admin_set_booking_price), then the client sees it
--   • duration = pose time per body style (variant.base_labor_minutes) split 60 % arrière /
--     40 % avant, + fixed minutes for the pare-brise
-- New formula:  total = Σ price(zone, body style | model override)   (null when sur devis)

-- ============ body styles: pose time + "sur devis" ============
alter table public.body_styles
  add column if not exists quote_on_request boolean not null default false;

update public.body_styles set quote_on_request = (code in ('utilitaire','pickup'));

-- default_labor_minutes now = FULL pose time avant + arrière (was a small "surcoût")
update public.body_styles set default_labor_minutes = v.m
from (values
  ('citadine_3p'::public.body_style_code, 80), ('citadine_5p', 90), ('coupe_2p', 100), ('berline_4p', 120),
  ('break_5p', 120), ('monospace', 150), ('suv_5p', 150), ('utilitaire', 150), ('pickup', 150)
) as v(code, m)
where body_styles.code = v.code;

-- every existing variant carried the old surcoût → realign on the body-style pose time
update public.vehicle_variants vv
   set base_labor_minutes = bs.default_labor_minutes
  from public.body_styles bs
 where bs.code = vv.body_style_code;

-- ============ per-model price overrides (Tesla Model 3 …) ============
alter table public.models
  add column if not exists rear_price_override       numeric(10,2) check (rear_price_override is null or rear_price_override >= 0),
  add column if not exists front_price_override      numeric(10,2) check (front_price_override is null or front_price_override >= 0),
  add column if not exists windshield_price_override numeric(10,2) check (windshield_price_override is null or windshield_price_override >= 0);

update public.models mo
   set rear_price_override = 200.00, front_price_override = 80.00
  from public.makes mk
 where mk.id = mo.make_id
   and public.norm_text(mk.name) = 'tesla'
   and public.norm_text(mo.name) in ('model 3', 'model3');

-- ============ zones: packs + time split ============
alter table public.tint_zones drop constraint if exists tint_zones_base_minutes_check;
alter table public.tint_zones add constraint tint_zones_base_minutes_check check (base_minutes between 0 and 240);
alter table public.tint_zones
  add column if not exists time_share_pct int not null default 0 check (time_share_pct between 0 and 100);

update public.tint_zones set
  label_fr = 'Vitres arrière', detail_fr = '(latérales + lunette · 3 vitres)',
  base_minutes = 0, time_share_pct = 60
 where code = 'rear_sides';
update public.tint_zones set
  label_fr = 'Vitres avant', detail_fr = '(2 vitres latérales)',
  base_minutes = 0, time_share_pct = 40
 where code = 'front_sides';
update public.tint_zones set base_minutes = 40, time_share_pct = 0 where code = 'pare_brise';
-- lunette merged into the rear pack · toit panoramique not sold
update public.tint_zones set is_active = false where code in ('rear_window', 'panoramic_roof');

-- ============ TLV levels: 5 · 15 · 20 · 35 · 50 · 70 ============
insert into public.vlt_levels (vlt_percent, label_fr) values (15, '15% — Très foncé')
  on conflict (vlt_percent) do update set is_active = true;
update public.vlt_levels set is_active = (vlt_percent in (5, 15, 20, 35, 50, 70));

-- ============ pricing rules: per body style packs ============
alter table public.pricing_rules
  add column if not exists rear_price       numeric(10,2) not null default 0 check (rear_price >= 0),
  add column if not exists front_price      numeric(10,2) not null default 0 check (front_price >= 0),
  add column if not exists windshield_price numeric(10,2) not null default 0 check (windshield_price >= 0);

-- client tarif sheet (arrière / avant) · pare-brise from 180 € by size class
update public.pricing_rules pr set rear_price = v.r, front_price = v.f, windshield_price = v.w
from (values
  ('citadine_3p'::public.body_style_code, 130, 70, 180),
  ('citadine_5p', 150, 70, 180),
  ('coupe_2p',    140, 80, 200),
  ('berline_4p',  170, 80, 200),
  ('break_5p',    180, 70, 220),
  ('monospace',   250, 80, 220),
  ('suv_5p',      180, 80, 240),
  ('utilitaire',    0,  0,   0),   -- sur devis
  ('pickup',        0,  0,   0)    -- sur devis
) as v(code, r, f, w)
where pr.body_style_code = v.code;

drop view if exists public.v_current_pricing_rules;
drop view if exists public.v_current_zone_pricing;
alter table public.pricing_rules drop column if exists base_price;
alter table public.pricing_rules drop column if exists labor_rate_per_min;
drop table if exists public.zone_pricing;
delete from public.app_settings where key in ('limo_vlt_threshold', 'limo_supplement');

create or replace view public.v_current_pricing_rules
with (security_invoker = on) as
  select pr.* from public.pricing_rules pr
  where pr.version_id = public.current_pricing_version_id();

-- ============ bookings: price may be pending (sur devis) ============
alter table public.bookings alter column price_total drop not null;

-- ============ quote v2 ============
create or replace function public._compute_quote(p_variant_id uuid, p_specs jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_version_id  uuid;
  v_variant     record;
  v_rule        public.pricing_rules%rowtype;
  v_model       record;
  v_gran        int := coalesce(public._setting_int('slot_granularity_min'), 30);
  v_specs       jsonb := '[]'::jsonb;
  v_spec        record;
  v_zones_total numeric := 0;
  v_minutes_raw numeric := 0;
  v_duration    int;
  v_compliant   boolean := true;
  v_on_request  boolean;
  v_overridden  boolean := false;
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

  select vv.id, vv.body_style_code, vv.base_labor_minutes, bs.quote_on_request, g.model_id
    into v_variant
    from public.vehicle_variants vv
    join public.body_styles bs on bs.code = vv.body_style_code
    join public.generations g on g.id = vv.generation_id
    where vv.id = p_variant_id and vv.is_active;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  v_on_request := v_variant.quote_on_request;

  select pr.* into v_rule
    from public.pricing_rules pr
    where pr.version_id = v_version_id and pr.body_style_code = v_variant.body_style_code;
  if not found then
    raise exception 'PRICING_INCOMPLETE';
  end if;

  select mo.rear_price_override, mo.front_price_override, mo.windshield_price_override
    into v_model
    from public.models mo where mo.id = v_variant.model_id;

  for v_spec in
    select (e->>'zone_code')::public.tint_zone_code as zone_code,
           (e->>'vlt_percent')::int                 as vlt_percent
      from jsonb_array_elements(p_specs) e
  loop
    declare
      v_zone    public.tint_zones%rowtype;
      v_vlt     public.vlt_levels%rowtype;
      v_price   numeric;
      v_minutes int;
      v_legal   boolean;
    begin
      select * into v_zone from public.tint_zones where code = v_spec.zone_code and is_active;
      if not found then raise exception 'INVALID_SPECS'; end if;
      select * into v_vlt from public.vlt_levels where vlt_percent = v_spec.vlt_percent and is_active;
      if not found then raise exception 'INVALID_SPECS'; end if;

      -- price per pack (body style), overridable per model; TLV never changes the price
      v_price := case v_zone.code
        when 'rear_sides'  then coalesce(v_model.rear_price_override,       v_rule.rear_price)
        when 'front_sides' then coalesce(v_model.front_price_override,      v_rule.front_price)
        when 'pare_brise'  then coalesce(v_model.windshield_price_override, v_rule.windshield_price)
        else 0 end;
      if (v_zone.code = 'rear_sides'  and v_model.rear_price_override       is not null)
      or (v_zone.code = 'front_sides' and v_model.front_price_override      is not null)
      or (v_zone.code = 'pare_brise'  and v_model.windshield_price_override is not null) then
        v_overridden := true;
      end if;
      if v_on_request then v_price := 0; end if;

      v_minutes := v_zone.base_minutes
                 + round(v_variant.base_labor_minutes * v_zone.time_share_pct / 100.0)::int;

      v_legal := (not v_zone.is_front) or v_vlt.is_front_legal;
      if not v_legal then v_compliant := false; end if;

      v_zones_total := v_zones_total + v_price;
      v_minutes_raw := v_minutes_raw + v_minutes;
      v_specs := v_specs || jsonb_build_object(
        'zone_code',   v_zone.code,
        'vlt_percent', v_spec.vlt_percent,
        'delta',       v_price,
        'minutes',     v_minutes,
        'is_legal',    v_legal,
        'label_fr',    v_zone.label_fr
      );
    end;
  end loop;

  v_duration := greatest(v_gran, (ceil(v_minutes_raw / v_gran) * v_gran)::int);

  return jsonb_build_object(
    'variant_id',   p_variant_id,
    'duration_min', v_duration,
    'compliant',    v_compliant,
    'on_request',   v_on_request,
    'specs',        v_specs,
    'breakdown', jsonb_build_object(
      'zones',          v_zones_total,
      'total',          case when v_on_request then null else round(v_zones_total, 2) end,
      'on_request',     v_on_request,
      'model_override', v_overridden,
      'pricing_version_id', v_version_id
    )
  );
end;
$$;

-- ============ pricing versioning (no zone grid any more) ============
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

  insert into public.pricing_rules (version_id, body_style_code, rear_price, front_price, windshield_price)
  select v_draft, body_style_code, rear_price, front_price, windshield_price
    from public.pricing_rules where version_id = v_pub;

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

  if exists (
    select 1 from public.body_styles bs
    where not exists (select 1 from public.pricing_rules pr
                      where pr.version_id = p_version_id and pr.body_style_code = bs.code)
  ) then
    raise exception 'PRICING_INCOMPLETE';
  end if;

  update public.pricing_versions set status = 'archived' where status = 'published';
  update public.pricing_versions set status = 'published', published_at = now() where id = p_version_id;
end;
$$;

-- admin: per-model special prices (null = body-style price)
create or replace function public.admin_save_model_prices(
  p_model_id uuid, p_rear numeric default null, p_front numeric default null, p_windshield numeric default null)
returns void language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  update public.models
     set rear_price_override       = p_rear,
         front_price_override      = p_front,
         windshield_price_override = p_windshield
   where id = p_model_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

-- models carrying an override (public: the configurator needs them for the live quote)
create or replace function public.list_model_price_overrides()
returns table (model_id uuid, make_name text, model_name text,
               rear_price numeric, front_price numeric, windshield_price numeric)
language sql stable security definer
set search_path = public
as $$
  select mo.id, mk.name, mo.name, mo.rear_price_override, mo.front_price_override, mo.windshield_price_override
    from public.models mo join public.makes mk on mk.id = mo.make_id
   where mo.rear_price_override is not null
      or mo.front_price_override is not null
      or mo.windshield_price_override is not null
   order by mk.name, mo.name;
$$;

-- ============ admin booking: price override when the quote is "sur devis" ============
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

-- admin_set_booking_price: first price of a "sur devis" booking = not an override, history note keeps '' as old
create or replace function public.admin_set_booking_price(p_booking_id uuid, p_price numeric, p_reason text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_booking  public.bookings%rowtype;
  v_new      numeric := round(p_price, 2);
  v_computed numeric;
begin
  perform public._require_admin();
  if p_price is null or p_price < 0 or p_price > 100000 then raise exception 'INVALID_INPUT'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.status in ('cancelled','no_show') then raise exception 'ILLEGAL_TRANSITION'; end if;
  if v_booking.price_total is not null and v_new = v_booking.price_total then
    return jsonb_build_object('price_total', v_booking.price_total, 'changed', false);
  end if;

  -- the original computed total is kept once, forever (null for a "sur devis" booking)
  v_computed := coalesce((v_booking.price_breakdown->>'computed_total')::numeric, v_booking.price_total);

  update public.bookings
     set price_total = v_new,
         price_overridden = (v_computed is not null and v_new <> v_computed),
         price_breakdown = price_breakdown
           || jsonb_build_object('computed_total', v_computed, 'total', v_new,
                                 'overridden_by', auth.uid(), 'overridden_at', now()),
         updated_at = now()
   where id = p_booking_id;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, v_booking.status, auth.uid(),
          'price|' || coalesce(v_booking.price_total::text, '') || '|' || v_new::text || '|' || coalesce(btrim(p_reason), ''));

  return jsonb_build_object('price_total', v_new, 'previous', v_booking.price_total,
                            'computed_total', v_computed, 'changed', true);
end;
$$;

-- ============ admin clients: phone search (digits only, 06… ≡ +336…) ============
-- "06 12 44 09 31" · "+33612440931" · "0033612440931" → "612440931"
create or replace function public._phone_key(t text)
returns text language sql immutable strict parallel safe
as $$ select regexp_replace(regexp_replace(t, '[^0-9]', '', 'g'), '^(0033|33|0)', '') $$;

create or replace function public.admin_list_clients(p_search text default null)
returns table (
  id uuid, full_name text, email text, phone text, is_anonymous boolean,
  vehicles_count bigint, bookings_count bigint, last_visit timestamptz, created_at timestamptz
) language sql stable security definer
set search_path = public
as $$
  with s as (
    select nullif(btrim(coalesce(p_search, '')), '') as txt,
           nullif(public._phone_key(coalesce(p_search, '')), '') as digits
  )
  select p.id, p.full_name, p.email, p.phone, p.is_anonymous,
         (select count(*) from public.vehicles v where v.user_id = p.id),
         (select count(*) from public.bookings b where b.user_id = p.id),
         (select max(b.slot_start) from public.bookings b
            where b.user_id = p.id and b.status = 'completed'),
         p.created_at
    from public.profiles p, s
    where p.role = 'client'
      and public.is_admin()
      and (
        s.txt is null
        or p.full_name ilike '%' || s.txt || '%'
        or p.email     ilike '%' || s.txt || '%'
        or (s.digits is not null and char_length(s.digits) >= 3
            and (public._phone_key(coalesce(p.phone, '')) like '%' || s.digits || '%'
                 or exists (select 1 from public.bookings b
                             where b.user_id = p.id
                               and public._phone_key(b.contact_phone) like '%' || s.digits || '%')))
        or exists (select 1 from public.vehicles v
                   where v.user_id = p.id and v.plate ilike '%' || s.txt || '%')
      )
    order by p.created_at desc
    limit 200;
$$;

-- ============ grants ============
revoke all on function public.admin_save_model_prices(uuid, numeric, numeric, numeric) from public;
revoke all on function public.list_model_price_overrides()                           from public;
revoke all on function public._phone_key(text)                                       from public;
grant execute on function public.admin_save_model_prices(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.list_model_price_overrides()                           to anon, authenticated;
