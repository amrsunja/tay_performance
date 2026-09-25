-- 0019 — one car at a time in the workshop
--
-- Bug: bookings_no_overlap / the hold exclusion were scoped PER BAY. With bay_count > 1 the
-- client calendar listed every hour once per bay, so the same client (or two clients) could
-- book the same time twice (bay 1 + bay 2).
-- Rule now: never two active bookings overlapping in time, whatever the bay or the client.
--   • bookings_no_overlap / booking_holds exclusion → global (bay_index dropped from them)
--   • _slot_is_free ignores the bay
--   • _day_slots emits each start time once (bay 1)
-- bay_index stays on the rows (history / admin display) but no longer creates capacity.
--
-- Pre-flight: if active bookings already overlap, the migration aborts and lists them —
-- move one of each pair (Admin → fiche → « Déplacer », 0018) or cancel it, then re-push.

do $$
declare v_conflicts text;
begin
  select string_agg(a.reference || ' ↔ ' || b.reference, ', ' order by a.slot_start)
    into v_conflicts
    from public.bookings a
    join public.bookings b on a.id < b.id
   where a.status in ('requested','confirmed','in_progress')
     and b.status in ('requested','confirmed','in_progress')
     and tstzrange(a.slot_start, a.slot_end) && tstzrange(b.slot_start, b.slot_end);
  if v_conflicts is not null then
    raise exception 'OVERLAPPING_BOOKINGS: % — déplacez ou annulez l''une de chaque paire, puis relancez la migration', v_conflicts;
  end if;
end $$;

-- ============ bookings: global exclusion ============
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  tstzrange(slot_start, slot_end) with &&
) where (status in ('requested','confirmed','in_progress'));

-- ============ holds: global exclusion ============
do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.booking_holds'::regclass and contype = 'x'
  loop
    execute format('alter table public.booking_holds drop constraint %I', v_name);
  end loop;
end $$;

-- holds live ~10 min: drop expired ones, and of two overlapping live holds keep the oldest
delete from public.booking_holds where expires_at <= now();
delete from public.booking_holds h
 where exists (
   select 1 from public.booking_holds o
    where (o.created_at, o.id) < (h.created_at, h.id)
      and tstzrange(o.slot_start, o.slot_end) && tstzrange(h.slot_start, h.slot_end));

alter table public.booking_holds add constraint booking_holds_no_overlap exclude using gist (
  tstzrange(slot_start, slot_end) with &&
);

-- ============ availability ============
-- p_bay kept in the signature (callers unchanged) but ignored
create or replace function public._slot_is_free(
  p_bay int, p_start timestamptz, p_end timestamptz, p_ignore_user uuid default null
) returns boolean language sql stable security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.bookings b
    where b.status in ('requested','confirmed','in_progress')
      and tstzrange(b.slot_start, b.slot_end) && tstzrange(p_start, p_end)
  ) and not exists (
    select 1 from public.booking_holds h
    where h.expires_at > now()
      and (p_ignore_user is null or h.user_id is distinct from p_ignore_user)
      and tstzrange(h.slot_start, h.slot_end) && tstzrange(p_start, p_end)
  );
$$;

-- each start time once (bay 1) — was one row per bay
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
        and tstzrange(h.slot_start, h.slot_end) && tstzrange(v_gs, v_e)
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
