-- 0010 — worldwide catalog support
--   • generations.year_start nullable (imported models with unknown dates)
--   • body_styles.default_labor_minutes — admin-editable "surcoût pose" applied to
--     every variant created lazily (ensure_variant) or by the catalog import
--   • trigram search index over make + model + generation (search_vehicles RPC)
--   • ensure_variant RPC: any (generation, body style) pair can be resolved on demand
--   • vehicle_requests: phone + name, submit_vehicle_request RPC usable without a session
--   • admin_update_variant_minutes / admin bulk save for the "Surcoût (min)" editor

-- ============ taxonomy tweaks ============
alter table public.generations alter column year_start drop not null;
create unique index if not exists generations_model_name_uidx on public.generations (model_id, name);

alter table public.body_styles
  add column if not exists default_labor_minutes int not null default 15
    check (default_labor_minutes between 0 and 480);

update public.body_styles set default_labor_minutes = v.m
from (values
  ('citadine_3p'::public.body_style_code,10),('citadine_5p',10),('coupe_2p',15),('berline_4p',15),
  ('break_5p',20),('monospace',25),('suv_5p',25),('utilitaire',25),('pickup',25)
) as v(code, m)
where body_styles.code = v.code;

alter table public.makes add column if not exists country text;

-- ============ search text (denormalized, trigram-indexed) ============
-- Accent/case-insensitive normalisation without the unaccent extension (portable across
-- Supabase's `extensions` schema and the bare-Postgres test harness).
create or replace function public.norm_text(t text)
returns text language sql immutable strict parallel safe
as $$
  select regexp_replace(
           translate(lower(t),
             'àáâãäåāçèéêëēìíîïīñòóôõöøōùúûüūýÿœæß',
             'aaaaaaaceeeeeiiiiinoooooooouuuuuyyoas'),
           '[^a-z0-9]+', ' ', 'g')
$$;


-- "VII" → "7" so that "golf 7" / "clio 4" match roman-numbered generations
create or replace function public._gen_aliases(p_name text)
returns text language sql immutable strict parallel safe
as $$
  select case
    when upper(p_name) ~ '^[IVX]+$' then
      (select ' ' || n::text || ' mk' || n::text || ' gen' || n::text
         from (select array_position(array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'], upper(p_name))) as x(n)
        where n is not null)
    when p_name ~ '^(Mk|mk|MK)\s?(\d+)' then ' ' || regexp_replace(p_name, '^(Mk|mk|MK)\s?(\d+).*$', '\2')
    else '' end
$$;

alter table public.generations add column if not exists search_text text;

create or replace function public._generation_search_text(p_generation_id uuid)
returns text language sql stable
set search_path = public
as $$
  select public.norm_text(
           ma.name || ' ' || mo.name || ' ' || g.name || coalesce(public._gen_aliases(g.name), '') || ' ' ||
           coalesce(g.year_start::text, '') || ' ' || coalesce(g.year_end::text, '') ||
           ' ' || replace(mo.name, '-', '') || ' ' || replace(mo.name, ' ', '')
         )
    from public.generations g
    join public.models mo on mo.id = g.model_id
    join public.makes  ma on ma.id = mo.make_id
   where g.id = p_generation_id
$$;

create or replace function public.refresh_generation_search_text(p_model_id uuid default null, p_make_id uuid default null)
returns void language sql volatile
set search_path = public
as $$
  update public.generations g
     set search_text = public._generation_search_text(g.id)
    from public.models mo
   where mo.id = g.model_id
     and (p_model_id is null or mo.id = p_model_id)
     and (p_make_id  is null or mo.make_id = p_make_id);
$$;

create or replace function public._trg_generation_search_text()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.search_text := public.norm_text(
    (select ma.name || ' ' || mo.name from public.models mo join public.makes ma on ma.id = mo.make_id where mo.id = new.model_id)
    || ' ' || new.name || coalesce(public._gen_aliases(new.name), '') || ' ' || coalesce(new.year_start::text, '') || ' ' || coalesce(new.year_end::text, '')
    || ' ' || (select replace(mo.name, '-', '') || ' ' || replace(mo.name, ' ', '') from public.models mo where mo.id = new.model_id)
  );
  return new;
end;
$$;
drop trigger if exists generations_search_text on public.generations;
create trigger generations_search_text
  before insert or update of name, year_start, year_end, model_id on public.generations
  for each row execute function public._trg_generation_search_text();

create or replace function public._trg_model_rename_refresh()
returns trigger language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_generation_search_text(new.id, null);
  return new;
end;
$$;
drop trigger if exists models_rename_refresh on public.models;
create trigger models_rename_refresh
  after update of name, make_id on public.models
  for each row execute function public._trg_model_rename_refresh();

create or replace function public._trg_make_rename_refresh()
returns trigger language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_generation_search_text(null, new.id);
  return new;
end;
$$;
drop trigger if exists makes_rename_refresh on public.makes;
create trigger makes_rename_refresh
  after update of name on public.makes
  for each row execute function public._trg_make_rename_refresh();

select public.refresh_generation_search_text();

create index if not exists generations_search_trgm_idx on public.generations using gin (search_text gin_trgm_ops);
create index if not exists models_name_trgm_idx on public.models using gin (public.norm_text(name) gin_trgm_ops);
create index if not exists makes_name_trgm_idx  on public.makes  using gin (public.norm_text(name) gin_trgm_ops);

-- ============ search RPC ============
-- Returns generation-level hits with the variants already referenced for it.
-- Every query token must match (substring) OR the whole query must be trigram-similar.
create or replace function public.search_vehicles(p_q text, p_limit int default 24)
returns table (
  generation_id uuid, make_id uuid, make_name text, make_slug text, logo_url text,
  model_id uuid, model_name text, generation_name text, year_start int, year_end int,
  variants jsonb, score real
) language sql stable security definer
set search_path = public, extensions
as $$
  with q as (
    select public.norm_text(coalesce(p_q, '')) as qfull,
           array_remove(string_to_array(btrim(public.norm_text(coalesce(p_q, ''))), ' '), '') as toks
  ),
  hits as (
    select g.id as generation_id, ma.id as make_id, ma.name as make_name, ma.slug as make_slug, ma.logo_url,
           mo.id as model_id, mo.name as model_name, g.name as generation_name, g.year_start, g.year_end,
           (
             (case when g.search_text like (select btrim(qfull) from q) || '%' then 1.0 else 0 end)
             + (case when public.norm_text(mo.name) = (select btrim(qfull) from q) then 1.5 else 0 end)
             + (case when public.norm_text(ma.name || ' ' || mo.name) = (select btrim(qfull) from q) then 2.0 else 0 end)
             + similarity(g.search_text, (select qfull from q))
             + (case when g.year_end is null then 0.15 else 0 end)
           )::real as score
      from public.generations g
      join public.models mo on mo.id = g.model_id and mo.is_active
      join public.makes  ma on ma.id = mo.make_id and ma.is_active
     where g.is_active
       and cardinality((select toks from q)) > 0
       and (
         (select bool_and(g.search_text like '%' || t || '%' or (length(t) >= 4 and word_similarity(t, g.search_text) >= 0.5))
            from unnest((select toks from q)) as t)
         or g.search_text % (select qfull from q)
       )
  )
  select h.generation_id, h.make_id, h.make_name, h.make_slug, h.logo_url,
         h.model_id, h.model_name, h.generation_name, h.year_start, h.year_end,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', v.id, 'body_style', v.body_style_code, 'label_fr', bs.label_fr,
                    'base_labor_minutes', v.base_labor_minutes, 'notes', v.notes)
                  order by bs.display_order)
             from public.vehicle_variants v
             join public.body_styles bs on bs.code = v.body_style_code
            where v.generation_id = h.generation_id and v.is_active
         ), '[]'::jsonb) as variants,
         h.score
    from hits h
   order by h.score desc, h.year_start desc nulls last, h.make_name, h.model_name
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

-- ============ lazy variant resolution ============
-- Any generation can be booked with any body style: the row is created on demand with
-- the body style's default_labor_minutes (admin can then override it per variant).
create or replace function public.ensure_variant(p_generation_id uuid, p_body_style public.body_style_code)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v public.vehicle_variants%rowtype;
begin
  if not exists (select 1 from public.generations g join public.models mo on mo.id = g.model_id
                  where g.id = p_generation_id and g.is_active and mo.is_active) then
    raise exception 'NOT_FOUND';
  end if;
  insert into public.vehicle_variants (generation_id, body_style_code, base_labor_minutes)
  select p_generation_id, p_body_style, bs.default_labor_minutes
    from public.body_styles bs where bs.code = p_body_style
  on conflict (generation_id, body_style_code) do update set is_active = true
  returning * into v;
  return jsonb_build_object(
    'id', v.id, 'generation_id', v.generation_id, 'body_style', v.body_style_code,
    'base_labor_minutes', v.base_labor_minutes, 'notes', v.notes,
    'label_fr', (select label_fr from public.body_styles where code = v.body_style_code));
end;
$$;

-- ============ admin: labor-minute editors ============
create or replace function public.admin_save_labor_minutes(p_body_defaults jsonb default '[]'::jsonb, p_variants jsonb default '[]'::jsonb)
returns void language plpgsql volatile security definer
set search_path = public
as $$
declare r record;
begin
  perform public._require_admin();
  for r in select * from jsonb_to_recordset(coalesce(p_body_defaults, '[]'::jsonb)) as x(code text, minutes int) loop
    update public.body_styles set default_labor_minutes = greatest(0, least(480, r.minutes))
     where code = r.code::public.body_style_code;
  end loop;
  for r in select * from jsonb_to_recordset(coalesce(p_variants, '[]'::jsonb)) as x(id uuid, minutes int, notes text) loop
    update public.vehicle_variants
       set base_labor_minutes = greatest(0, least(480, r.minutes)),
           notes = nullif(btrim(coalesce(r.notes, notes)), '')
     where id = r.id;
  end loop;
end;
$$;

-- ============ vehicle requests: contact + sessionless submit ============
alter table public.vehicle_requests
  add column if not exists contact_phone text,
  add column if not exists contact_name  text;

create or replace function public.submit_vehicle_request(
  p_raw_text text, p_contact_name text default null, p_contact_email text default null, p_contact_phone text default null)
returns uuid language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9+]', '', 'g'), '');
  v_id    uuid;
begin
  if char_length(btrim(coalesce(p_raw_text, ''))) < 3 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_uid is not null then
    -- attach to the client; fill blanks from the profile
    select coalesce(v_name, p.full_name), coalesce(v_email, p.email), coalesce(v_phone, p.phone)
      into v_name, v_email, v_phone
      from public.profiles p where p.id = v_uid;
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if v_phone is null or char_length(v_phone) < 8 then
    raise exception 'PHONE_REQUIRED';
  end if;
  insert into public.vehicle_requests (user_id, raw_text, contact_email, contact_phone, contact_name)
  values (v_uid, btrim(p_raw_text), v_email, v_phone, v_name)
  returning id into v_id;
  -- keep the profile's contact fresh (same behaviour as create_booking)
  if v_uid is not null then
    update public.profiles
       set email = coalesce(email, v_email), phone = coalesce(phone, v_phone), full_name = coalesce(full_name, v_name)
     where id = v_uid;
  end if;
  return v_id;
end;
$$;

-- ============ grants ============
revoke all on function public.norm_text(text)                                   from public;
revoke all on function public._gen_aliases(text)                                from public;
revoke all on function public._generation_search_text(uuid)                     from public;
revoke all on function public.refresh_generation_search_text(uuid, uuid)        from public;
revoke all on function public.search_vehicles(text, int)                        from public;
revoke all on function public.ensure_variant(uuid, public.body_style_code)      from public;
revoke all on function public.admin_save_labor_minutes(jsonb, jsonb)            from public;
revoke all on function public.submit_vehicle_request(text, text, text, text)    from public;

grant execute on function public.norm_text(text)                                to anon, authenticated;
grant execute on function public.search_vehicles(text, int)                     to anon, authenticated;
grant execute on function public.ensure_variant(uuid, public.body_style_code)   to anon, authenticated;
grant execute on function public.admin_save_labor_minutes(jsonb, jsonb)         to authenticated;
grant execute on function public.refresh_generation_search_text(uuid, uuid)     to authenticated;
grant execute on function public.submit_vehicle_request(text, text, text, text) to anon, authenticated;
