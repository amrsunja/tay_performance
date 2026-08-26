# 04 — Business Logic Engines (Pricing · Legality · Availability · Booking Lifecycle)

This is the contract for every server-side rule. All functions below are `security definer set search_path = public` and follow the rules in `03_AUTH_AND_SECURITY.md` §3. The client mirrors the pure math (pricing/duration/legality) for instant UX, using the **same fetched inputs** — but the RPC snapshot is the only truth stored.

---

## 1. Input shape shared by quote & booking

```
p_specs jsonb  —  [{ "zone_code": "rear_sides", "vlt_percent": 20 }, …]
```
Validation (in SQL): non-empty array; every `zone_code` exists in `tint_zones` and `is_active`; every `vlt_percent` exists in `vlt_levels`; no duplicate zones. The UI builds this from the draft state: selected zones × the applicable group slider (`avant` zones get `frontVlt`, everything else `rearVlt`).

---

## 2. Duration engine

```
duration_raw = vehicle_variants.base_labor_minutes        -- vehicle overhead (frameless doors, etc.)
             + Σ tint_zones.base_minutes  for each selected zone
duration_min = ceil(duration_raw / slot_granularity_min) * slot_granularity_min
```
`slot_granularity_min` from `app_settings` (seed 30). The **snapped** value is what the calendar fits and what lands on the booking. (UI's `formatDuration` displays it as `~1h 30min`.)

## 3. Pricing engine

```
base   = v_current_pricing_rules.base_price          [variant's body_style]
zones  = Σ v_current_zone_pricing.price_delta        [each (zone_code, vlt_percent)]
labor  = duration_min × v_current_pricing_rules.labor_rate_per_min   [same body_style row]
limo   = limo_supplement  if any spec.vlt_percent ≤ limo_vlt_threshold  else 0
price_total = base + zones + labor + limo            -- numeric(10,2)
```
Snapshot written to `bookings.price_breakdown`:
```json
{ "base": 240.00, "zones": [{"zone_code":"rear_sides","vlt_percent":20,"delta":70.00}, …],
  "labor": {"minutes": 120, "rate": 0.40, "amount": 48.00},
  "limo_supplement": 30.00, "total": 388.00, "pricing_version_id": "…" }
```
The engine reads **only the published pricing version**. If none is published, quoting fails loudly (admin must publish; the seed publishes v1).

## 4. Legal compliance engine (France 2026)

Constant: front glazing must transmit **≥ 70% VLT** (`FRONT_LEGAL_MIN_VLT = 70` — already in `types/domain.ts`; the DB derives it from `tint_zones.is_front` + `vlt_levels.is_front_legal`).

Per spec row: `is_legal = (not tint_zones.is_front) or (vlt_percent >= 70)`.
Booking-level:
- all legal → `legal_flag = 'compliant'`;
- any illegal → the RPC **requires** `p_ack = true`, else `raise exception 'ILLEGAL_SPEC_REQUIRES_ACK'`; with ack → `legal_flag = 'non_compliant_ack'`.

UI copy already exists (warn box: "≥70% VLT à l'avant… 135 €, −3 points"). Phase 2 adds the explicit ack checkbox ("J'accepte — usage circuit/privé") gating the CTA when `quote.nonCompliant`. Server enforces regardless of UI.

## 5. `quote_booking` RPC (pure, no writes)

```sql
create or replace function public.quote_booking(p_variant_id uuid, p_specs jsonb)
returns jsonb …
```
Returns `{ duration_min, price_breakdown, specs: [{zone_code, vlt_percent, delta, minutes, is_legal}], compliant }`. Used by: ConfigStep (authoritative refresh of the local live math — call it debounced on draft change), CalendarStep (duration for availability), and internally by `create_booking` (same SQL factored into a private function `_compute_quote(p_variant_id, p_specs)` so quote and booking can never diverge).

## 6. Availability engine — `get_available_slots`

```sql
create or replace function public.get_available_slots(p_day date, p_duration_min int)
returns table (slot_start timestamptz, slot_end timestamptz, bay_index int, state text)
```
Algorithm (all in `Europe/Paris` from `app_settings.timezone`):
1. Reject `p_day` in the past or beyond `booking_horizon_days`.
2. `delete from booking_holds where expires_at < now();` (cheap, keeps the exclusion constraint honest).
3. Look up `workshop_hours` for `extract(isodow from p_day)`; if closed or `p_day` in `blackout_dates` → return empty.
4. Generate candidate starts: `open_time` → `close_time`, step `slot_granularity_min`, for each `bay_index` in `1..bay_count`.
5. A candidate is **offered** (`state='available'`) iff:
   - `slot_end = slot_start + p_duration_min` ≤ close_time (full job fits before closing);
   - `slot_start > now() + min_lead_time_hours` (for today);
   - `tstzrange(slot_start, slot_end)` overlaps **no** row of `bookings` (status in requested/confirmed/in_progress, same bay) and **no** live row of `booking_holds` (same bay) — except the caller's own hold (`user_id = auth.uid()`), which reports `state='held_by_me'`.
   Otherwise `state='taken'` (return taken rows too — the UI greys them; that matches the design's slot states).
6. Order by bay, slot_start.

Client usage (CalendarStep): month grid calls this per visible day *only for day-level summary*? No — keep it cheap: one RPC `get_month_availability(p_month date, p_duration_min int)` returning per-day `{day, state: past|closed|full|available, free_count}` implemented server-side by looping the same logic (or a lateral join); then `get_available_slots` for the selected day. Two functions, same core, both defined in this migration. This replaces `calendar.ts`'s `dayAvailability`/`daySlots` mocks 1:1 (`past|closed|full|available` states already exist in the UI).

Freshness: refetch on day select, window focus, 30 s interval, and after any failed hold/booking (see `02` §6 — no realtime for anonymous availability).

## 7. Hold engine — `hold_slot` / `release_hold`

```sql
create or replace function public.hold_slot(p_slot_start timestamptz, p_duration_min int, p_bay int default 1)
returns jsonb  -- { hold_id, slot_start, slot_end, expires_at }
```
1. Auth required. 2. Purge expired holds. 3. `delete from booking_holds where user_id = auth.uid()` (one live hold per user; also lets a user switch slots freely). 4. Validate the slot is still offered (re-run the §6 predicate for this one candidate). 5. Insert hold with `expires_at = now() + hold_ttl_minutes`. The unique/exclusion constraints are the final arbiter — catch `exclusion_violation` and raise `'SLOT_TAKEN'`.

`release_hold()` = delete own hold (used by "← Modifier la configuration" and unmount).
UI: on slot click → `hold_slot`; show the design's `held` state with mono countdown from `expires_at`; if it expires, re-grey and toast "Créneau expiré — choisissez à nouveau".

## 8. Booking creation — `create_booking`

```sql
create or replace function public.create_booking(
  p_hold_id uuid,
  p_variant_id uuid,
  p_vehicle_id uuid,          -- nullable; must belong to auth.uid() if provided
  p_specs jsonb,
  p_contact_name text, p_contact_phone text, p_contact_email text,
  p_client_notes text default null,
  p_ack boolean default false
) returns jsonb               -- the full booking row + specs, incl. reference
```
Transaction steps:
1. Auth required; fetch the hold: must exist, `user_id = auth.uid()`, `expires_at > now()` → else `'HOLD_EXPIRED'`.
2. Validate contact: non-empty name + phone; email shape if present.
3. `_compute_quote(p_variant_id, p_specs)` → duration, price, per-spec legality. **Recheck** `duration_min` fits the held window (`hold.slot_end - hold.slot_start >= duration_min`) — if the user changed zones after holding, `'DURATION_CHANGED'` (UI returns to calendar with new duration).
4. Legality gate (§4) with `p_ack`.
5. Insert `bookings` (status `requested`, reference from `next_booking_reference()`, snapshots, `pricing_version_id`), insert `booking_tint_specs`, insert `booking_status_history (null → requested)`, delete the hold.
6. Exclusion-constraint violation ⇒ `'SLOT_TAKEN'` (someone confirmed between hold cleanup races — the constraint, not the hold, is the guarantee).
7. Return the row. UI then shows the existing ConfirmStep — **update its copy**: status is "Demande envoyée" (requested), text "Votre créneau est réservé — confirmation par l'atelier sous peu" (see `06_CLIENT_FLOWS.md` §4; current copy says "Rendez-vous confirmé" which is now wrong).

Post-insert side effect: "booking received" email to `contact_email` (if provided) + notification email to the workshop — via Edge Function, §12.

## 9. Client cancel / reschedule

```sql
create or replace function public.cancel_booking_client(p_booking_id uuid, p_reason text default null)
```
Own booking; status in (`requested`,`confirmed`); `now() < slot_start - cancellation_cutoff_hours` → else `'CUTOFF_PASSED'` (UI label already says "Annuler (≥24h avant)"). Sets `cancelled`, history row, frees the slot implicitly (constraint ignores cancelled).

Reschedule V1 = cancel + rebook (UI's "Reprogrammer" routes to `/reserver` pre-filled with the same vehicle+specs, then calls cancel on success of the new booking — implement as `reschedule_booking(p_old, p_hold, …)` RPC doing both in one transaction so the client never ends up with zero bookings).

## 10. Admin lifecycle — `set_booking_status`

```sql
create or replace function public.set_booking_status(p_booking_id uuid, p_status booking_status, p_note text default null)
```
Admin-only. Validates the transition against the map in `02` §4 (`raise 'ILLEGAL_TRANSITION'` otherwise), updates, writes history with `changed_by = auth.uid()`. Side effects:
- `requested → confirmed`: confirmation email to client (the real "Rendez-vous confirmé" mail).
- `confirmed → no_show`, `→ cancelled`: informational email.
- `in_progress → completed`: completion email ("photos + garantie dans votre espace" once photos/warranty attached).

`admin_create_booking(...)` — same pipeline as `create_booking` minus hold and ownership (admin books for a walk-in/phone client): takes slot directly, revalidates availability, `created_by_admin = true`, `user_id` null or an existing client's id, initial status `confirmed`. Used by the topbar "+ Nouvelle réservation".

## 11. Pricing publication — `publish_pricing`

Admin edits are staged on a `draft` version (`clone_pricing_version()` RPC: copy published → new draft; the PricingPage edits draft rows via normal admin-RLS updates). `publish_pricing(p_version_id)`: transaction — archive current published, set draft → published + `published_at`. Existing bookings keep their `pricing_version_id` snapshot; nothing recomputes. This implements the PricingPage's "Publier la nouvelle grille" button and the "versionné (valid_from)" hint.

`resolve_vehicle_request(p_request_id, p_variant_id)` — admin-only: link/insert taxonomy done separately via CRUD, then this marks the lead `resolved` (+`resolved_by/at`). `status='rejected'` for junk.

## 12. Notifications (V1 = email only)

Edge Function `send-booking-email` (Deno + Resend; `RESEND_API_KEY` secret). Trigger path: Database Webhook on `booking_status_history` insert (+ on `bookings` insert) → Edge Function → compose French email by event type:

| Event | To | Template |
|---|---|---|
| booking created (`requested`) | client + workshop inbox | "Demande reçue — {reference}" with recap (vehicle, zones/VLT, date, price, address) |
| `→ confirmed` | client | "Rendez-vous confirmé — {reference}" |
| `→ cancelled` (by either side) | client | cancellation notice |
| J-1 reminder | client | pg_cron daily job selects tomorrow's confirmed bookings → invokes the function |
| `→ completed` | client | thanks + link to portal (photos/warranty) |

The function receives only ids, re-reads data with the service key, and must never include admin notes. SMS is V2 (ConfigPage already shows it as "V2").

## 13. Error code vocabulary (RPC → UI)

RPCs raise exceptions with these message codes; `src/api/*` maps them to French toasts:
`SLOT_TAKEN` ("Ce créneau vient d'être pris"), `HOLD_EXPIRED`, `DURATION_CHANGED`, `CUTOFF_PASSED` ("Annulation impossible à moins de 24h"), `ILLEGAL_SPEC_REQUIRES_ACK`, `ILLEGAL_TRANSITION`, `NO_PUBLISHED_PRICING`, `NOT_FOUND`, `FORBIDDEN`. Keep the vocabulary closed — the UI switch must be exhaustive.

## 14. Concurrency truth table (what guarantees what)

| Race | Guard |
|---|---|
| Two users hold the same slot | `booking_holds` exclusion constraint |
| Hold expired between UI and confirm | `create_booking` step 1 |
| Two `create_booking` land simultaneously (hold table bypassed/raced) | `bookings_no_overlap` exclusion constraint — the final arbiter |
| Admin manual booking vs client booking | same exclusion constraint |
| Zones changed after holding (duration grew) | `create_booking` step 3 |
| Pricing published mid-checkout | quote recomputed inside `create_booking` against current published version — price may differ from the preview by design; UI shows returned snapshot |
