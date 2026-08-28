-- 0014 — admin: change the price of an existing booking (traced in the history, visible to
--        the client) + step BACK in the status lifecycle.
--
-- History rows for a price change use from_status = to_status = current status and a
-- machine-readable note:  price|<old>|<new>|<reason>
-- (the UI renders it as "Prix modifié : 240,00 € → 199,90 € — <reason>").

-- ---------- reversible transitions ----------
-- forward (unchanged) + one step back, and re-opening a closed booking
create or replace function public._transition_allowed(p_from public.booking_status, p_to public.booking_status)
returns boolean language sql immutable
as $$
  select case p_from
    when 'requested'   then p_to in ('confirmed','cancelled')
    when 'confirmed'   then p_to in ('in_progress','cancelled','no_show','requested')
    when 'in_progress' then p_to in ('completed','cancelled','confirmed')
    when 'completed'   then p_to in ('in_progress')
    when 'cancelled'   then p_to in ('requested','confirmed')
    when 'no_show'     then p_to in ('confirmed')
    else false
  end
$$;

-- re-activating a booking must re-check the bay: the exclusion constraint only covers
-- active statuses, so an UPDATE back to requested/confirmed can collide with a newer booking
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

  begin
    update public.bookings set status = p_status where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, p_status, auth.uid(), nullif(btrim(coalesce(p_note,'')), ''));
end;
$$;

-- ---------- price change ----------
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
  if v_new = v_booking.price_total then
    return jsonb_build_object('price_total', v_booking.price_total, 'changed', false);
  end if;

  -- the original computed total is kept once, forever
  v_computed := coalesce((v_booking.price_breakdown->>'computed_total')::numeric, v_booking.price_total);

  update public.bookings
     set price_total = v_new,
         price_overridden = (v_new <> v_computed),
         price_breakdown = price_breakdown
           || jsonb_build_object('computed_total', v_computed, 'total', v_new,
                                 'overridden_by', auth.uid(), 'overridden_at', now()),
         updated_at = now()
   where id = p_booking_id;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v_booking.status, v_booking.status, auth.uid(),
          'price|' || v_booking.price_total::text || '|' || v_new::text || '|' || coalesce(btrim(p_reason), ''));

  return jsonb_build_object('price_total', v_new, 'previous', v_booking.price_total,
                            'computed_total', v_computed, 'changed', true);
end;
$$;

revoke all on function public.admin_set_booking_price(uuid, numeric, text) from public;
grant execute on function public.admin_set_booking_price(uuid, numeric, text) to authenticated;
