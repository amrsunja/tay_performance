-- 0009 — allow deleting users (incl. admins) from the dashboard.
--
-- Deleting an auth user cascades to public.profiles, but several audit/ownership
-- columns referenced profiles(id) with the default NO ACTION — so any admin who
-- had confirmed a booking, published pricing or added a blackout could never be
-- deleted ("update or delete on table profiles violates foreign key constraint").
-- Audit references become NULL when the author account is removed; the audited
-- rows themselves are kept.

alter table public.blackout_dates
  drop constraint if exists blackout_dates_created_by_fkey,
  add constraint blackout_dates_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.app_settings
  drop constraint if exists app_settings_updated_by_fkey,
  add constraint app_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.pricing_versions
  drop constraint if exists pricing_versions_created_by_fkey,
  add constraint pricing_versions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.booking_status_history
  drop constraint if exists booking_status_history_changed_by_fkey,
  add constraint booking_status_history_changed_by_fkey
    foreign key (changed_by) references public.profiles(id) on delete set null;

alter table public.booking_photos
  drop constraint if exists booking_photos_created_by_fkey,
  add constraint booking_photos_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.bookings_warranty
  drop constraint if exists bookings_warranty_issued_by_fkey,
  add constraint bookings_warranty_issued_by_fkey
    foreign key (issued_by) references public.profiles(id) on delete set null;

alter table public.vehicle_requests
  drop constraint if exists vehicle_requests_resolved_by_fkey,
  add constraint vehicle_requests_resolved_by_fkey
    foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.booking_admin_notes
  drop constraint if exists booking_admin_notes_updated_by_fkey,
  add constraint booking_admin_notes_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null;
