-- 0006 — storage buckets & policies
-- booking-photos: private; path convention bookings/<booking_id>/<uuid>.<ext>
-- brand-assets:   public read (make logos etc.)

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

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
create policy "photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-photos' and public.is_admin());
create policy "photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'booking-photos' and public.is_admin())
  with check (bucket_id = 'booking-photos' and public.is_admin());
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'booking-photos' and public.is_admin());

-- brand assets: public read, admin write
create policy "brand read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'brand-assets');
create policy "brand admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and public.is_admin());
create policy "brand admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and public.is_admin());
