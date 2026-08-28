-- TEST HARNESS ONLY — never run on Supabase.
-- Stubs the parts of the Supabase platform that migrations reference
-- (auth schema, roles, storage schema) so the migration set can be
-- validated on a bare Postgres.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  phone         text,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- auth.uid() reads a session GUC so tests can impersonate users
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
create or replace function auth.jwt()
returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('test.jwt', true), '')::jsonb, '{}'::jsonb)
$$;

-- minimal storage schema for 0006_storage.sql
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant all on storage.buckets to anon, authenticated;

-- Supabase grants these to API roles
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
