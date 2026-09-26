-- OPTIONAL — housekeeping jobs, run once on the HOSTED project (SQL editor).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) J-1 reminders (email + SMS) — moved to migration 0022_notification_dispatch.sql
--    (scheduled by `supabase db push`, URL + secret read from Vault). Do not re-add them here.

-- 2) Expired holds sweep (holds are also purged inline by the RPCs — this is belt & braces)
select cron.schedule(
  'purge-expired-holds',
  '*/10 * * * *',
  $$ delete from public.booking_holds where expires_at < now(); $$
);

-- 3) Stale anonymous users with zero footprint, older than 30 days
select cron.schedule(
  'purge-stale-anonymous-users',
  '30 3 * * *',
  $$
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and not exists (select 1 from public.bookings b where b.user_id = u.id)
    and not exists (select 1 from public.vehicles v where v.user_id = u.id)
    and not exists (select 1 from public.vehicle_requests r where r.user_id = u.id);
  $$
);
