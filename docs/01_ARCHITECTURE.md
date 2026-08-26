# 01 — System Architecture & Codebase Map

---

## 1. High-level architecture

```
┌────────────────────────────┐        anon key + RLS         ┌─────────────────────────────┐
│  Vite + React 19 SPA       │ ────────────────────────────► │  Supabase                    │
│                            │                               │                              │
│  / (landing)               │  supabase-js v2               │  Postgres                    │
│  /reserver (funnel)        │   • auth (anonymous + email)  │   • tables + RLS             │
│  /garage /reservations     │   • from()/rpc() queries      │   • SECURITY DEFINER RPCs    │
│  /admin/* (panel)          │   • realtime channels         │   • exclusion constraints    │
│  /admin/login              │   • storage (photos)          │  Auth (anonymous, email)     │
│                            │                               │  Storage (booking-photos,    │
│  @tanstack/react-query     │                               │           brand-assets)      │
│  (cache + invalidation)    │                               │  Realtime (bookings, holds)  │
└────────────────────────────┘                               │  Edge Functions (emails)     │
                                                             └─────────────────────────────┘
```

Three trust tiers:

1. **Anonymous client** (`authenticated` role, `is_anonymous = true` in JWT) — own rows only.
2. **Linked client** (same user after email attach) — identical policies; linking changes nothing in RLS.
3. **Admin** (`authenticated`, `profiles.role = 'admin'`) — full panel powers via `is_admin()` in policies.

The Postgres database is the only authority for: availability, price, duration, legality, slot integrity, status transitions. The SPA is a renderer with optimistic UX.

---

## 2. Current repo layout (UI phase, delivered)

```
tay_performance/
├── docs/                          ← product docs + this doc set
│   ├── assets/                    ← brand assets, tint layer PNGs (1266×832)
│   ├── business_requirements.md   ← BRD (domain authority)
│   ├── design_tech_doc.md         ← design system authority
│   └── 0*–07_*.md                 ← THIS implementation doc set
└── tay_performance_web/
    ├── package.json               ← react 19, react-router-dom 7, vite 8, oxlint
    └── src/
        ├── main.tsx               ← BrowserRouter bootstrap
        ├── App.tsx                ← route table (see §3)
        ├── types/domain.ts        ← domain types mirroring BRD §3 + FRONT_LEGAL_MIN_VLT = 70
        ├── data/mock.ts           ← ★ ALL mock data — the file Phase 2 eliminates
        ├── hooks/useReveal.ts     ← scroll-reveal animation hook
        ├── styles/{tokens,base}.css
        ├── components/
        │   ├── layout/  SiteHeader, SiteFooter
        │   └── ui/      StatusPill, SectionTag, CountUp
        ├── features/
        │   ├── landing/ LandingPage
        │   ├── booking/ BookingPage, ConfigStep, CalendarStep, ConfirmStep,
        │   │            TintBlueprint, useBookingDraft.ts, calendar.ts (★ mock availability)
        │   ├── portal/  GaragePage, BookingsPage
        │   └── admin/   AdminLayout, QueuePage, AgendaPage, ClientsPage,
        │                VehiclesPage, PricingPage, ConfigPage
        └── assets/                ← car photos + pixel-registered tint layers
```

## 3. Route table (existing — extend, don't break)

| Route | Component | Phase 2 change |
|---|---|---|
| `/` | `LandingPage` | none (static marketing) |
| `/reserver` | `BookingPage` (3 steps: config → calendar → confirm) | prepend **vehicle step**, wire real availability/hold/booking, add contact capture |
| `/garage` | `GaragePage` | real vehicles of current user; add-vehicle funnel |
| `/reservations` | `BookingsPage` | real bookings of current user, realtime status |
| `/admin` | `AdminLayout` → `QueuePage` | guard behind admin session; real data |
| `/admin/agenda,clients,vehicules,tarifs,config` | respective pages | real data + mutations |
| **new** `/admin/login` | `AdminLoginPage` | email+password sign-in, redirect to `/admin` |

Guarding: `AdminLayout` renders only when session exists **and** `profiles.role = 'admin'` (fetched once, cached). Otherwise redirect to `/admin/login`. Note RLS is the real security boundary — the route guard is UX only.

---

## 4. Phase-2 target layout (additions only)

```
tay_performance_web/
├── .env.local                     ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
├── supabase/
│   ├── config.toml
│   ├── migrations/                ← numbered SQL files from 02_DATABASE_SCHEMA.md
│   │   ├── 0001_extensions_enums.sql
│   │   ├── 0002_tables.sql
│   │   ├── 0003_functions_triggers.sql
│   │   ├── 0004_rls.sql
│   │   ├── 0005_storage.sql
│   │   └── 0006_seed.sql
│   └── functions/
│       └── send-booking-email/    ← Edge Function (Resend) for transactional mail
└── src/
    ├── lib/
    │   ├── supabase.ts            ← createClient singleton (typed)
    │   ├── database.types.ts      ← `supabase gen types typescript` output
    │   └── queryClient.ts         ← react-query client
    ├── auth/
    │   ├── AuthProvider.tsx       ← session context; ensures anonymous session lazily
    │   ├── useSession.ts
    │   └── RequireAdmin.tsx       ← wrapper for /admin routes
    ├── api/                       ← ALL Supabase access lives here; components never
    │   │                            call supabase directly
    │   ├── taxonomy.ts            ← makes/models/generations/variants queries + admin CRUD
    │   ├── catalog.ts             ← tint zones, VLT levels, pricing (published grid)
    │   ├── availability.ts        ← get_available_slots RPC, hold/release RPCs
    │   ├── bookings.ts            ← create_booking RPC, my bookings, cancel/reschedule
    │   ├── garage.ts              ← my vehicles CRUD
    │   ├── admin.ts               ← queue, agenda, clients, status transitions, manual booking
    │   ├── pricing-admin.ts       ← draft/publish pricing
    │   ├── config-admin.ts        ← workshop hours, settings, blackouts
    │   └── photos.ts              ← storage upload + signed URLs
    └── features/booking/
        ├── VehicleStep.tsx        ← NEW: make→model→generation/year→body funnel
        └── ContactFields.tsx      ← NEW: name/phone/email capture on confirm
```

Rules for `src/api/*`:
- Every function returns typed domain objects (reuse/extend `types/domain.ts`), not raw rows.
- Every list used by the UI has a react-query key documented next to it; mutations invalidate exactly those keys.
- No component imports `supabase` directly — this keeps the swap surface auditable.

---

## 5. Exact mock → Supabase swap points

These are the only places the UI phase left seams; everything else stays untouched.

| Mock artifact (in `src/data/mock.ts` unless noted) | Replaced by |
|---|---|
| `TINT_ZONES` (5 zones with price/minutes/layerSrc) | `tint_zones` table joined with published `zone_pricing`; `layerSrc` stays a **frontend** mapping `zone.code → imported asset` (assets are bundled, not in Storage) |
| `VLT_STOPS` `[5,20,35,50,70,85]` | `vlt_levels` table |
| `WORKSHOP_SLOTS` (6 hardcoded times) + `features/booking/calendar.ts` (deterministic pseudo-availability: `dayAvailability`, `slotIsOpen`, `daySlots`) | `get_available_slots(day, variant, zones)` RPC — see `04_BUSINESS_LOGIC.md` §4. `getMonth`, `dayLabel`, `formatDuration` are pure date/format helpers — keep them. |
| `bookingReference()` (client-side fake ref) | server-generated `reference` returned by `create_booking` |
| `DEMO_VEHICLE`, `GARAGE_VEHICLES` | `vehicles` of current user (+ the new VehicleStep funnel for choosing/creating one) |
| `CLIENT_BOOKINGS` | `bookings` + `booking_tint_specs` + `booking_photos` of current user |
| `ADMIN_QUEUE` | admin day-queue query (bookings for date, joined) |
| `ADMIN_CLIENTS` | admin clients query (profiles + aggregates) |
| `PRICING_RULES` | `pricing_rules` (published version) |
| `WORKSHOP_WEEK`, `BLACKOUT_DATES` | `workshop_hours`, `blackout_dates` |
| `VEHICLE_REQUESTS` | `vehicle_requests` |
| `MAKES`, `VARIANTS` consts inside `admin/VehiclesPage.tsx` | taxonomy queries |
| `BLOCKS` const inside `admin/AgendaPage.tsx` | week-agenda query |
| `useBookingDraft.ts` quote computation (prices, +30 € limo rule, minutes, legality) | keep as **live client preview**, but parameterized from fetched catalog data; authoritative snapshot recomputed in `create_booking` |
| `zoneDelta()` inside `admin/PricingPage.tsx` (mock ×1.2 for ≤20%) | real `zone_pricing` grid values |

Facts the UI already encodes and the DB seed must reproduce exactly (see `02_DATABASE_SCHEMA.md` §8):

- Zones: `pare_brise` 90 € / 40 min (front) · `front_sides` 60 € / 30 min (front) · `rear_sides` 70 € / 35 min · `rear_window` 50 € / 30 min · `panoramic_roof` 40 € / 25 min.
- VLT stops: 5, 20, 35, 50, 70, 85. Front legal minimum: **70** (`FRONT_LEGAL_MIN_VLT` in `types/domain.ts`).
- Limo supplement: **+30 €** once per booking when any selected zone's VLT ≤ 20%.
- Hours: Mon–Thu 09:00–18:00, Fri 09:00–19:00, Sat 09:00–16:00, Sun closed. Granularity 30 min, 1 bay, cancellation cutoff 24 h.
- Body-style pricing rows: citadine_3p S ×0.70 180 € · citadine_5p S ×0.80 200 € · coupe_2p M ×0.85 220 € · berline_4p M ×1.00 240 € · break_5p L ×1.15 280 € · monospace L ×1.25 300 € · suv_5p XL ×1.40 340 € · utilitaire XL ×1.30 320 € — labor rate 0.40 €/min everywhere.
- Statuses and French labels (StatusPill): requested=Demandé, confirmed=Confirmé, in_progress=En pose, completed=Terminé, cancelled=Annulé, no_show=No-show.
- Booking reference format: `TP-<year>-<number>` (e.g. `TP-2026-4821`).

---

## 6. Data-flow patterns

**Reads:** react-query, `staleTime` generous for catalog (taxonomy, zones, pricing: 5 min+), tight for availability (0; always refetch on day select) and admin queue (realtime-invalidated).

**Writes:** react-query mutations → `src/api/*` → Supabase RPC/table op → invalidate keys. Optimistic updates only for admin status transitions (with rollback on error).

**Realtime (postgres_changes):**
| Channel | Filter | Consumer | Effect |
|---|---|---|---|
| `bookings-day` | `bookings` where `slot_start` in selected day | CalendarStep | invalidate availability query → slots re-grey live |
| `holds-day` | `booking_holds` same day | CalendarStep | same |
| `my-bookings` | `bookings` where `user_id = me` | BookingsPage | status timeline updates live |
| `admin-queue` | `bookings` (admin) | QueuePage/AgendaPage | queue refreshes when clients book |

Realtime is an optimization; every consumer must also work with plain refetch (don't gate correctness on the socket).

**Sessions:** `AuthProvider` restores the session; anonymous sign-in is **lazy** — triggered on first action needing identity (add-to-garage, hold slot), not on landing load (avoids minting users for bounces; enable Turnstile CAPTCHA for anonymous sign-ins, see `03_AUTH_AND_SECURITY.md` §7).

---

## 7. Environment & tooling

- `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Nothing else; never a service key in the web app.
- Supabase CLI: `supabase start` for local dev, `supabase db push`/migrations for schema, `supabase gen types typescript --local > src/lib/database.types.ts` regenerated after every migration.
- Edge Function secrets (`RESEND_API_KEY`) set with `supabase secrets set`, never in the repo.
- Keep `oxlint` clean; `tsc -b` must pass with generated DB types.
