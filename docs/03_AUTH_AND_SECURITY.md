# 03 — Auth Model & Security (RLS, Storage, Hardening)

---

## 1. Auth model

Two kinds of principals, one Supabase Auth instance:

### 1.1 Clients — anonymous sessions (+ optional email link)

- **Enable Anonymous Sign-Ins** in Supabase Auth settings, **with Turnstile CAPTCHA enabled** (Auth → Attack protection) — anonymous sign-in without CAPTCHA is a free user-minting endpoint for bots.
- The SPA calls `supabase.auth.signInAnonymously()` **lazily**: on the first action that needs identity (holding a slot, adding a vehicle to the garage, submitting a vehicle request) — never on landing-page load. Session persists in the browser (`persistSession: true`, default).
- Anonymous users are the `authenticated` Postgres role with `auth.jwt()->>'is_anonymous' = 'true'`. They can do everything a client can: garage, drafts, holds, bookings, history with statuses and prices.
- Booking always captures `contact_name` / `contact_phone` / `contact_email` on the booking row itself (the workshop must reach the customer regardless of auth state).
- **Email linking (recovery path):** after a successful booking, offer "Recevoir mes réservations sur cet e-mail → retrouvez votre historique sur n'importe quel appareil". Implementation: `supabase.auth.updateUser({ email })` → user clicks the confirmation magic link → the account is no longer anonymous, same `user_id`, all rows keep working. The `on_auth_user_email_linked` trigger (see `02` §3) syncs `profiles`. Later, the user signs in on any device with `signInWithOtp({ email })` (magic link — enable Email provider, disable password sign-up).
- Do **not** implement account merging (anonymous history + existing email account) in V1; if `updateUser` fails with "email already registered", show: "Cet e-mail a déjà un compte — connectez-vous avec le lien magique" and let them sign in (their current anonymous history stays on the old id; acceptable V1 tradeoff, document in UI copy).

### 1.2 Admins — dashboard-created, password sign-in

- No sign-up path in the app. Creation procedure (runbook for the owner):
  1. Supabase Dashboard → Authentication → Users → **Add user** → email + strong password, "Auto Confirm" on.
  2. SQL editor: `update public.profiles set role = 'admin', is_anonymous = false, full_name = 'Prénom Nom' where id = '<user-uuid>';`
  3. Hand the credentials to the person; they sign in at `/admin/login` and should change the password (`updateUser({ password })` from a small "change password" form in admin config).
- `/admin/login`: `signInWithPassword({ email, password })`. On success fetch own profile; if `role <> 'admin'` sign out immediately and show a generic error (don't reveal that the account exists but isn't admin).
- The `admin` role lives in `public.profiles.role`, checked by the `is_admin()` SECURITY DEFINER function (`02` §3). This is deliberate (simplest correct pattern): no custom claims hook needed; `is_admin()` is `stable` so it's evaluated once per statement, and the definer bypasses the profiles RLS chicken-and-egg.
- Never demote/promote from the app. Role changes are dashboard/SQL-only by design (matches the product decision).

### 1.3 What `anon` (no session) can do

Only read public catalog data (taxonomy, zones, VLT levels, published pricing, workshop hours, blackouts) so the landing page and the configurator's first render work before any session exists. Everything else requires `authenticated`.

---

## 2. RLS — `0004_rls.sql`

Principles: **enable RLS on every table**; default deny; separate policies per command (`select`/`insert`/`update`/`delete`) — no `for all`; client writes that matter go through SECURITY DEFINER RPCs, so tables like `bookings` need **no** client `insert` policy at all.

```sql
-- enable on every table
alter table public.profiles              enable row level security;
alter table public.makes                 enable row level security;
alter table public.models                enable row level security;
alter table public.generations          enable row level security;
alter table public.body_styles           enable row level security;
alter table public.vehicle_variants      enable row level security;
alter table public.vehicles              enable row level security;
alter table public.tint_zones            enable row level security;
alter table public.vlt_levels            enable row level security;
alter table public.pricing_versions      enable row level security;
alter table public.pricing_rules         enable row level security;
alter table public.zone_pricing          enable row level security;
alter table public.workshop_hours        enable row level security;
alter table public.blackout_dates        enable row level security;
alter table public.app_settings          enable row level security;
alter table public.booking_holds         enable row level security;
alter table public.bookings              enable row level security;
alter table public.booking_tint_specs    enable row level security;
alter table public.booking_admin_notes   enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.booking_photos        enable row level security;
alter table public.bookings_warranty     enable row level security;
alter table public.vehicle_requests      enable row level security;

-- ===== public catalog: readable by everyone (incl. no-session anon), writable by admin =====
-- (repeat this pair for: makes, models, generations, body_styles, vehicle_variants,
--  tint_zones, vlt_levels, workshop_hours, blackout_dates)
create policy "catalog read"  on public.makes for select to anon, authenticated using (true);
create policy "admin insert"  on public.makes for insert to authenticated with check (public.is_admin());
create policy "admin update"  on public.makes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete"  on public.makes for delete to authenticated using (public.is_admin());

-- pricing: only the PUBLISHED version is visible to non-admins
create policy "read published versions" on public.pricing_versions for select to anon, authenticated
  using (status = 'published' or public.is_admin());
create policy "admin write versions" on public.pricing_versions for insert to authenticated with check (public.is_admin());
create policy "admin update versions" on public.pricing_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read published rules" on public.pricing_rules for select to anon, authenticated
  using (public.is_admin() or version_id = public.current_pricing_version_id());
create policy "admin write rules" on public.pricing_rules for insert to authenticated with check (public.is_admin());
create policy "admin update rules" on public.pricing_rules for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete rules" on public.pricing_rules for delete to authenticated using (public.is_admin());
-- (identical trio for zone_pricing)

-- app_settings: sensitive-free config; readable by all (the UI needs cutoffs/supplements), admin-writable
create policy "settings read"  on public.app_settings for select to anon, authenticated using (true);
create policy "settings write" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "settings insert" on public.app_settings for insert to authenticated with check (public.is_admin());

-- ===== profiles =====
create policy "own profile read"   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check ((id = auth.uid() and role = 'client') or public.is_admin());
-- ^ a client can edit their own name/phone/email but can NEVER change role (with check pins role='client').
-- inserts happen only via the auth trigger (security definer) — no insert policy.

-- ===== vehicles (garage) =====
create policy "own vehicles read"   on public.vehicles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own vehicles insert" on public.vehicles for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy "own vehicles update" on public.vehicles for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "own vehicles delete" on public.vehicles for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===== bookings: read own / admin; ALL writes via RPCs (no insert/update policy for clients) =====
create policy "own bookings read" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- admin direct updates (notes-free fields) still funnel through set_booking_status RPC;
-- give admin update for edge edits:
create policy "admin bookings update" on public.bookings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "own specs read" on public.booking_tint_specs for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

create policy "own history read" on public.booking_status_history for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

create policy "own photos read" on public.booking_photos for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "admin photos write" on public.booking_photos for insert to authenticated with check (public.is_admin());
create policy "admin photos delete" on public.booking_photos for delete to authenticated using (public.is_admin());

create policy "own warranty read" on public.bookings_warranty for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "admin warranty write" on public.bookings_warranty for insert to authenticated with check (public.is_admin());
create policy "admin warranty update" on public.bookings_warranty for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== admin-only tables: NO client policy at all =====
create policy "admin notes all-read"  on public.booking_admin_notes for select to authenticated using (public.is_admin());
create policy "admin notes insert"    on public.booking_admin_notes for insert to authenticated with check (public.is_admin());
create policy "admin notes update"    on public.booking_admin_notes for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== holds: own rows only; created via hold_slot RPC (definer), but reads are useful for countdown =====
create policy "own holds read"   on public.booking_holds for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own holds delete" on public.booking_holds for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===== vehicle requests =====
create policy "own requests read"   on public.vehicle_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own requests insert" on public.vehicle_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin requests update" on public.vehicle_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

Why bookings have **no client insert/update policies**: creation, cancellation and rescheduling are SECURITY DEFINER RPCs (`04_BUSINESS_LOGIC.md`). The RPC validates ownership, cutoffs, price and legality, then writes with definer rights. This makes "a client forged a cheap price / skipped the ack / edited someone's booking" structurally impossible, not merely policy-guarded.

---

## 3. SECURITY DEFINER function rules (apply to every RPC)

- `set search_path = public` (pin it — definer functions with mutable search_path are a classic privilege-escalation vector).
- First line of any client-facing RPC: resolve `auth.uid()`; if null → `raise exception 'not authenticated'`.
- `revoke all … from public; grant execute … to authenticated;` for client RPCs; admin RPCs additionally `if not public.is_admin() then raise exception 'forbidden'; end if;` as the first statement (grant execute to authenticated too — the check is inside).
- Never interpolate user input into dynamic SQL; use parameters only.
- Validate all money/duration inputs server-side from tables; ignore any client-provided totals.

---

## 4. Verification probe (run after every RLS change)

Save as `supabase/tests/rls_probe.sql` and run with three JWTs (no session / anonymous user A / admin) plus a second anonymous user B:

1. As **no session**: `select` on makes/zones/vlt/published pricing → rows; `select * from bookings` → 0 rows; any insert → error.
2. As **user A**: create booking via RPC; `select * from bookings` → only A's rows. `select * from booking_admin_notes` → 0 rows always.
3. As **user B**: `select * from bookings where id = '<A''s id>'` → 0 rows; `cancel_booking_client('<A''s id>')` → exception.
4. As **A**: `update profiles set role='admin' where id = auth.uid()` → rejected by `with check`.
5. As **admin**: sees all bookings; `set_booking_status` works; probe an illegal transition (`completed → confirmed`) → exception.
6. Two parallel `create_booking` for the same slot (script with two connections) → exactly one success, one exclusion-constraint failure mapped to the "slot taken" error.

---

## 5. Supabase Auth dashboard configuration checklist

- Providers: **Email** ON (magic link ON; password sign-**up** disabled — password sign-*in* stays for the dashboard-created admins), **Anonymous** ON.
- Attack protection: **Turnstile CAPTCHA** ON (protects `signInAnonymously` + OTP).
- Rate limits: keep defaults or tighten OTP sends (e.g. 4/hour).
- Email templates: French; magic-link template mentions Tay Performance branding.
- Site URL + redirect allow-list: production domain and `http://localhost:5173`.
- JWT expiry: default (1 h) is fine; sessions auto-refresh.
- **Auto-cleanup:** anonymous users who never booked can be purged periodically (dashboard SQL scheduled via pg_cron): delete `auth.users` where `is_anonymous` and `created_at < now() - interval '30 days'` and no bookings/vehicles — keeps the user table sane.

---

## 6. Storage policies (`booking-photos` private bucket)

```sql
-- read: admin, or the owner of the booking the object belongs to
create policy "photos read own" on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-photos' and (
      public.is_admin() or exists (
        select 1 from public.bookings b
        where b.id = ((storage.foldername(name))[2])::uuid   -- path: bookings/<booking_id>/file
          and b.user_id = auth.uid()
      )
    )
  );
-- write/delete: admin only
create policy "photos admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-photos' and public.is_admin());
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'booking-photos' and public.is_admin());

-- brand-assets bucket is public-read; admin write (same shape).
```
Upload flow: admin uploads via `supabase.storage.from('booking-photos').upload('bookings/<id>/<uuid>.jpg', file)` then inserts the `booking_photos` row (single api-layer function; if the row insert fails, delete the object). Client display uses `createSignedUrl(path, 3600)`.

---

## 7. Hardening checklist (beyond RLS)

1. **Keys:** anon key only in the SPA. Service-role key exists only in Edge Function env. Rotate if ever leaked into a bundle/commit.
2. **Exposed schemas:** API settings → expose only `public` (and `storage`). Nothing custom in `extensions`.
3. **Postgres roles:** never grant to `anon` beyond the catalog selects above; check `information_schema.role_table_grants` after migrations (supabase grants all by default — RLS is the gate, but also `revoke insert, update, delete on <catalog tables> from anon;` for defense in depth).
4. **Views:** any view over user data must be `security_invoker = on` (Postgres 15+) so RLS of the querying user applies.
5. **Realtime:** private channels only via RLS (postgres_changes). Don't broadcast booking payloads on public channels.
6. **Edge Functions:** verify JWT (`verify_jwt = true`) except public webhooks; validate payloads; never echo admin notes or other users' data.
7. **Input limits:** `client_notes`, `raw_text` capped (e.g. `check (char_length(client_notes) <= 2000)`); contact fields validated for shape in the RPC (basic regex; don't over-validate French phone formats).
8. **PII surface:** client-facing queries never join `profiles` of other users; admin list pages are admin-RLS-gated. Booking contact snapshot lives on the booking row (owner-visible — it's their own data).
9. **Backups:** enable PITR (paid tier) or at minimum daily scheduled backups before going live.
10. **No dashboard drift:** every schema/policy change is a migration file in the repo. The dashboard is read-only in practice, except Auth user creation (the documented admin runbook).
11. **Logs:** enable Postgres statement logging for RPC errors during rollout; watch for exclusion-constraint conflicts (they're expected under contention, not bugs).
12. **CORS:** restrict Auth redirect URLs and Storage CORS to the production domain + localhost.
