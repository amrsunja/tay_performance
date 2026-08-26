# Tay Performance — Phase 2 Implementation Guide (Supabase + Business Logic)

**Audience:** Claude Code (or any engineer) implementing the business logic phase.
**Status of the codebase:** The UI phase is **done and delivered** in `tay_performance_web/` — Vite + React 19 + TypeScript + react-router-dom v7, CSS Modules, all screens built on a mock data layer. Phase 2 replaces the mocks with Supabase (Postgres + Auth + Storage + Realtime) and wires real business logic. **Do not redesign the UI. Do not change the design-token system. Do not reintroduce CRA.**
**Last updated:** 2026-08-08

---

## 1. Document map (read in this order)

| Doc | Contents |
|---|---|
| `00_IMPLEMENTATION_GUIDE.md` | This file. Scope, decisions already made, ground rules, doc map. |
| `01_ARCHITECTURE.md` | System architecture, current code structure, exact mock→Supabase swap points, client library layout. |
| `02_DATABASE_SCHEMA.md` | Complete Postgres schema: enums, tables, constraints, indexes, triggers, RPCs, seed data. Copy-paste-ready SQL migrations. |
| `03_AUTH_AND_SECURITY.md` | Auth model (anonymous clients + dashboard-created admins), full RLS policy SQL, storage policies, security hardening checklist. |
| `04_BUSINESS_LOGIC.md` | The engines: pricing, legal compliance, availability/slots, hold + booking creation, status lifecycle, realtime, notifications. |
| `05_ADMIN_PANEL.md` | Per-page admin spec: what each existing page must do once wired, every mutation, every query. |
| `06_CLIENT_FLOWS.md` | Client-facing spec: landing, booking funnel (including the new vehicle selector + contact capture), portal (garage / bookings). |
| `07_IMPLEMENTATION_PLAN.md` | Step-by-step phased checklist with acceptance criteria per phase. Follow it top to bottom. |

The original product documents remain authoritative for anything not covered here:
`business_requirements.md` (BRD — domain model and V1 scope) and `design_tech_doc.md` (design system). Where this doc set deviates from the BRD, the deviation is explicit and intentional (see §4).

---

## 2. Product summary (one paragraph)

Tay Performance is a high-end automotive window-tinting workshop in Illkirch-Graffenstaden, France. The web app lets a visitor resolve their exact car (make → model → generation → body style), configure tint zones + VLT opacity with a live photo preview, see a transparent price and legal-compliance verdict (France: front glazing must transmit ≥ 70% VLT), and book a real workshop slot — all in under 3 minutes, **without creating an account**. Admins manage the day's queue, agenda, clients, vehicle taxonomy, pricing matrix, and workshop configuration entirely from `/admin` — never from the Supabase dashboard.

---

## 3. Decisions already made (do not re-litigate)

These were confirmed with the product owner (Amir) on 2026-08-08:

1. **Client identity = Supabase anonymous auth, with optional email linking.**
   Every visitor gets `signInAnonymously()` on first meaningful interaction. Anonymous users can build a booking draft, hold a slot, confirm bookings, keep a garage, and see their booking history/statuses/prices. At booking confirmation we always capture `contact_name`, `contact_phone`, `contact_email` (the workshop must be able to reach the customer). After a booking is made, the app offers to attach the email to the anonymous account (`updateUser({ email })` → magic-link verification) so history becomes recoverable on any device. Never force account creation.

2. **Admin accounts are created manually in the Supabase dashboard only.**
   There is no sign-up path for admins in the app. A single `admin` role for V1 (`staff` exists in the enum for later but has no policies). An owner creates the user (email + password) in the dashboard, then promotes it with one SQL statement (see `03_AUTH_AND_SECURITY.md` §3). The app has a plain `/admin/login` email+password form.

3. **Bookings created by clients start as `requested`, not `confirmed`.**
   The slot is claimed instantly and atomically (no double booking — enforced by a Postgres exclusion constraint), but an admin validates it from the daily queue (`requested → confirmed`), which triggers the confirmation email. This protects the workshop from junk anonymous bookings while never risking a double-sold slot.

4. **Price and duration are always computed server-side.** The client renders a live quote for UX, but the authoritative price/duration/legality snapshot is recomputed inside the `create_booking` RPC from the pricing tables. Client-supplied totals are never trusted.

5. **No online payment in V1.** Quote is indicative; payment happens at the workshop. Price snapshot on the booking is still exact.

6. **Availability is server-truth.** Computed by a Postgres function from workshop hours − blackouts − confirmed/in-progress/requested bookings − live holds. The client never infers availability.

---

## 4. Intentional deviations from the BRD

| BRD says | We implement | Why |
|---|---|---|
| `users` table keyed to `auth.uid()` with `role` | `profiles` table (1:1 with `auth.users`) + `user_role` enum; `is_admin()` helper function | Supabase convention; never mutate `auth.users` directly. |
| Tint zone `windshield_strip` (≤10 cm sun strip only, full windshield disallowed) | Zone `pare_brise` (full windshield) as built in the UI, treated as a **front legally-restricted zone** (< 70% VLT ⇒ non-compliant, requires explicit client acknowledgement) | The delivered UI sells `pare_brise` as a zone with its own layer asset and price (90 €). Business accepted this: it is offered, with the same ≥70% legal floor and ack flow as `front_sides`. A dedicated ≤10 cm `windshield_strip` product can be added later as a new zone row — the schema supports it without migration. |
| Per-zone VLT selection | **Two group sliders** (front VLT / rear VLT) as built in the UI; specs are still stored **per zone** in `booking_tint_specs` | UI simplification that ships. DB model unchanged, so per-zone control can be added later without migration. |
| `time_slots` materialized table with `open/held/booked/blocked` rows | **No materialized slot table.** Slots are computed on demand by `get_available_slots()`; race protection = `booking_holds` table (TTL) + exclusion constraints on both `bookings` and `booking_holds` | Materializing slots creates a generation/repair problem (config changes orphan rows). Computing them is cheap at this scale and cannot drift. The BRD itself allows "computed view + exclusion constraint". |
| Auth "email magic-link / OAuth" for clients | Anonymous auth + optional email linking (magic link) | Product decision #1 above. |
| `staff` role policies | Admin only in V1; `staff` enum value reserved | Product decision #2 above. |
| Auto `confirmed` on slot conversion | Initial status `requested`; admin confirms | Product decision #3 above. |
| Base price + labor formula includes `labor_rate_per_min × base_labor_minutes` | Keep the same formula, **plus** the UI's "limo supplement" (+30 € when any selected zone's VLT ≤ 20%) as a configurable pricing setting | The delivered quote UI shows this line item; make it data-driven (`app_settings`), not hardcoded. |

Everything else in the BRD (taxonomy, pricing matrix shape, statuses, compliance rule, admin capabilities) stands.

---

## 5. Ground rules for the implementation

- **Stack:** existing Vite + React 19 + TS app; add `@supabase/supabase-js` v2 and `@tanstack/react-query` v5 (data fetching/caching/invalidations). No other state library — the booking draft keeps its `useReducer`. No Tailwind. No UI kit.
- **Never ship the service-role key to the client.** The browser uses only the anon key. Anything that must bypass RLS is a `SECURITY DEFINER` Postgres function with a pinned `search_path`, or an Edge Function using the service key server-side.
- **RLS on every table, no exceptions.** Default-deny; policies grant the minimum. See `03_AUTH_AND_SECURITY.md`.
- **All writes that span multiple rows are RPCs** (single transaction): `create_booking`, `publish_pricing`, `resolve_vehicle_request`, `admin_create_booking`. Never let the client do multi-step writes that can half-fail.
- **Migrations are files**, committed to the repo under `supabase/migrations/`, applied with the Supabase CLI. Never mutate schema from the dashboard "just this once".
- **Money** is `numeric(10,2)`, currency EUR everywhere in V1. **Time** is `timestamptz` in UTC; the workshop timezone `Europe/Paris` is a constant in `app_settings` and all slot math happens in that zone server-side.
- **French UI, English code.** All user-facing strings stay French exactly as the UI has them; identifiers, comments, docs in English.
- **Keep the existing look.** Loading states use the skeleton patterns from `design_tech_doc.md` §4 — no spinners for content.

---

## 6. Definition of done for Phase 2

1. `src/data/mock.ts` is deleted (or reduced to dev fixtures behind a flag). Every screen reads Supabase.
2. An anonymous visitor can: resolve a vehicle, configure tint, see live legal verdict + price, pick a real free slot, hold it, leave contact info, confirm → booking `requested`; then see it in `/reservations` with live status; optionally link an email.
3. Admin can: log in at `/admin/login`; confirm/advance/cancel bookings; see today's real queue and the week agenda; CRUD taxonomy; resolve vehicle requests; edit + publish pricing (versioned); edit workshop hours, granularity, bays, cancellation window, blackout dates; manage clients/vehicles; upload before/after photos; create a booking manually — **all without opening the Supabase dashboard**.
4. Double-booking is impossible: proven by a test that fires two concurrent `create_booking` calls for the same slot — exactly one succeeds.
5. A client below 70% VLT on a front zone cannot create a booking without `legal_flag = non_compliant_ack`; server enforces it even if the UI is bypassed.
6. Every table has RLS enabled with the policies from `03_AUTH_AND_SECURITY.md`; the anon role cannot read other users' bookings, admin notes, or contact data (verify with the SQL probe script in that doc).
