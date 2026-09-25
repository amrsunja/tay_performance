-- 0018 — admin: move a booking to another date / time
--
-- Same booking row (same reference, price, specs, status), new slot_start; the duration is
-- kept. The move is traced in booking_status_history — visible to the client in
-- « Mes réservations » — with from_status = to_status = current status and a
-- machine-readable note (same convention as price|… in 0014):
--   reschedule|<old ISO start>|<new ISO start>|<reason>
-- The send-booking-email webhook turns that row into a « rendez-vous déplacé » e-mail.
-- bookings.rescheduled_at flags moved bookings so the client card can show a notice
-- without fetching every history.

alter table public.bookings add column if not exists rescheduled_at timestamptz;

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
       set slot_start = p_new_start, slot_end = v_end, rescheduled_at = now(), updated_at = now()
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

revoke all on function public.admin_reschedule_booking(uuid, timestamptz, text) from public;
grant execute on function public.admin_reschedule_booking(uuid, timestamptz, text) to authenticated;
