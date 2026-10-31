-- 0023 — personalized reservations (« demandes de devis ») + admin SMS alerts
--
-- Model: a request has no date, a booking always has one.
--   service_requests  what the client asks for (no slot) — status new → confirmed | declined | cancelled
--   bookings          on confirmation the admin creates a REAL booking linked to the request, so a
--                     custom job gets everything a tint booking has for free: agenda, status
--                     lifecycle, history, drawer, finance, « Mes réservations », e-mail + SMS, J-1.
--   bookings.custom_title is not null ⇔ custom booking (no variant, no specs, no pricing version).
--
-- Also here:
--   • contact_name optional when the ADMIN creates a booking (clients still must give it)
--   • admin bookings attach to the client whose VERIFIED phone matches → visible in his portal
--   • private_settings: admin's alert phone — app_settings is public-readable, this is not
--   • notification_log: idempotency ledger for events that are not (booking, slot) shaped
--   • _day_slots: a client's own hold no longer unlocks the taken slots overlapping it

alter type public.service_type add value if not exists 'custom';

-- ============ requests ============
create type public.service_request_status as enum ('new','confirmed','declined','cancelled');
create sequence if not exists public.service_request_ref_seq start 1000;

create table public.service_requests (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  user_id       uuid references public.profiles(id) on delete set null,
  service_label text not null check (char_length(service_label) between 2 and 80),
  vehicle_text  text check (vehicle_text is null or char_length(vehicle_text) <= 200),
  message       text not null check (char_length(message) between 10 and 2000),
  contact_name  text check (contact_name is null or char_length(contact_name) between 1 and 200),
  contact_phone text not null check (char_length(contact_phone) between 5 and 40),
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status        public.service_request_status not null default 'new',
  admin_reply   text check (admin_reply is null or char_length(admin_reply) <= 1000),  -- decline reason, client-visible
  handled_by    uuid references public.profiles(id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index service_requests_status_idx on public.service_requests (status, created_at desc);
create index service_requests_user_idx   on public.service_requests (user_id, created_at desc);
create trigger service_requests_touch before update on public.service_requests
  for each row execute function public.touch_updated_at();

alter table public.service_requests enable row level security;
create policy "own service requests read" on public.service_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- every write goes through the RPCs below
revoke insert, update, delete on public.service_requests from anon, authenticated;
revoke all on public.service_requests from anon;

-- ============ bookings: custom fields ============
alter table public.bookings
  add column if not exists custom_title       text check (custom_title is null or char_length(custom_title) between 2 and 200),
  add column if not exists custom_vehicle     text check (custom_vehicle is null or char_length(custom_vehicle) <= 200),
  add column if not exists admin_message      text check (admin_message is null or char_length(admin_message) <= 1000),
  add column if not exists service_request_id uuid unique references public.service_requests(id) on delete set null;

alter table public.bookings alter column variant_id         drop not null;
alter table public.bookings alter column pricing_version_id drop not null;
alter table public.bookings alter column contact_name       drop not null;
alter table public.bookings add constraint bookings_tint_or_custom
  check (custom_title is not null or (variant_id is not null and pricing_version_id is not null));

-- ============ private settings (admin + service role only) ============
create table public.private_settings (
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.private_settings enable row level security;
create policy "private settings admin read"   on public.private_settings for select to authenticated using (public.is_admin());
create policy "private settings admin insert" on public.private_settings for insert to authenticated with check (public.is_admin());
create policy "private settings admin update" on public.private_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "private settings admin delete" on public.private_settings for delete to authenticated using (public.is_admin());
revoke all on public.private_settings from anon;

-- ============ notification ledger ============
create table public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  event_key   text not null,                       -- e.g. admin:booking:<id>:new
  channel     text not null check (channel in ('sms','email')),
  to_addr     text,
  status      text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  provider_id text,
  error       text,
  attempts    int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_key, channel)
);
alter table public.notification_log enable row level security;
create policy "notification log admin read" on public.notification_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.notification_log from anon, authenticated;
revoke all on public.notification_log from anon;

-- same contract as sms_claim: returns the row to send with, or null = already handled
create or replace function public.notify_claim(p_event_key text, p_channel text, p_to text)
returns uuid language sql volatile security definer
set search_path = public
as $$
  insert into public.notification_log as l (event_key, channel, to_addr)
  values (p_event_key, p_channel, p_to)
  on conflict (event_key, channel) do update
     set status = 'sending', to_addr = excluded.to_addr, error = null,
         attempts = l.attempts + 1, updated_at = now()
   where l.status = 'failed'
      or (l.status = 'sending' and l.updated_at < now() - interval '10 minutes')
  returning l.id
$$;
revoke all on function public.notify_claim(text, text, text) from public, anon, authenticated;
grant execute on function public.notify_claim(text, text, text) to service_role;

-- ============ availability: own hold ============
-- held_by_me = exactly the slot the client holds. Before, every slot OVERLAPPING his hold came
-- back selectable, including ones overlapping another client's booking (click → SLOT_TAKEN and
-- the hold was lost). Those slots are now judged like any other, own hold ignored.
create or replace function public._day_slots(p_day date, p_duration_min int, p_user uuid)
returns table (slot_start timestamptz, slot_end timestamptz, bay_index int, state text)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_tz     text := public._tz();
  v_gran   int  := coalesce(public._setting_int('slot_granularity_min'), 30);
  v_lead   int  := coalesce(public._setting_int('min_lead_time_hours'), 0);
  v_hours  public.workshop_hours%rowtype;
  v_open   timestamptz;
  v_close  timestamptz;
  v_min    timestamptz := now() + make_interval(hours => v_lead);
  v_gs     timestamptz;
  v_e      timestamptz;
begin
  select * into v_hours from public.workshop_hours
    where weekday = extract(isodow from p_day)::int;
  if not found or not v_hours.is_open then return; end if;
  if exists (select 1 from public.blackout_dates where day = p_day) then return; end if;

  v_open  := (p_day + v_hours.open_time)  at time zone v_tz;
  v_close := (p_day + v_hours.close_time) at time zone v_tz;
  if v_open + make_interval(mins => p_duration_min) > v_close then return; end if;

  for v_gs in
    select gs from generate_series(
      v_open,
      v_close - make_interval(mins => p_duration_min),
      make_interval(mins => v_gran)
    ) gs
  loop
    v_e        := v_gs + make_interval(mins => p_duration_min);
    slot_start := v_gs;
    slot_end   := v_e;
    bay_index  := 1;
    if v_gs < v_min then
      state := 'taken';
    elsif p_user is not null and exists (
      select 1 from public.booking_holds h
      where h.user_id = p_user and h.expires_at > now()
        and h.slot_start = v_gs and h.slot_end = v_e
    ) then
      state := 'held_by_me';
    elsif public._slot_is_free(1, v_gs, v_e, p_user) then
      state := 'available';
    else
      state := 'taken';
    end if;
    return next;
  end loop;
end;
$$;

-- ============ helpers ============
-- The client whose VERIFIED phone (auth.users, not the editable profile) matches — only when unambiguous.
create or replace function public._user_id_for_phone(p_phone text)
returns uuid language sql stable security definer
set search_path = public
as $$
  select min(u.id::text)::uuid
    from auth.users u
    join public.profiles p on p.id = u.id and p.role = 'client'
   where u.phone is not null and u.phone <> ''
     and public._phone_key(u.phone) = public._phone_key(p_phone)
  having count(*) = 1
$$;

create or replace function public._create_custom_booking(
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
  p_history_note   text
) returns public.bookings language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
  v_phone   text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_end     timestamptz;
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
  if not public._slot_is_free(1, p_slot_start, v_end) then raise exception 'SLOT_TAKEN'; end if;

  begin
    insert into public.bookings (
      reference, user_id, service_type, bay_index, slot_start, slot_end, duration_min, status,
      price_total, price_breakdown, contact_name, contact_phone, contact_email, client_notes,
      created_by_admin, custom_title, custom_vehicle, admin_message, service_request_id
    ) values (
      public.next_booking_reference(), p_user_id, 'custom', 1, p_slot_start, v_end, p_duration_min, 'confirmed',
      round(p_price, 2), jsonb_build_object('custom', true, 'total', round(p_price, 2)),
      nullif(btrim(coalesce(p_contact_name, '')), ''), v_phone,
      nullif(lower(btrim(coalesce(p_contact_email, ''))), ''),
      nullif(btrim(coalesce(p_client_notes, '')), ''), true, v_title,
      nullif(btrim(coalesce(p_vehicle, '')), ''), nullif(btrim(coalesce(p_admin_message, '')), ''), p_request_id
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

-- ============ client RPCs ============
create or replace function public.create_service_request(
  p_service_label text,
  p_message       text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_name  text default null,
  p_vehicle       text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
  v_phone   text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_email   text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_name    text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_row     public.service_requests%rowtype;
begin
  if v_uid is null then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(coalesce(p_service_label, ''))) not between 2 and 80 then raise exception 'INVALID_TITLE'; end if;
  if char_length(v_message) not between 10 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  if v_phone is null or char_length(v_phone) < 8 then raise exception 'PHONE_REQUIRED'; end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL_REQUIRED'; end if;

  -- each request texts the admin: an anonymous session must not be able to spam him
  if (select count(*) from public.service_requests where user_id = v_uid and status = 'new') >= 3
     or (select count(*) from public.service_requests where user_id = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  insert into public.service_requests (reference, user_id, service_label, vehicle_text, message, contact_name, contact_phone, contact_email)
  values ('DV-' || extract(year from now())::int || '-' || nextval('public.service_request_ref_seq'),
          v_uid, btrim(p_service_label), nullif(btrim(coalesce(p_vehicle, '')), ''), v_message, v_name, v_phone, v_email)
  returning * into v_row;

  -- keep the profile's contact fresh without overwriting what he already set
  update public.profiles
     set full_name = coalesce(full_name, v_name), phone = coalesce(phone, v_phone), email = coalesce(email, v_email)
   where id = v_uid;

  return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'status', v_row.status);
end;
$$;

create or replace function public.cancel_service_request(p_request_id uuid)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare v_status public.service_request_status;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.service_requests
    where id = p_request_id and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'new' then raise exception 'ILLEGAL_TRANSITION'; end if;
  update public.service_requests set status = 'cancelled', handled_at = now() where id = p_request_id;
end;
$$;

-- ============ admin RPCs ============
create or replace function public.admin_confirm_service_request(
  p_request_id    uuid,
  p_title         text,
  p_slot_start    timestamptz,
  p_duration_min  int,
  p_price         numeric default null,
  p_admin_message text default null,
  p_contact_name  text default null,
  p_vehicle       text default null
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
    'devis confirmé · ' || v_req.reference);

  update public.service_requests
     set status = 'confirmed', handled_by = auth.uid(), handled_at = now()
   where id = p_request_id;

  return jsonb_build_object('id', v_booking.id, 'reference', v_booking.reference,
                            'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end);
end;
$$;

create or replace function public.admin_decline_service_request(p_request_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare v_status public.service_request_status;
begin
  perform public._require_admin();
  select status into v_status from public.service_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'new' then raise exception 'ILLEGAL_TRANSITION'; end if;
  update public.service_requests
     set status = 'declined', admin_reply = nullif(btrim(coalesce(p_reason, '')), ''),
         handled_by = auth.uid(), handled_at = now()
   where id = p_request_id;
end;
$$;

create or replace function public.admin_create_custom_booking(
  p_title         text,
  p_slot_start    timestamptz,
  p_duration_min  int,
  p_contact_phone text,
  p_contact_name  text default null,
  p_contact_email text default null,
  p_client_notes  text default null,
  p_vehicle       text default null,
  p_price         numeric default null,
  p_admin_message text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare v_booking public.bookings%rowtype;
begin
  perform public._require_admin();
  v_booking := public._create_custom_booking(
    p_title, p_slot_start, p_duration_min, p_contact_name, p_contact_phone, p_contact_email,
    p_client_notes, p_vehicle, p_price, p_admin_message,
    public._user_id_for_phone(p_contact_phone), null,
    'création manuelle admin · prestation personnalisée');
  return jsonb_build_object('id', v_booking.id, 'reference', v_booking.reference,
                            'slot_start', v_booking.slot_start, 'slot_end', v_booking.slot_end);
end;
$$;

-- admin tint booking: name optional + attach to the client with this verified phone (signature unchanged)
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
      public.next_booking_reference(), coalesce(p_user_id, public._user_id_for_phone(p_contact_phone)), p_vehicle_id, p_variant_id, p_bay,
      p_slot_start, p_slot_start + make_interval(mins => v_duration),
      v_duration, 'confirmed', v_flag,
      v_total, v_breakdown,
      (v_quote->'breakdown'->>'pricing_version_id')::uuid, v_override,
      nullif(btrim(coalesce(p_contact_name,'')), ''), btrim(p_contact_phone), nullif(btrim(coalesce(p_contact_email,'')), ''),
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

-- ============ notification triggers ============
-- bookings INSERT now also reaches send-booking-sms (admin alert on a new client booking)
create or replace function public._trg_notify_booking_insert()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'type', 'INSERT', 'schema', 'public', 'table', 'bookings',
    'record', to_jsonb(new), 'old_record', null);
begin
  perform public._notify_edge('send-booking-email', v_payload);
  perform public._notify_edge('send-booking-sms',   v_payload);
  return null;
end;
$$;

create or replace function public._trg_notify_service_request()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare v_payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  v_payload := jsonb_build_object(
    'type', tg_op, 'schema', 'public', 'table', 'service_requests',
    'record', to_jsonb(new), 'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end);
  perform public._notify_edge('send-booking-email', v_payload);
  perform public._notify_edge('send-booking-sms',   v_payload);
  return null;
end;
$$;
revoke all on function public._trg_notify_service_request() from public, anon, authenticated;

create trigger service_requests_notify
  after insert or update on public.service_requests
  for each row execute function public._trg_notify_service_request();

-- ============ grants ============
revoke all on function public._user_id_for_phone(text) from public, anon, authenticated;
revoke all on function public._create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_service_request(text, text, text, text, text, text) from public;
revoke all on function public.cancel_service_request(uuid) from public;
revoke all on function public.admin_confirm_service_request(uuid, text, timestamptz, int, numeric, text, text, text) from public;
revoke all on function public.admin_decline_service_request(uuid, text) from public;
revoke all on function public.admin_create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text) from public;
grant execute on function public.create_service_request(text, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_service_request(uuid) to authenticated;
grant execute on function public.admin_confirm_service_request(uuid, text, timestamptz, int, numeric, text, text, text) to authenticated;
grant execute on function public.admin_decline_service_request(uuid, text) to authenticated;
grant execute on function public.admin_create_custom_booking(text, timestamptz, int, text, text, text, text, text, numeric, text) to authenticated;

-- ============ realtime: the Devis tab and the client portal refresh live (RLS applies) ============
do $$
begin
  alter publication supabase_realtime add table public.service_requests;
exception when undefined_object or duplicate_object then
  null; -- publication absent on bare Postgres (tests) or table already added
end $$;
