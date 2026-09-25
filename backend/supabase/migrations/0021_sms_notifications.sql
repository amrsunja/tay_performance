-- 0021 — client SMS notifications (Twilio, Edge Function send-booking-sms)
--
-- Three messages, all to bookings.contact_phone (the person who comes to the workshop):
--   confirmed  — admin moves the booking to `confirmed`           (webhook on booking_status_history)
--   reminder   — J-1, only for bookings made ≥ sms_reminder_min_lead_days before the RDV
--                (pg_cron → function → sms_reminder_candidates())
--   completed  — `in_progress → completed`: thanks + Google review link
--
-- sms_log is the idempotency ledger: one row per (booking, kind, slot_start). Webhook retries,
-- a double cron run or a confirmed → requested → confirmed toggle never re-send; a reschedule
-- (new slot_start) legitimately gets its own reminder. Failed (or stuck > 10 min) sends are
-- re-claimable.

-- ---------- ledger ----------
create table if not exists public.sms_log (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  kind         text not null check (kind in ('confirmed','reminder','completed')),
  slot_start   timestamptz not null,           -- the slot the message was about
  to_phone     text,                           -- E.164 actually used (null = invalid number)
  status       text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  provider_sid text,                           -- Twilio SM… id
  error        text,
  attempts     int  not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (booking_id, kind, slot_start)
);
create index if not exists sms_log_booking_idx on public.sms_log (booking_id);

alter table public.sms_log enable row level security;
-- admins can audit; clients never see it; only the service role writes
create policy "sms log admin read" on public.sms_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.sms_log from anon, authenticated;
revoke all on public.sms_log from anon;

-- ---------- settings (public-readable like every app_settings row — no secrets here) ----------
insert into public.app_settings (key, value) values
  ('sms_enabled',               'true'),
  ('sms_reminder_min_lead_days','7'),
  ('google_review_url',         '"https://maps.app.goo.gl/SDoKBodNRucu2WKE8"'),
  ('google_maps_url',           '"https://maps.app.goo.gl/SDoKBodNRucu2WKE8"')
on conflict (key) do nothing;

-- ---------- atomic claim: returns the log id to send with, or null = already handled ----------
create or replace function public.sms_claim(
  p_booking_id uuid, p_kind text, p_slot_start timestamptz, p_to text
) returns uuid language sql volatile security definer
set search_path = public
as $$
  insert into public.sms_log as l (booking_id, kind, slot_start, to_phone)
  values (p_booking_id, p_kind, p_slot_start, p_to)
  on conflict (booking_id, kind, slot_start) do update
     set status = 'sending', to_phone = excluded.to_phone, error = null,
         attempts = l.attempts + 1, updated_at = now()
   where l.status = 'failed'
      or (l.status = 'sending' and l.updated_at < now() - interval '10 minutes')  -- crashed mid-send
  returning l.id
$$;

-- ---------- J-1 reminder candidates (workshop timezone) ----------
create or replace function public.sms_reminder_candidates()
returns setof uuid language sql stable security definer
set search_path = public
as $$
  with cfg as (
    select coalesce((select value #>> '{}' from public.app_settings where key = 'timezone'), 'Europe/Paris') as tz,
           coalesce((select (value #>> '{}')::int from public.app_settings where key = 'sms_reminder_min_lead_days'), 7) as lead_days
  )
  select b.id
    from public.bookings b, cfg
   where b.status = 'confirmed'
     and (b.slot_start at time zone cfg.tz)::date = (now() at time zone cfg.tz)::date + 1
     and b.slot_start - b.created_at >= make_interval(days => cfg.lead_days)
     and not exists (
       select 1 from public.sms_log l
        where l.booking_id = b.id and l.kind = 'reminder'
          and l.slot_start = b.slot_start
          and (l.status in ('sent','skipped')
               or (l.status = 'sending' and l.updated_at >= now() - interval '10 minutes')))
   order by b.slot_start
$$;

revoke all on function public.sms_claim(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.sms_reminder_candidates()                from public, anon, authenticated;
grant execute on function public.sms_claim(uuid, text, timestamptz, text) to service_role;
grant execute on function public.sms_reminder_candidates()                to service_role;
