-- 0004 — Row Level Security: enable everywhere, default-deny, minimal grants
-- See docs/03_AUTH_AND_SECURITY.md

alter table public.profiles               enable row level security;
alter table public.makes                  enable row level security;
alter table public.models                 enable row level security;
alter table public.generations            enable row level security;
alter table public.body_styles            enable row level security;
alter table public.vehicle_variants       enable row level security;
alter table public.vehicles               enable row level security;
alter table public.tint_zones             enable row level security;
alter table public.vlt_levels             enable row level security;
alter table public.pricing_versions       enable row level security;
alter table public.pricing_rules          enable row level security;
alter table public.zone_pricing           enable row level security;
alter table public.workshop_hours         enable row level security;
alter table public.blackout_dates         enable row level security;
alter table public.app_settings           enable row level security;
alter table public.booking_holds          enable row level security;
alter table public.bookings               enable row level security;
alter table public.booking_tint_specs     enable row level security;
alter table public.booking_admin_notes    enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.booking_photos         enable row level security;
alter table public.bookings_warranty      enable row level security;
alter table public.vehicle_requests       enable row level security;

-- =====================================================================
-- public catalog: readable by everyone (incl. no-session anon), admin-writable
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['makes','models','generations','body_styles','vehicle_variants',
                           'tint_zones','vlt_levels','workshop_hours','blackout_dates']
  loop
    execute format('create policy "catalog read"  on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert"  on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update"  on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete"  on public.%I for delete to authenticated using (public.is_admin())', t);
    -- defense in depth: RLS is the gate, but strip write privileges from anon too
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

-- =====================================================================
-- pricing: only the PUBLISHED version visible to non-admins
-- =====================================================================
create policy "read published versions" on public.pricing_versions for select to anon, authenticated
  using (status = 'published' or public.is_admin());
create policy "admin insert versions" on public.pricing_versions for insert to authenticated with check (public.is_admin());
create policy "admin update versions" on public.pricing_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete versions" on public.pricing_versions for delete to authenticated using (public.is_admin());

create policy "read published rules" on public.pricing_rules for select to anon, authenticated
  using (public.is_admin() or version_id = public.current_pricing_version_id());
create policy "admin insert rules" on public.pricing_rules for insert to authenticated with check (public.is_admin());
create policy "admin update rules" on public.pricing_rules for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete rules" on public.pricing_rules for delete to authenticated using (public.is_admin());

create policy "read published zone pricing" on public.zone_pricing for select to anon, authenticated
  using (public.is_admin() or version_id = public.current_pricing_version_id());
create policy "admin insert zone pricing" on public.zone_pricing for insert to authenticated with check (public.is_admin());
create policy "admin update zone pricing" on public.zone_pricing for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete zone pricing" on public.zone_pricing for delete to authenticated using (public.is_admin());

-- =====================================================================
-- app_settings: readable by all (UI needs cutoffs/supplements), admin-writable
-- =====================================================================
create policy "settings read"   on public.app_settings for select to anon, authenticated using (true);
create policy "settings insert" on public.app_settings for insert to authenticated with check (public.is_admin());
create policy "settings update" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- profiles: own row (role pinned) or admin
-- =====================================================================
create policy "own profile read"   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check ((id = auth.uid() and role = 'client') or public.is_admin());
-- inserts happen only via the auth trigger (security definer) — no insert policy.

-- =====================================================================
-- vehicles (garage)
-- =====================================================================
create policy "own vehicles read"   on public.vehicles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own vehicles insert" on public.vehicles for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy "own vehicles update" on public.vehicles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "own vehicles delete" on public.vehicles for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- bookings: read own / admin; ALL client writes via SECURITY DEFINER RPCs
-- =====================================================================
create policy "own bookings read" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
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
create policy "admin photos insert" on public.booking_photos for insert to authenticated with check (public.is_admin());
create policy "admin photos delete" on public.booking_photos for delete to authenticated using (public.is_admin());

create policy "own warranty read" on public.bookings_warranty for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "admin warranty insert" on public.bookings_warranty for insert to authenticated with check (public.is_admin());
create policy "admin warranty update" on public.bookings_warranty for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin warranty delete" on public.bookings_warranty for delete to authenticated using (public.is_admin());

-- =====================================================================
-- admin-only tables: NO client policy at all
-- =====================================================================
create policy "admin notes read"   on public.booking_admin_notes for select to authenticated using (public.is_admin());
create policy "admin notes insert" on public.booking_admin_notes for insert to authenticated with check (public.is_admin());
create policy "admin notes update" on public.booking_admin_notes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin notes delete" on public.booking_admin_notes for delete to authenticated using (public.is_admin());

-- =====================================================================
-- holds: own rows only; created via hold_slot RPC (definer); reads power the countdown
-- =====================================================================
create policy "own holds read"   on public.booking_holds for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own holds delete" on public.booking_holds for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- vehicle requests
-- =====================================================================
create policy "own requests read"   on public.vehicle_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own requests insert" on public.vehicle_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin requests update" on public.vehicle_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin requests delete" on public.vehicle_requests for delete to authenticated
  using (public.is_admin());
