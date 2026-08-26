# 06 — Client-Facing Flows (Funnel & Portal)

The client experience must stay exactly as designed (dark "digital garage", French copy, motion rules from `design_tech_doc.md`). This doc specifies behavior changes only. No login wall anywhere — identity is an anonymous session created lazily (`03` §1.1).

---

## 1. Booking funnel `/reserver` — step order becomes: **Véhicule → Configuration → Créneau → Confirmé**

The shipped funnel has 3 steps with a hardcoded `DEMO_VEHICLE`. Phase 2 prepends a vehicle step and threads a real `variantId` through the draft.

### 1.1 New `VehicleStep` (the BRD's multi-step filter)

State machine (BRD §2.1 / design doc §3.1): Make → Model → Year (resolves generation) → Body style → emits `variant_id`.

- Data: `['taxonomy','makes']` (active, ordered), then dependent queries per selection. Only render children that exist (no dead ends); parent change resets descendants.
- Year picker resolves the generation via `year_start ≤ year ≤ coalesce(year_end, 9999)`; if the model has a single active generation, auto-skip.
- Body style step shows only styles that have an **active variant** for the resolved generation.
- Funnel state is URL-serialized: `/reserver?make=bmw&model=serie-3&gen=g20&body=berline_4p` (shareable quotes, back-button integrity). On load, hydrate the draft from params.
- **"Je ne trouve pas mon véhicule"** → inline free-text form → insert `vehicle_requests` (creates the anonymous session if none — first identity-requiring action) → show "Merci — on l'ajoute et on vous répond" with the contact-email field (optional).
- If the user came from `/garage` ("Réserver une pose" on a vehicle card), skip this step entirely — draft starts with that vehicle's `variant_id` and `vehicle_id`; the existing "changer →" chip in ConfigStep returns to VehicleStep.

### 1.2 ConfigStep (exists — parameterize)

- Zones/prices/minutes come from `['catalog','zones']` (tint_zones ⋈ current zone_pricing at the applicable VLT) instead of `TINT_ZONES`; VLT stops from `vlt_levels`. The `layerSrc` preview mapping stays a frontend `Record<TintZoneCode, string>` (bundled PNGs; zones without a layer asset — `rear_window`, `panoramic_roof` — simply have no overlay, as today).
- Quote card switches to the **full formula** (`04` §3): base + zones + labor + limo supplement, computed locally from fetched params for instant slider feedback, reconciled by a debounced `quote_booking` call (authoritative numbers replace local ones when they arrive; they should match — log a console warning if not).
- Legal ack: when `quote.nonCompliant`, the existing warn box gains a required checkbox — `« J'accepte la pose hors conformité (usage circuit/privé) »`. CTA "Réserver mon créneau" stays disabled until checked. Ack state lives in the draft and is passed to `create_booking`.
- TintBlueprint unchanged (opacity = `(85 − VLT)/80`, layer order `front_sides < rear_sides < pare_brise`).

### 1.3 CalendarStep (exists — wire to server truth)

- Month grid: `get_month_availability(month, duration_min)` → per-day `past|closed|full|available + free_count` (drop the deterministic mock in `calendar.ts`; keep its date-format helpers).
- Day selection: `get_available_slots(day, duration_min)` → render slot buttons; `taken` slots disabled (existing `slotOff` style).
- Slot click → `hold_slot` (this triggers lazy anonymous sign-in if needed, inside a small "sécurisation du créneau…" pending state). On success: selected style + **mono countdown** to `expires_at` (design doc §3.2 `held` state). On `SLOT_TAKEN`: toast "Ce créneau vient d'être pris", refetch slots.
- "← Modifier la configuration" and unmount → `release_hold`.
- Duration displayed comes from the quote (snapped); if the user goes back and changes zones, the hold is released and availability refetches with the new duration.
- Refresh policy: refetch slots on focus + every 30 s (no realtime for anonymous users — `02` §6).

### 1.4 New `ContactFields` + confirm action

Between slot selection and the CTA (inside CalendarStep's slots card, above "Confirmer le rendez-vous"), or as a compact block: `Nom`* · `Téléphone`* · `E-mail` (optional but encouraged: "pour recevoir la confirmation"). Prefill from `profiles` when known; save back to own profile on success.

CTA → `create_booking(hold_id, variant_id, vehicle_id?, specs, contact…, notes?, ack)`. Pending state on the button (spinner allowed — terminal action). Error mapping per `04` §13.

### 1.5 ConfirmStep (exists — copy + data changes)

- Use the **returned booking** (reference, real date/time, price snapshot) instead of client-side `bookingReference()`.
- Status is `requested`, so change copy: kicker "Demande envoyée", headline "Votre créneau est réservé.", body "L'atelier confirme votre rendez-vous rapidement — vous recevrez un e-mail dès validation." Keep the ✓ badge but in `status/pending` amber until confirmed (StatusPill semantics).
- Add the **email-link offer** (product decision): if session is anonymous — card "Retrouvez vos réservations sur tous vos appareils" with the email prefilled from contact → `updateUser({ email })` → "Vérifiez votre boîte mail". Dismissible, never blocking.
- Secondary actions: "Voir mes réservations" → `/reservations`; "Nouvelle réservation" (restart draft).

### 1.6 Garage save

After booking with a funnel-resolved vehicle (not from garage), silently offer: "Ajouter BMW G20 Série 3 à Mon Garage ?" → insert `vehicles` (variant + optional year) → next time it's 1-tap.

---

## 2. Portal — `/garage` (GaragePage)

- Query `['garage']`: own `vehicles` joined to variant chain. Empty state: the existing ghost-car card only.
- "Ajouter un véhicule" card → VehicleStep in a modal (same component) → insert. "Modifier" → edit nickname/plate/color/year; delete allowed (bookings keep `variant_id` snapshot, FK `on delete set null` on `vehicle_id`).
- "Réserver une pose →" → `/reserver` with draft pre-seeded (skip VehicleStep, §1.1).
- If no session exists yet, the page shows the empty state; any action mints the anonymous session.

## 3. Portal — `/reservations` (BookingsPage)

- Query `['my-bookings']`: own bookings + specs + photos + warranty, split upcoming (`requested|confirmed|in_progress`) / history — exactly the existing grouping.
- Timeline component maps 1:1 to `booking_status_history`/current status (already handles requested→…→completed; cancelled/no_show render StatusPill only, as now).
- Photos: signed URLs (1 h) from `booking_photos`. Warranty pill from `bookings_warranty`.
- **Annuler (≥24h avant)**: enabled only when the cutoff allows (compute client-side from `app_settings` for UX; server re-enforces). Confirm dialog → `cancel_booking_client` → invalidate. On `CUTOFF_PASSED`: explanatory toast with the workshop phone from settings.
- **Reprogrammer**: `/reserver` pre-filled (same variant/specs) in "reschedule mode" carrying `old_booking_id`; final CTA calls `reschedule_booking` (`04` §9).
- **Re-réserver cette pose** (completed): same pre-fill, normal create.
- Realtime: subscribe to own `bookings` → invalidate on change (status pill flips live when admin confirms).
- Anonymous user, new device (no history): show gentle hint card "Vous aviez lié un e-mail ? Connectez-vous" → `signInWithOtp` magic-link form.

## 4. Landing `/`

Static; only wire: header/footer phone + address from `app_settings` (optional), CTA links unchanged. No auth UI in the header for V1 (portal links just work with the local session; an avatar/menu is V2 polish).

## 5. Copy inventory to add (French)

- Ack checkbox: « J'accepte la pose hors conformité (usage circuit/privé) »
- Hold countdown: « Créneau réservé — {mm:ss} »; expiry toast: « Créneau expiré — choisissez à nouveau »
- Slot race: « Ce créneau vient d'être pris »
- Requested state: « Demande envoyée » / « L'atelier confirme rapidement »
- Email link card: « Retrouvez vos réservations sur tous vos appareils »
- Cutoff error: « Annulation impossible à moins de {h}h du rendez-vous — appelez-nous au {phone} »
- Vehicle request thanks: « Merci — on ajoute votre véhicule et on vous répond »
