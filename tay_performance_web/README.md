# Tay Performance — Web App (UI phase)

React 19 + TypeScript + Vite. UI-only implementation of the V1 scope from `docs/business_requirements.md`,
styled per `docs/design_tech_doc.md` (Octane dark theme). Business logic + Supabase come in phase 2.

## Run

```bash
npm install
npm run dev
```

## Routes

| Route | Screen |
|---|---|
| `/` | Landing (Direction A — cinématique) |
| `/reserver` | Booking flow: configurateur (layered tint preview) → créneau → confirmation |
| `/garage` | Client portal — Mon Garage |
| `/reservations` | Client portal — Mes réservations |
| `/admin` | Admin — File du jour |
| `/admin/agenda` · `/clients` · `/vehicules` · `/tarifs` · `/config` | Admin workspace |

## Structure

```
src/
  styles/        tokens.css (design tokens) + base.css (shared controls/motion)
  types/         domain.ts — BRD data model (maps to Supabase later)
  data/          mock.ts — UI-phase mock data (single point to swap for Supabase)
  hooks/         useReveal (scroll reveal)
  components/    ui/ (CountUp, SectionTag, StatusPill) · layout/ (header, footer)
  features/
    landing/     Direction A landing
    booking/     useBookingDraft (reducer) · TintBlueprint (layered PNG preview) · steps
    portal/      Garage + Bookings
    admin/       AdminLayout + Queue/Agenda/Clients/Vehicles/Pricing/Config
```

## Tint preview layers

`TintBlueprint` composites pixel-registered 1266×832 PNGs over `bmw_original_front.png`:
`bmw_front_window_tint` (pare-brise) · `bmw_front_right_left_windows_tint` (vitres avant) ·
`bmw_back_windows_tint` (vitres arrière). Layer opacity = `(85 − VLT) / 80`, gated by zone selection.
Front zones enforce the 70% VLT legal floor visually (warning + ack copy per BRD §2.2).
