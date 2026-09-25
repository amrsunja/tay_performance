-- 0020 — profiles.phone always E.164 ("+33612345678")
--
-- Supabase Auth stores auth.users.phone WITHOUT the "+" ("33612345678"). The 0008 triggers
-- copied it as-is, so the booking form could not recognise the number of a signed-in client
-- and never pre-filled it. Triggers now add the "+", and existing rows are backfilled.
-- National numbers ("06…") are left alone — they are not international digits.

create or replace function public._auth_phone_e164(p text)
returns text language sql immutable
as $$
  select case when p ~ '^[1-9][0-9]{7,14}$' then '+' || p else p end
$$;

create or replace function public.handle_user_phone_linked()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.phone is not null and new.phone is distinct from old.phone then
    update public.profiles
      set phone = public._auth_phone_e164(new.phone), is_anonymous = false, updated_at = now()
      where id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_anonymous, email, phone)
  values (new.id, coalesce(new.is_anonymous, true), new.email, public._auth_phone_e164(new.phone))
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles
   set phone = '+' || phone, updated_at = now()
 where phone ~ '^[1-9][0-9]{7,14}$';
