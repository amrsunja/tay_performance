# Tay Performance — Web App

React 19 + TypeScript + Vite · Supabase (Postgres + Auth + Storage + Realtime).
V1 scope from `docs/business_requirements.md`, implementation contract in `docs/00…07_*.md`,
styled per `docs/design_tech_doc.md` (Octane dark theme). Backend lives in `../backend/`.

## Run

```bash
npm install
cp .env.example .env.local   # fill from `supabase status` (local) or the project dashboard
npm run dev
```

Requires the backend stack to be up (`cd ../backend && supabase start && supabase db reset`).

## Auth model

- **Clients:** anonymous Supabase sessions, minted lazily on the first identity-requiring action
  (slot hold, garage, vehicle request). Optional email linking (magic link) after booking.
- **Admins:** accounts created in the Supabase dashboard only (see `../backend/README.md`),
  sign-in at `/admin/login`. RLS is the security boundary; route guards are UX.

## Routes

| Route | Screen |
|---|---|
| `/` | Landing (Direction A — cinématique) |
| `/reserver` | Booking funnel: véhicule → configurateur → créneau (hold + contact) → confirmation |
| `/garage` | Client portal — Mon Garage (add/edit vehicles, 1-tap rebooking) |
| `/reservations` | Client portal — Mes réservations (statuts live, annulation, reprogrammation) |
| `/admin/login` | Admin sign-in |
| `/admin` | Admin — File du jour (validation des demandes, avancement statut) |
| `/admin/agenda` · `/clients` · `/vehicules` · `/tarifs` · `/config` | Admin workspace |

## Structure

```
src/
  lib/           supabase.ts (client + error mapping) · queryClient.ts
  auth/          AuthProvider (lazy anonymous session) · RequireAdmin
  api/           ALL Supabase access — components never import supabase directly
                 catalog · taxonomy · availability · bookings · garage · admin
                 · pricingAdmin · configAdmin
  types/         domain.ts (BRD model) · api.ts (API-facing shapes)
  styles/        tokens.css (design tokens) + base.css (shared controls/motion)
  hooks/         useReveal (scroll reveal)
  components/    ui/ (CountUp, SectionTag, StatusPill, Modal) · layout/ (header, footer)
  features/
    landing/     Direction A landing
    booking/     useBookingDraft (reducer + local quote = server formula) · VehicleStep
                 (make→model→generation→body funnel) · TintBlueprint · steps
    portal/      Garage + Bookings
    admin/       AdminLayout (+ manual booking modal) · pages · BookingDrawer
```

## Business rules the client mirrors (server is authoritative)

- Price = base(body) + Σ delta(zone, VLT) + duration × labor rate + limo supplement.
  The local quote uses the same fetched parameters as `public._compute_quote`; every booking
  snapshot is recomputed server-side inside `create_booking`.
- France legal floor: front glazing ≥ 70% VLT; below requires the explicit ack checkbox,
  enforced again by the RPC (`ILLEGAL_SPEC_REQUIRES_ACK`).
- Availability, holds (TTL soft-locks) and the no-double-booking guarantee are all
  server-side; the calendar polls (focus + 30 s) since anonymous users can't see other
  users' bookings through realtime RLS.

## Tint preview layers

`TintBlueprint` composites pixel-registered 1266×832 PNGs over `bmw_original_front.png`:
`bmw_front_window_tint` (pare-brise) · `bmw_front_right_left_windows_tint` (vitres avant) ·
`bmw_back_windows_tint` (vitres arrière). Layer opacity = `(85 − VLT) / 80`, gated by zone selection.
