# Tay Performance — Backend (Supabase)

Everything the platform needs server-side: Postgres schema, RLS policies, business RPCs,
storage buckets, the transactional-email Edge Function, and the test suite that proves
the invariants (no double-booking, legality enforcement, RLS isolation).

Implements `docs/02_DATABASE_SCHEMA.md`, `docs/03_AUTH_AND_SECURITY.md`, `docs/04_BUSINESS_LOGIC.md`.

```
backend/
└── supabase/
    ├── config.toml                  # local dev config (anonymous auth ON, email signup OFF)
    ├── migrations/
    │   ├── 0001_extensions_enums.sql
    │   ├── 0002_tables.sql          # 23 tables, exclusion constraints, indexes
    │   ├── 0003_functions_triggers.sql  # is_admin(), auth triggers, pricing views
    │   ├── 0004_rls.sql             # RLS enabled on every table, default-deny
    │   ├── 0005_business_rpcs.sql   # quote / availability / holds / booking lifecycle / admin ops
    │   ├── 0006_storage.sql         # booking-photos (private) + brand-assets (public) buckets
    │   └── 0007_seed.sql            # catalog, hours, settings, pricing v1, starter taxonomy
    ├── functions/
    │   ├── send-booking-email/      # Resend dispatcher (webhooks + J-1 reminder)
    │   └── send-booking-sms/        # Twilio SMS: confirmed / J-1 (booked ≥7 days ahead) / completed + Google review
    ├── optional/
    │   └── cron_jobs.sql            # pg_cron housekeeping: hold sweep, stale-anon purge (hosted only)
    └── tests/
        ├── harness_stub.sql         # bare-Postgres stubs for auth/storage (tests only!)
        ├── business_tests.sql       # T1–T10: pricing, legality, RLS, holds, transitions
        ├── run_local_harness.sh     # run migrations + tests on any local Postgres
        └── concurrency_test.sh      # two-connection double-booking race (exactly one wins)
```

## Local development (with the Supabase CLI + Docker)

```bash
cd backend
supabase start                   # boots the local stack
supabase db reset                # applies migrations/ in order + seed
supabase status                  # shows local URL + anon key for the web app's .env.local
```

## Testing without Docker (any Postgres ≥ 15)

```bash
cd backend/supabase/tests
./run_local_harness.sh           # scratch db + harness stubs + all migrations + business tests
```

`business_tests.sql` asserts, among others: quote math matches the documented formula
(base + zone deltas + duration×labor + limo supplement), a front zone under 70% VLT cannot
be booked without explicit acknowledgement, client B can never read/cancel client A's data,
admin notes are invisible to clients, no client can self-promote to admin, the booked slot
disappears from availability, expired holds free their slot, pricing publish switches
versions atomically and clients only ever see the published grid.

## Deploying to the hosted project

```bash
supabase link --project-ref <PROJECT-REF>
supabase db push                 # applies migrations
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Tay Performance <rdv@yourdomain>" \
                     WORKSHOP_NOTIFY_EMAIL=... WEBHOOK_SECRET=<random-64-chars>
supabase functions deploy send-booking-email

# SMS — same Twilio account / Messaging Service as Auth phone OTP
supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_MESSAGING_SERVICE_SID=MG...
supabase functions deploy send-booking-sms
```

`EMAIL_FROM` must be on a domain **verified in Resend** — with the default `onboarding@resend.dev`
Resend only delivers to the account owner. Deploy from `backend/` so `config.toml`
(`verify_jwt = false`) is applied.

Then:
1. **Auth → Providers**: Anonymous ON; Email ON (magic link), *Disable signup* for email.
2. **Auth → Attack protection**: enable CAPTCHA (Turnstile) — protects anonymous sign-in.
3. **SQL editor — Vault secrets** read by the notification triggers + reminder cron (migration 0022):
   ```sql
   select vault.create_secret('https://<PROJECT-REF>.supabase.co', 'project_url');
   select vault.create_secret('<same value as WEBHOOK_SECRET>',     'webhook_secret');
   ```
   No Database Webhook to create in the dashboard: 0022 installs the triggers
   (`bookings_notify`, `booking_status_history_notify`), drops any old dashboard webhooks on
   those tables and schedules `booking-reminder-j1` / `booking-sms-reminder-j1` (16:00 UTC).
4. **SQL editor**: run `optional/cron_jobs.sql` (housekeeping jobs only).
5. Create admin users — see "Admin runbook" below.

### Debugging notifications

```sql
-- what each function answered (body = {"ok":true,"result":[...]} with the reason per message)
select created, status_code, timed_out, error_msg, left(content::text, 300)
  from net._http_response order by created desc limit 20;
select kind, to_email, status, error, created_at from email_log order by created_at desc limit 20;
select kind, to_phone, status, error, created_at from sms_log   order by created_at desc limit 20;
select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 10;
```
SMS J-1 reminders only go to bookings made ≥ `app_settings.sms_reminder_min_lead_days` (7) days
before the RDV — set it to `0` to test with a booking for tomorrow.

## Admin runbook (creating admin accounts)

1. Dashboard → Authentication → Users → **Add user** (email + strong password, Auto-confirm).
2. SQL editor:
   ```sql
   update public.profiles
     set role = 'admin', is_anonymous = false, full_name = 'Prénom Nom'
     where id = '<user-uuid>';
   ```
3. Hand over credentials; they sign in at `/admin/login` and change the password from
   Admin → Config → Compte.

There is intentionally **no** sign-up or role-change path in the app.
