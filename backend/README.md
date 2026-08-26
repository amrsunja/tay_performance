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
    │   └── send-booking-email/      # Resend dispatcher (webhooks + J-1 reminder)
    ├── optional/
    │   └── cron_jobs.sql            # pg_cron: reminder, hold sweep, stale-anon purge (hosted only)
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
```

Then in the dashboard:
1. **Auth → Providers**: Anonymous ON; Email ON (magic link), *Disable signup* for email.
2. **Auth → Attack protection**: enable CAPTCHA (Turnstile) — protects anonymous sign-in.
3. **Database → Webhooks**: two webhooks calling the `send-booking-email` function URL,
   with an `x-webhook-secret: <WEBHOOK_SECRET>` header:
   - INSERT on `public.bookings`
   - INSERT on `public.booking_status_history`
4. **SQL editor**: run `optional/cron_jobs.sql` (after storing the two Vault secrets it names).
5. Create admin users — see "Admin runbook" below.

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
