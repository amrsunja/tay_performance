-- 0015 — finance page support: an admin can remove a booking's amount from the revenue
-- (unpaid job, refund, commercial gesture…). The booking keeps its status and price; the
-- transactions page just stops counting it. Every toggle is traced in the history:
--   revenue|excluded|<reason>   /   revenue|included

alter table public.bookings
  add column if not exists revenue_excluded boolean not null default false,
  add column if not exists revenue_excluded_reason text;

create or replace function public.admin_set_revenue_excluded(p_booking_id uuid, p_excluded boolean, p_reason text default null)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare v public.bookings%rowtype;
begin
  perform public._require_admin();
  select * into v from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.revenue_excluded = coalesce(p_excluded, false) then return; end if;
  update public.bookings
     set revenue_excluded = coalesce(p_excluded, false),
         revenue_excluded_reason = case when coalesce(p_excluded, false) then nullif(btrim(coalesce(p_reason,'')), '') else null end,
         updated_at = now()
   where id = p_booking_id;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking_id, v.status, v.status, auth.uid(),
          case when coalesce(p_excluded, false)
               then 'revenue|excluded|' || coalesce(btrim(p_reason), '')
               else 'revenue|included' end);
end;
$$;

revoke all on function public.admin_set_revenue_excluded(uuid, boolean, text) from public;
grant execute on function public.admin_set_revenue_excluded(uuid, boolean, text) to authenticated;

create index if not exists bookings_finance_idx on public.bookings (slot_start, status) where not revenue_excluded;
