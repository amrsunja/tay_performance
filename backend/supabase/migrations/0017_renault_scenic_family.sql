-- 0017 — Renault Scénic family
-- Source: https://en.wikipedia.org/wiki/Renault_Scénic (2026-09-25)
--
--   Gen I    Mégane Scénic 1996–1999 → Scénic 1999–2003 · RX4 (4x4) 2000–2003       · compact MPV
--   Gen II   Scénic 06/2003–2009 · Grand Scénic (7 pl.) 04/2004–2009 · Conquest 2007–2009
--   Gen III  Scénic 07/2009–2016 · Grand Scénic 05/2009–2016 · XMOD 03/2013–2016
--   Gen IV   Scénic 2016–07/2022 · Grand Scénic 2016–2022 (MPV with crossover styling)
--   Gen V    Scénic E-Tech electric 2024– (BEV crossover → suv_5p)
--
-- Scénic + Grand Scénic already came with 0011; this migration re-asserts them (years,
-- is_active) and adds the derivatives the catalog was missing: Scénic RX4 / Conquest / XMOD.
-- Derivatives are separate models (not generations) so "scenic xmod" / "rx4" hit directly in
-- search_vehicles and each can carry its own price override later.
--
-- Idempotent. Never overwrites admin-edited base_labor_minutes or existing variant notes.

create temp table _scenic_import (
  model_name text, model_slug text, gen_name text,
  year_start int, year_end int, body text, notes text
);

insert into _scenic_import values
  ('Scénic',          'scenic',          'I',               1996, 2003, 'monospace', 'Mégane Scénic jusqu''en 1999'),
  ('Scénic',          'scenic',          'II',              2003, 2009, 'monospace', null),
  ('Scénic',          'scenic',          'III',             2009, 2016, 'monospace', null),
  ('Scénic',          'scenic',          'IV',              2016, 2022, 'monospace', null),
  ('Scénic',          'scenic',          'E-Tech Electric', 2024, null, 'suv_5p',    'toit panoramique Solarbay (verre opacifiant) en option'),
  ('Grand Scénic',    'grand-scenic',    'II',              2004, 2009, 'monospace', '7 places — vitrage long'),
  ('Grand Scénic',    'grand-scenic',    'III',             2009, 2016, 'monospace', '7 places — vitrage long'),
  ('Grand Scénic',    'grand-scenic',    'IV',              2016, 2022, 'monospace', '7 places — vitrage long'),
  ('Scénic RX4',      'scenic-rx4',      'I',               2000, 2003, 'monospace', '4x4 · hayon à ouverture latérale, roue de secours sur le hayon'),
  ('Scénic Conquest', 'scenic-conquest', 'II',              2007, 2009, 'monospace', 'crossover · base Scénic II'),
  ('Scénic XMOD',     'scenic-xmod',     'III',             2013, 2016, 'monospace', 'crossover · base Scénic III');

-- make
insert into public.makes (name, slug, display_order)
values ('Renault', 'renault', 1)
on conflict (slug) do nothing;

-- models
insert into public.models (make_id, name, slug)
select distinct on (si.model_slug) ma.id, si.model_name, si.model_slug
  from _scenic_import si
  join public.makes ma on ma.slug = 'renault'
on conflict (make_id, slug) do update
  set is_active = true;

-- generations (years re-asserted from the source)
insert into public.generations (model_id, name, year_start, year_end)
select mo.id, si.gen_name, si.year_start, si.year_end
  from _scenic_import si
  join public.makes  ma on ma.slug = 'renault'
  join public.models mo on mo.make_id = ma.id and mo.slug = si.model_slug
on conflict (model_id, name) do update
  set year_start = excluded.year_start,
      year_end   = excluded.year_end,
      is_active  = true;

-- variants (pose time = body style default, cf. 0016)
insert into public.vehicle_variants (generation_id, body_style_code, base_labor_minutes, notes)
select g.id, bs.code, bs.default_labor_minutes, si.notes
  from _scenic_import si
  join public.makes       ma on ma.slug = 'renault'
  join public.models      mo on mo.make_id = ma.id and mo.slug = si.model_slug
  join public.generations g  on g.model_id = mo.id and g.name = si.gen_name
  join public.body_styles bs on bs.code = si.body::public.body_style_code
on conflict (generation_id, body_style_code) do update
  set is_active = true,
      notes     = coalesce(public.vehicle_variants.notes, excluded.notes);

select public.refresh_generation_search_text(null, (select id from public.makes where slug = 'renault'));

drop table _scenic_import;
