-- 0022 — notification dispatch in code (replaces dashboard Database Webhooks + optional cron)
--
-- Why: the email/SMS pipeline depended on 3 dashboard webhooks + a hand-edited cron file
-- (<PROJECT-REF> placeholder, 1000 ms default timeout, no header if forgotten) — nothing
-- versioned, nothing observable. Now:
--   • AFTER INSERT triggers on bookings / booking_status_history → pg_net → Edge Functions
--   • J-1 reminder cron jobs scheduled here
--   • URL + secrets read from Vault at call time (no project value in the repo)
--   • email_log = idempotency + audit ledger for e-mails (same contract as sms_log)
--
-- One-time, per project (SQL editor):
--   select vault.create_secret('https://<PROJECT-REF>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as WEBHOOK_SECRET>',     'webhook_secret');
--   -- optional, only needed if a function is deployed with verify_jwt = true:
--   select vault.create_secret('<service_role key>',                 'service_role_key');
--
-- A notification failure never rolls back a booking: _notify_edge swallows every error
-- (raise warning) and pg_net is async (queued on commit).

-- ---------- extensions (skipped on a bare Postgres — the test harness) ----------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;

-- ---------- dispatcher ----------
create or replace function public._notify_edge(p_function text, p_payload jsonb)
returns bigint language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_url     text;
  v_secret  text;
  v_auth    text;
  v_headers jsonb;
  v_id      bigint;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return null;                                     -- bare Postgres / pg_net not installed
  end if;

  select max(decrypted_secret) filter (where name = 'project_url'),
         max(decrypted_secret) filter (where name = 'webhook_secret'),
         max(decrypted_secret) filter (where name = 'service_role_key')
    into v_url, v_secret, v_auth
    from vault.decrypted_secrets
   where name in ('project_url', 'webhook_secret', 'service_role_key');

  if v_url is null or v_secret is null then
    raise warning '_notify_edge: Vault secrets project_url / webhook_secret missing — % not called', p_function;
    return null;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  if v_auth is not null then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_auth);
  end if;

  select net.http_post(
           url                  := rtrim(v_url, '/') || '/functions/v1/' || p_function,
           body                 := p_payload,
           headers              := v_headers,
           timeout_milliseconds := 10000)
    into v_id;
  return v_id;
exception when others then
  raise warning '_notify_edge(%) failed: %', p_function, sqlerrm;
  return null;
end;
$$;

revoke all on function public._notify_edge(text, jsonb) from public, anon, authenticated;
grant execute on function public._notify_edge(text, jsonb) to service_role;

-- ---------- triggers (payload = Database Webhook shape, the functions stay compatible) ----------
create or replace function public._trg_notify_booking_insert()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  perform public._notify_edge('send-booking-email', jsonb_build_object(
    'type', 'INSERT', 'schema', 'public', 'table', 'bookings',
    'record', to_jsonb(new), 'old_record', null));
  return null;
end;
$$;

create or replace function public._trg_notify_status_history_insert()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'type', 'INSERT', 'schema', 'public', 'table', 'booking_status_history',
    'record', to_jsonb(new), 'old_record', null);
begin
  -- price|… / revenue|… annotations (from = to, not a reschedule) never notify anyone
  if new.from_status is not distinct from new.to_status
     and coalesce(new.note, '') not like 'reschedule|%' then
    return null;
  end if;
  perform public._notify_edge('send-booking-email', v_payload);
  perform public._notify_edge('send-booking-sms',   v_payload);
  return null;
end;
$$;

revoke all on function public._trg_notify_booking_insert()        from public, anon, authenticated;
revoke all on function public._trg_notify_status_history_insert() from public, anon, authenticated;

-- drop the dashboard webhooks on these tables (supabase_functions.http_request triggers),
-- otherwise every message would be sent twice
do $$
declare r record;
begin
  for r in
    select t.tgname, t.tgrelid::regclass as tbl
      from pg_trigger t
      join pg_proc p      on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
     where not t.tgisinternal
       and t.tgrelid in ('public.bookings'::regclass, 'public.booking_status_history'::regclass)
       and n.nspname = 'supabase_functions' and p.proname = 'http_request'
  loop
    execute format('drop trigger %I on %s', r.tgname, r.tbl);
    raise notice '0022: dropped dashboard webhook % on %', r.tgname, r.tbl;
  end loop;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert on public.bookings
  for each row execute function public._trg_notify_booking_insert();

drop trigger if exists booking_status_history_notify on public.booking_status_history;
create trigger booking_status_history_notify
  after insert on public.booking_status_history
  for each row execute function public._trg_notify_status_history_insert();

-- ---------- e-mail ledger (mirrors sms_log / sms_claim from 0021) ----------
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  kind        text not null check (kind in
                ('received','workshop_new','confirmed','cancelled','completed','rescheduled','reminder')),
  slot_start  timestamptz not null,
  to_email    text not null,
  status      text not null default 'sending' check (status in ('sending','sent','failed')),
  provider_id text,                                 -- Resend id
  error       text,
  attempts    int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (booking_id, kind, slot_start, to_email)
);
create index if not exists email_log_booking_idx on public.email_log (booking_id);

alter table public.email_log enable row level security;
drop policy if exists "email log admin read" on public.email_log;
create policy "email log admin read" on public.email_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.email_log from anon, authenticated;
revoke all on public.email_log from anon;

create or replace function public.email_claim(
  p_booking_id uuid, p_kind text, p_slot_start timestamptz, p_to text
) returns uuid language sql volatile security definer
set search_path = public
as $$
  insert into public.email_log as l (booking_id, kind, slot_start, to_email)
  values (p_booking_id, p_kind, p_slot_start, lower(btrim(p_to)))
  on conflict (booking_id, kind, slot_start, to_email) do update
     set status = 'sending', error = null, attempts = l.attempts + 1, updated_at = now()
   where l.status = 'failed'
      or (l.status = 'sending' and l.updated_at < now() - interval '10 minutes')
  returning l.id
$$;

revoke all on function public.email_claim(uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.email_claim(uuid, text, timestamptz, text) to service_role;

-- ---------- J-1 reminders (16:00 UTC = 18:00 Paris summer / 17:00 winter) ----------
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice '0022: pg_cron not available — reminder jobs not scheduled';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job
   where jobname in ('booking-reminder-j1', 'booking-sms-reminder-j1');
  perform cron.schedule('booking-reminder-j1', '0 16 * * *',
    $c$select public._notify_edge('send-booking-email', '{"type":"reminder"}'::jsonb)$c$);
  perform cron.schedule('booking-sms-reminder-j1', '0 16 * * *',
    $c$select public._notify_edge('send-booking-sms', '{"type":"reminder"}'::jsonb)$c$);
end $$;
