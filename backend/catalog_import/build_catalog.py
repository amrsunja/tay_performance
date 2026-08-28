#!/usr/bin/env python3
"""Merge Wikipedia lists + US model-year data + curated generations → 0011_world_catalog.sql"""
import csv, glob, json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curated_generations import CURATED

HERE = os.path.dirname(os.path.abspath(__file__))
WIKI = os.path.join(HERE, 'sources', 'wiki')
US = os.path.join(HERE, 'sources', 'us')
OUT = os.path.join(HERE, '..', 'supabase', 'migrations', '0011_world_catalog.sql')
CURRENT_YEAR = 2026

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or 'x'

# ---------- makes ----------
MAKE_NAME = {  # slug -> display name
    'mercedes-benz': 'Mercedes', 'mercedes': 'Mercedes', 'ds': 'DS', 'mg': 'MG', 'byd': 'BYD', 'nio': 'NIO',
    'gwm': 'GWM', 'jac': 'JAC', 'dfsk': 'DFSK', 'gmc': 'GMC', 'kgm': 'KGM', 'ssangyong': 'SsangYong',
    'lynk-co': 'Lynk & Co', 'alfa-romeo': 'Alfa Romeo', 'aston-martin': 'Aston Martin', 'land-rover': 'Land Rover',
    'rolls-royce': 'Rolls-Royce', 'citroen': 'Citroën', 'skoda': 'Škoda', 'seat': 'SEAT', 'bmw': 'BMW',
    'vinfast': 'VinFast', 'mclaren': 'McLaren', 'xpeng': 'XPeng', 'smart': 'Smart', 'fiat': 'Fiat', 'mazda': 'Mazda',
    'mini': 'Mini', 'infiniti': 'Infiniti', 'hummer': 'Hummer', 'ram': 'RAM', 'srt': 'SRT', 'ora': 'ORA',
}
MAKE_SLUG_ALIAS = {'mercedes-benz': 'mercedes', 'maybach': 'maybach'}
def make_slug_of(name_or_slug):
    s = slugify(name_or_slug)
    return MAKE_SLUG_ALIAS.get(s, s)
def make_name_of(slug, raw):
    if slug in MAKE_NAME: return MAKE_NAME[slug]
    if raw.isupper() or raw.islower(): return raw.title()
    return raw

# ---------- model name normalisation ----------
def norm_model(make_slug, name):
    n = name.strip()
    n = re.sub(r'\s+', ' ', n)
    # strip make prefix
    for pref in (make_name_of(make_slug, make_slug), make_slug.replace('-', ' '), 'Mercedes-Benz', 'Mercedes', 'Citroën', 'Škoda'):
        if pref and n.lower().startswith(pref.lower() + ' ') and len(n) > len(pref) + 1:
            n = n[len(pref) + 1:]
    if make_slug == 'bmw':
        n = re.sub(r'^(\d) Series$', r'Série \1', n)
        n = re.sub(r'^(\d)[- ]Series (.+)$', r'Série \1 \2', n)
    if make_slug == 'mercedes':
        n = re.sub(r'^([A-Z]{1,3})-Class$', r'Classe \1', n)
        n = re.sub(r'^([A-Z]{1,3})-Class (.+)$', r'Classe \1 \2', n)
        n = n.replace('Mercedes-AMG ', 'AMG ')
    n = re.sub(r'\s*\(.*?\)\s*$', '', n).strip()  # trailing parenthetical
    return n

BODY_MAP = {
    'hatchback': 'citadine_5p', 'sedan': 'berline_4p', 'coupe': 'coupe_2p', 'convertible': 'coupe_2p',
    'roadster': 'coupe_2p', 'wagon': 'break_5p', 'suv': 'suv_5p', 'mpv': 'monospace', 'van': 'utilitaire',
    'pickup': 'pickup', 'microcar': 'citadine_3p', 'minivan': 'monospace', 'van/minivan': 'monospace',
    'crossover': 'suv_5p', 'estate': 'break_5p', 'saloon': 'berline_4p', 'liftback': 'citadine_5p',
}
def body_code(b):
    if not b: return None
    return BODY_MAP.get(str(b).strip().lower())

# models[(make_slug, model_slug)] = {name, years:set(), bodies:set(), start, end, current}
models = {}
makes = {}
def touch_make(slug, raw):
    if slug not in makes: makes[slug] = make_name_of(slug, raw)
def touch_model(make_slug, name):
    name = norm_model(make_slug, name)
    if not name or len(name) > 60: return None
    key = (make_slug, slugify(name))
    if key not in models:
        models[key] = {'name': name, 'years': set(), 'bodies': set(), 'start': None, 'end': None, 'current': False}
    return models[key]

# ---------- Wikipedia ----------
for f in sorted(glob.glob(f'{WIKI}/*.json')):
    slug = make_slug_of(f.rsplit('/', 1)[1][:-5])
    raw = slug.replace('-', ' ').title()
    touch_make(slug, raw)
    for m in json.load(open(f)):
        name = (m.get('model') or '').strip()
        if not name or re.search(r'concept|prototype|racing|race car|formula', name, re.I): continue
        mm = touch_model(slug, name)
        if mm is None: continue
        s, e = m.get('start'), m.get('end')
        s = int(s) if isinstance(s, (int, float)) and 1885 <= s <= 2027 else None
        e = int(e) if isinstance(e, (int, float)) and 1885 <= e <= 2027 else None
        if s and (mm['start'] is None or s < mm['start']): mm['start'] = s
        if e and (mm['end'] is None or e > mm['end']): mm['end'] = e
        if s and e is None: mm['current'] = True
        bc = body_code(m.get('body'))
        if bc: mm['bodies'].add(bc)

# ---------- US model-year data ----------
for f in sorted(glob.glob(f'{US}/*.csv')):
    for r in csv.DictReader(open(f)):
        raw = r['make'].strip()
        slug = make_slug_of(raw)
        touch_make(slug, raw)
        mm = touch_model(slug, r['model'])
        if mm is None: continue
        y = int(r['year'])
        mm['years'].add(y)
        for b in json.loads(r['body_styles'] or '[]'):
            bc = body_code(b)
            if bc: mm['bodies'].add(bc)

# ---------- generations ----------
SEED_GENS = {  # already inserted by 0007 — (make, model_slug) -> [(name, ys)]
    ('bmw', 'serie-3'): [('G20', 2019)], ('bmw', 'm3'): [('F30', 2014)], ('bmw', 'x5'): [('G05', 2018)],
    ('tesla', 'model-y'): [('Juniper', 2025)], ('tesla', 'model-3'): [('Highland', 2023)],
    ('mini', 'cooper-s'): [('F56', 2014)], ('audi', 'rs3'): [('8Y', 2021)], ('audi', 'q5'): [('FY', 2017)],
    ('volkswagen', 'golf'): [('8', 2019)], ('peugeot', '208'): [('II', 2019)], ('peugeot', '5008'): [('II', 2017)],
    ('renault', 'clio'): [('V', 2019)], ('mercedes', 'glc'): [('X254', 2022)],
}
for (mk, mname) in CURATED:
    touch_make(mk, mk.replace('-', ' ').title())
    touch_model(mk, mname)

def year_label(s, e):
    if s and e: return f'{s}–{e}'
    if s: return f'{s}–présent'
    if e: return f'…–{e}'
    return 'Toutes années'

rows = []  # (make_name, make_slug, model_name, model_slug, gen_name, ys, ye, bodies[])
for (mk, mslug), mm in sorted(models.items()):
    gens = []
    cur = CURATED.get((mk, mm['name']))
    if cur:
        seeded = {ys for _, ys in SEED_GENS.get((mk, mslug), [])}
        for gname, ys, ye, bodies in cur:
            if ys in seeded: continue
            gens.append((gname, ys, ye, list(dict.fromkeys(bodies))))
    else:
        ys_set = sorted(mm['years'])
        ranges = []
        if ys_set:
            start = prev = ys_set[0]
            for y in ys_set[1:]:
                if y - prev > 2:
                    ranges.append((start, prev)); start = y
                prev = y
            ranges.append((start, prev))
            # widen with wiki dates if they extend the first/last range
            if mm['start'] and mm['start'] < ranges[0][0]: ranges[0] = (mm['start'], ranges[0][1])
            ranges = [(s, None if (e >= CURRENT_YEAR - 1 or (i == len(ranges) - 1 and mm['current'] and e >= CURRENT_YEAR - 3)) else e)
                      for i, (s, e) in enumerate(ranges)]
        else:
            s, e = mm['start'], mm['end']
            if s is None and e is None:
                ranges = [(None, None)]
            else:
                ranges = [(s, None if (mm['current'] and e is None) else e)]
        if (mk, mslug) in SEED_GENS:
            continue  # seed already covers this model's current generation; keep its rows only
        bodies = sorted(mm['bodies'])
        for s, e in ranges:
            gens.append((year_label(s, e), s, e, bodies))
    for gname, ys, ye, bodies in gens:
        rows.append((makes[mk], mk, mm['name'], mslug, gname, ys, ye, bodies))

# de-dup generation names within a model
seen = set(); final = []
for r in rows:
    k = (r[1], r[3], r[4])
    if k in seen: continue
    seen.add(k); final.append(r)
rows = final

def q(s):
    return "'" + s.replace("'", "''") + "'"
def nn(v):
    return 'null' if v is None else str(v)

lines = []
lines.append('-- 0011 — worldwide vehicle catalog (generated by data/build_catalog.py)')
lines.append('-- Sources: Wikipedia make/model lists (110 makes), US model-year dataset 1992–2026 (body styles),')
lines.append('-- curated generations for the models most common on the French market.')
lines.append(f'-- {len(makes)} makes · {len(models)} models · {len(rows)} generations. Idempotent: re-running adds nothing.')
lines.append('create temp table catalog_import (')
lines.append('  make_name text, make_slug text, model_name text, model_slug text,')
lines.append('  gen_name text, year_start int, year_end int, bodies text[]')
lines.append(');')
lines.append('insert into catalog_import values')
vals = []
for (mkn, mk, mn, ms, gn, ys, ye, bodies) in rows:
    arr = 'array[' + ','.join(q(b) for b in bodies) + ']::text[]' if bodies else "'{}'::text[]"
    vals.append(f'({q(mkn)},{q(mk)},{q(mn)},{q(ms)},{q(gn)},{nn(ys)},{nn(ye)},{arr})')
lines.append(',\n'.join(vals) + ';')
lines.append('''
-- makes (keep existing rows; only fill missing ones)
insert into public.makes (name, slug, display_order)
select distinct on (make_slug) make_name, make_slug, 100
  from catalog_import
on conflict (slug) do nothing;

-- models
insert into public.models (make_id, name, slug)
select distinct on (ma.id, ci.model_slug) ma.id, ci.model_name, ci.model_slug
  from catalog_import ci
  join public.makes ma on ma.slug = ci.make_slug
on conflict (make_id, slug) do nothing;

-- generations
insert into public.generations (model_id, name, year_start, year_end)
select mo.id, ci.gen_name, ci.year_start, ci.year_end
  from catalog_import ci
  join public.makes  ma on ma.slug = ci.make_slug
  join public.models mo on mo.make_id = ma.id and mo.slug = ci.model_slug
on conflict (model_id, name) do nothing;

-- variants for the referenced body styles (default surcoût from body_styles)
insert into public.vehicle_variants (generation_id, body_style_code, base_labor_minutes)
select g.id, b::public.body_style_code, bs.default_labor_minutes
  from catalog_import ci
  join public.makes  ma on ma.slug = ci.make_slug
  join public.models mo on mo.make_id = ma.id and mo.slug = ci.model_slug
  join public.generations g on g.model_id = mo.id and g.name = ci.gen_name
  cross join lateral unnest(ci.bodies) as b
  join public.body_styles bs on bs.code = b::public.body_style_code
on conflict (generation_id, body_style_code) do nothing;

-- display order: French-market majors first, then alphabetical
update public.makes set display_order = x.o from (values
  ('renault',1),('peugeot',2),('citroen',3),('dacia',4),('volkswagen',5),('toyota',6),('bmw',7),('mercedes',8),
  ('audi',9),('ford',10),('opel',11),('skoda',12),('seat',13),('cupra',14),('fiat',15),('hyundai',16),('kia',17),
  ('nissan',18),('tesla',19),('mini',20),('ds',21),('mg',22),('volvo',23),('mazda',24),('honda',25),('suzuki',26),
  ('jeep',27),('alfa-romeo',28),('porsche',29),('land-rover',30),('byd',31),('lexus',32),('smart',33),('mitsubishi',34)
) as x(slug, o) where makes.slug = x.slug;

select public.refresh_generation_search_text();
drop table catalog_import;
''')
open(OUT, 'w').write('\n'.join(lines))
print('makes', len(makes), 'models', len(models), 'generations', len(rows),
      'variants', sum(len(r[7]) for r in rows), 'bytes', len('\n'.join(lines)))
