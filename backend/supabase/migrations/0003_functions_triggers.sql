-- 0003 — plumbing: role helper, auth triggers, updated_at, pricing views, reference generator

-- --- role helper used by every admin policy ---
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- --- auto-create a profile for every new auth user (incl. anonymous) ---
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_anonymous, email)
  values (new.id, coalesce(new.is_anonymous, true), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- when an anonymous user links an email, sync the profile ---
create or replace function public.handle_user_email_linked()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email is distinct from old.email then
    update public.profiles
      set email = new.email, is_anonymous = false, updated_at = now()
      where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_linked
  after update of email on auth.users
  for each row execute function public.handle_user_email_linked();

-- --- updated_at bookkeeping ---
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- --- typed settings accessors (single source for tunables) ---
create or replace function public._setting_text(p_key text)
returns text language sql stable
set search_path = public
as $$ select value #>> '{}' from public.app_settings where key = p_key $$;

create or replace function public._setting_int(p_key text)
returns int language sql stable
set search_path = public
as $$ select (value #>> '{}')::int from public.app_settings where key = p_key $$;

create or replace function public._setting_numeric(p_key text)
returns numeric language sql stable
set search_path = public
as $$ select (value #>> '{}')::numeric from public.app_settings where key = p_key $$;

-- --- current published pricing helpers ---
create or replace function public.current_pricing_version_id()
returns uuid language sql stable
set search_path = public
as $$
  select id from public.pricing_versions where status = 'published' limit 1;
$$;

create or replace view public.v_current_pricing_rules
with (security_invoker = on) as
  select pr.* from public.pricing_rules pr
  where pr.version_id = public.current_pricing_version_id();

create or replace view public.v_current_zone_pricing
with (security_invoker = on) as
  select zp.* from public.zone_pricing zp
  where zp.version_id = public.current_pricing_version_id();

-- --- booking reference generator: TP-<year>-<seq> ---
create or replace function public.next_booking_reference()
returns text language sql volatile
set search_path = public
as $$
  select 'TP-' || extract(year from now())::int || '-' || nextval('public.booking_ref_seq')::text;
$$;
