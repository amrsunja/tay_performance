# 05 — Admin Panel Specification (per page)

Goal: **the admin never opens the Supabase dashboard.** Every page below already exists visually (`src/features/admin/`); this doc lists, per page, the queries, mutations, and behaviors to wire. Keep the existing markup/classes; add data + handlers. All admin routes wrap in `RequireAdmin` (redirect to `/admin/login` when the session is missing or non-admin).

Shared: react-query keys are given as `['…']`; every mutation invalidates the listed keys. Errors surface as toasts using the code vocabulary (`04` §13).

---

## 0. `/admin/login` (new page)

Email + password → `signInWithPassword`. On success fetch own profile; non-admin → sign out + generic "Identifiants invalides". Style: reuse booking-page card tokens; no sign-up or reset link (owner resets passwords from the dashboard; a "change password" control lives in Config §6).

---

## 1. `/admin` — File du jour (QueuePage)

**Query** `['admin','queue', dateISO]`: bookings where `slot_start` within the selected day (default today, Europe/Paris), status ≠ cancelled, ordered by `slot_start`; joined: specs, variant → generation → model → make, body_style label, `booking_admin_notes`, contact fields, `bookings_warranty`, photos count.

- Stat cards (already rendered): count of bookings; Σ `duration_min` ("de pose cumulée"); count `in_progress`; count of specs with `is_legal = false` ("spec non conforme à valider").
- "MAINTENANT" line: existing logic, keep (client-side time).
- Row actions (currently dead buttons):
  - **▸ Avancer le statut** → next legal transition (`requested→confirmed`, `confirmed→in_progress`, `in_progress→completed`) via `set_booking_status`; optimistic update + rollback. For `requested` rows render the pill emphasized — this is where admin validates anonymous bookings.
  - **✚ Ajouter des photos** → opens photo modal (see §7 booking drawer).
  - **↗ Ouvrir la fiche** → booking drawer (§7).
- Realtime: subscribe `bookings` changes (admin sees all) → invalidate `['admin','queue']` and `['admin','agenda']`.
- Topbar date picker (exists as static text): make it a real date selector driving the query; bay selector reads `app_settings.bay_count`.
- Topbar **+ Nouvelle réservation** → manual booking modal: pick/create client contact (or search existing profile), resolve variant via the same VehicleStep component, zones/VLT, pick slot (same availability RPC), calls `admin_create_booking` (status `confirmed`).

## 2. `/admin/agenda` (AgendaPage)

**Query** `['admin','agenda', weekStartISO]`: bookings of the visible week (status ≠ cancelled) → map to the existing block model `{day, start, duration, label, sub, tone}`:
- `label` = make + generation + model; `sub` = compact spec string (reuse `zoneShort` from QueuePage: PB/AV/AR/LUN/TOIT + `%`, "⚠" when a spec is illegal);
- `tone`: `green` = confirmed/completed, `blue` = in_progress, `amber` = requested or any illegal spec, `muted` = no_show.
- Closed shading from `workshop_hours` (replace the hardcoded Saturday-16h block); blackout days fully shaded with the reason.
- Week navigation (‹ ›) + "today" marker on the real current day (currently hardcoded to Monday).
- Click a block → booking drawer (§7). V1 is read-only placement (no drag-reschedule).

## 3. `/admin/clients` (ClientsPage)

**Query** `['admin','clients', search]`: profiles where role='client' with aggregates — vehicles count, bookings count, last completed `slot_start` ("Dernière visite"), using the trigram indexes for search over name/email/plate (plate search joins vehicles). Include anonymous clients (`full_name` null → display "Client anonyme" + short id); they exist as soon as they book.
- **+ Ajouter un client**: modal creating a *contact-only* profile is NOT possible (profiles are keyed to auth users) — instead this opens the manual-booking modal (§1) which stores contact on the booking. Keep the button, relabel action inside.
- Row **↗** → client drawer: profile info (editable name/phone/email — admin RLS), their vehicles, their bookings list with statuses.

## 4. `/admin/vehicules` (VehiclesPage) — taxonomy CRUD

**Queries** `['taxonomy','makes']`, `['taxonomy','models',makeId]`, `['taxonomy','generations',modelId]`, `['taxonomy','variants',{recent:true}]`, `['admin','vehicle-requests']`.
- Makes grid: click → drill into models → generations → variants (extend the existing two-column layout with a drill-down list; simple CRUD modals: create/edit/deactivate at each level; slugs auto-generated from name).
- Variant editor: generation + body_style + `base_labor_minutes` + notes + `is_active` ("Masqué" pill exists).
- **Demandes « je ne trouve pas mon véhicule »**: list `vehicle_requests` (`new` first). "Résoudre" flow: open taxonomy creator pre-filled from `raw_text`, create the missing rows, then `resolve_vehicle_request(id, variant_id)` → pill flips to "Résolu". Add "Rejeter" (status `rejected`).
- Deactivation, not deletion, is the default for anything referenced by bookings (FKs will block deletes anyway — map FK errors to "Utilisé par des réservations — désactivez plutôt").

## 5. `/admin/tarifs` (PricingPage) — versioned pricing

**Query** `['pricing','draft']` — on open: if no draft exists, call `clone_pricing_version()` (copies published → draft), then edit draft rows in place (the inputs already exist):
- Table 1: `pricing_rules` per body style — base € + labor €/min (glass factor is read-only display from `body_styles`).
- Table 2: `zone_pricing` grid zone × VLT — every cell editable; keep the ⚠ styling on front-zone cells < 70% (they remain priced — they're sellable with ack).
- Also editable here: `limo_supplement` and `limo_vlt_threshold` from `app_settings` (matches the "≤20% = film limousine" hint).
- **Publier la nouvelle grille** → `publish_pricing(draftId)` → invalidate `['pricing']`, `['catalog']`. Footer "Dernière révision" = published version `published_at` + author.
- Client quotes always read the published version — drafts never leak (RLS enforces).

## 6. `/admin/config` (ConfigPage)

**Queries** `['config','hours']`, `['config','blackouts']`, `['config','settings']`.
- Hours per weekday: toggle + open/close time inputs → upsert `workshop_hours`. Warn (non-blocking) if shrinking hours conflicts with existing future bookings (query count, show "3 réservations existantes hors nouvelle plage").
- Créneaux & capacité: granularity (15/30/60), bay count, cancellation window (12/24/48h) → `app_settings` updates. Changing granularity only affects future availability computation — no data migration.
- Jours bloqués: list + "+ Bloquer une date" (date + reason) + ✕ delete. Same conflict warning if a blackout lands on existing bookings (admin then cancels/reschedules them from the queue).
- Notifications block: read-only status pills in V1 (email confirmations/reminders are always on; SMS = V2). 
- Add a small "Compte" card: change-password form (`updateUser({ password })`).
- **Enregistrer la configuration** → batch the dirty mutations; disable while pending.

## 7. Booking drawer (new shared component, used by Queue/Agenda/Clients)

Right-side panel showing everything about one booking:
- Header: reference, StatusPill, price total (+ breakdown from `price_breakdown`), legal flag badge (amber "ack" when `non_compliant_ack`).
- Client: contact snapshot (name/phone/email — tap-to-call `tel:` link), linked profile if any.
- Vehicle: variant chain + plate/year if a garage vehicle is attached.
- Specs: zone chips with VLT (illegal ones in warning style, as QueuePage does).
- Timeline: `booking_status_history` (who/when).
- **Admin notes**: textarea → upsert `booking_admin_notes` (never visible to clients — separate table).
- **Photos**: before/after upload (Storage path `bookings/<id>/…` + `booking_photos` row), thumbnails, delete.
- **Garantie**: issue warranty (years select) → `bookings_warranty` upsert; shows on the client portal.
- Actions: legal status transitions only (buttons computed from the transition map), cancel with reason.

## 8. Admin API surface summary (`src/api/admin.ts` et al.)

| Function | Backing |
|---|---|
| `getQueue(day)` / `getAgenda(weekStart)` | select on `bookings` + joins (admin RLS) |
| `advanceStatus(id, to, note?)` | `set_booking_status` |
| `adminCreateBooking(payload)` | `admin_create_booking` |
| `getClients(search)` / `updateClientProfile` | `profiles` (+aggregates view if needed) |
| taxonomy CRUD | direct table ops (admin RLS) |
| `resolveVehicleRequest` / `rejectVehicleRequest` | RPC / update |
| `getDraftPricing` / `updateDraftCell` / `publishPricing` | tables + RPCs |
| `getWorkshopConfig` / `saveHours` / `saveSettings` / `addBlackout` / `removeBlackout` | tables |
| `uploadBookingPhoto` / `deleteBookingPhoto` | Storage + `booking_photos` |
| `saveAdminNotes(bookingId, notes)` | `booking_admin_notes` upsert |
| `issueWarranty(bookingId, years)` | `bookings_warranty` upsert |
