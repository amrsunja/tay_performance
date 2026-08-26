-- OPTIONAL — run once on the HOSTED project (SQL editor) after deploying the
-- send-booking-email Edge Function. Not a migration: it embeds project-specific
-- values. Replace <PROJECT-REF> and store the secrets in Vault first:
--
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--   select vault.create_secret('<same-value-as-WEBHOOK_SECRET>', 'webhook_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) J-1 reminder — every day at 18:00 Europe/Paris (16:00 UTC in summer, adjust in winter
--    or keep 17:00 UTC year-round for simplicity)
select cron.schedule(
  'booking-reminder-j1',
  '0 17 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/send-booking-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body    := '{"type":"reminder"}'::jsonb
  );
  $$
);

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
