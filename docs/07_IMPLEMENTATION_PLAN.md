# 07 — Step-by-Step Implementation Plan

Work top to bottom; every phase ends green (`tsc -b` + `oxlint` clean, app runs) and has explicit acceptance criteria. Commit per phase. Local-first with the Supabase CLI (`supabase start`); push to the hosted project only from migration files.

---

## Phase 0 — Project plumbing (½ day)

1. Create the Supabase project (EU region — Frankfurt/Paris) + install CLI; `supabase init` inside `tay_performance_web/`.
2. Add deps: `@supabase/supabase-js`, `@tanstack/react-query`. Create `src/lib/supabase.ts`, `src/lib/queryClient.ts`, wrap `App` in `QueryClientProvider`.
3. `.env.local` with URL + anon key; add to `.gitignore`; document in README.

**Done when:** app boots unchanged; `supabase status` shows a local stack.

## Phase 1 — Schema migrations (1 day)

1. Write migrations `0001`–`0006` exactly per `02_DATABASE_SCHEMA.md` (enums, tables, constraints, indexes, plumbing functions/triggers, storage buckets, seed).
2. RLS migration `0004` per `03_AUTH_AND_SECURITY.md` §2 — same PR as the tables.
3. `supabase gen types typescript --local > src/lib/database.types.ts`.
4. Seed a starter taxonomy (≥ 6 makes with real model/generation/variant chains — the ones from the mock screens).

**Done when:** `supabase db reset` runs clean end-to-end; RLS probe (`03` §4 items 1 & 4) passes; a SQL insert violating the bookings overlap constraint fails.

## Phase 2 — Auth foundation (½ day)

1. Dashboard config per `03` §5 (anonymous ON + Turnstile, email magic link, no password sign-up).
2. `AuthProvider` + `useSession` + lazy `ensureSession()` helper (signInAnonymously on demand).
3. `/admin/login` page + `RequireAdmin` wrapper on the `/admin` route tree.
4. Create the first real admin per the runbook (`03` §1.2); verify login + non-admin rejection.

**Done when:** anonymous session mints on demand; admin reaches `/admin`; a client-role user cannot.

## Phase 3 — Business RPCs (1–2 days)

Implement in `0007_business_rpcs.sql` per `04_BUSINESS_LOGIC.md`:
`_compute_quote`, `quote_booking`, `get_month_availability`, `get_available_slots`, `hold_slot`, `release_hold`, `create_booking`, `cancel_booking_client`, `reschedule_booking`, `set_booking_status`, `admin_create_booking`, `clone_pricing_version`, `publish_pricing`, `resolve_vehicle_request`, `next_booking_reference`.

Test with SQL scripts (`supabase/tests/`):
- quote math reproduces `02` §8 worked example;
- illegal front spec without ack → `ILLEGAL_SPEC_REQUIRES_ACK`;
- **two concurrent `create_booking` on one slot → exactly one wins** (psql two-connection script);
- hold TTL expiry path; cutoff cancel path; every illegal status transition rejected.

**Done when:** all SQL tests pass locally.

## Phase 4 — Catalog + funnel reads on the client (1 day)

1. `src/api/{taxonomy,catalog}.ts`; replace `TINT_ZONES`/`VLT_STOPS` consumption in ConfigStep/TintBlueprint/PricingPage with fetched data (keep the `layerSrc` frontend map).
2. Build `VehicleStep` (funnel + URL serialization + auto-skip + vehicle-request capture) and insert it as step 1 of `/reserver`; thread `variantId`/`vehicleId` through `useBookingDraft`.
3. Rework the draft quote to the full formula parameterized by fetched pricing (`06` §1.2) + debounced `quote_booking` reconciliation.

**Done when:** a visitor resolves a real variant from seeds, configures zones, sees correct full-formula price + legal verdict with ack checkbox.

## Phase 5 — Availability, hold, booking creation (1–1½ days)

1. `src/api/{availability,bookings}.ts`; CalendarStep on `get_month_availability` + `get_available_slots`; delete the mock logic from `calendar.ts` (keep formatters).
2. Hold-on-select with countdown + release on back/unmount; refetch policy (focus + 30 s).
3. `ContactFields` + create_booking wiring + error mapping (`04` §13); ConfirmStep on returned booking with "requested" copy + email-link offer card + garage-save offer.

**Done when:** end-to-end anonymous booking works against local stack; killing the tab mid-hold releases via TTL; the booking appears with status Demandé.

## Phase 6 — Portal (1 day)

1. `src/api/garage.ts`; GaragePage real vehicles + add/edit/delete via VehicleStep modal; pre-seeded `/reserver` entry.
2. BookingsPage on `['my-bookings']` + signed photo URLs + warranty pill + cancel (cutoff) + reschedule + re-book flows; realtime on own bookings.
3. Magic-link recovery form for returning linked users.

**Done when:** the full client loop (book → track → cancel/reschedule → history) works without ever seeing a login wall.

## Phase 7 — Admin panel wiring (2–3 days)

Follow `05_ADMIN_PANEL.md` page by page, in this order (value-first):
1. QueuePage (queue query, status advance, realtime) — the workshop's daily driver.
2. Booking drawer (details, admin notes, photos upload, warranty, cancel).
3. AgendaPage (week query, real closed/blackout shading, drawer on click).
4. ConfigPage (hours, settings, blackouts + conflict warnings, change password).
5. PricingPage (draft clone, cell edits, publish).
6. VehiclesPage (taxonomy CRUD + request resolution).
7. ClientsPage (search, aggregates, client drawer).
8. Manual booking modal (`admin_create_booking`).

**Done when:** the Definition-of-done item 3 in `00` §6 holds — a full workshop week can be run without the Supabase dashboard.

## Phase 8 — Emails (½–1 day)

1. Edge Function `send-booking-email` (Resend, French templates per `04` §12) + DB webhooks on `bookings` insert and `booking_status_history` insert.
2. pg_cron J-1 reminder job; pg_cron expired-holds + stale-anonymous-users cleanup.

**Done when:** create/confirm/cancel each deliver correct mail on staging; reminder fires for a seeded tomorrow booking.

## Phase 9 — Hardening + cleanup (1 day)

1. Run the full RLS probe (`03` §4) against staging with real JWTs; fix any leak.
2. Concurrency test against staging (not just local).
3. Delete `src/data/mock.ts` and dead mock branches; `grep -r "mock" src/` returns nothing meaningful.
4. Lighthouse pass on `/` and `/reserver` (images already optimized in UI phase; verify no regression from data fetching — skeletons per design doc §4, no layout shift).
5. `03` §7 checklist item by item; PITR/backup enabled; Turnstile verified in production keys.

## Phase 10 — Launch runbook

1. `supabase db push` to production project; run seed (minus test rows); publish pricing v1.
2. Create real admin users (runbook `03` §1.2); hand credentials.
3. Configure custom SMTP domain in Resend + SPF/DKIM; switch Auth email sender.
4. Deploy SPA (any static host; SPA fallback to `index.html` for react-router).
5. Smoke: real anonymous booking on production → admin confirms from phone → email received.

---

## Suggested effort map

| Phase | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Days | 0.5 | 1 | 0.5 | 1.5 | 1 | 1.5 | 1 | 2.5 | 1 | 1 |

≈ 11–12 focused days. Phases 3 is the riskiest (concurrency correctness) — do not shortcut its tests; everything downstream trusts them.
