-- 0007 — seed data. Reproduces the shipped UI's catalog exactly (docs/02 §8)
-- plus a starter vehicle taxonomy. Idempotent-ish (fresh database expected).

-- ============ body styles ============
insert into public.body_styles (code, label_fr, door_count, glass_surface_factor, size_class, display_order) values
  ('citadine_3p','Citadine 3 portes',3,0.70,'S',1),
  ('citadine_5p','Citadine 5 portes',5,0.80,'S',2),
  ('coupe_2p','Coupé 2 portes',2,0.85,'M',3),
  ('berline_4p','Berline 4 portes',4,1.00,'M',4),
  ('break_5p','Break 5 portes',5,1.15,'L',5),
  ('monospace','Monospace',5,1.25,'L',6),
  ('suv_5p','SUV 5 portes',5,1.40,'XL',7),
  ('utilitaire','Utilitaire',4,1.30,'XL',8),
  ('pickup','Pick-up',4,1.35,'XL',9);

-- ============ tint zones (codes, labels, minutes = TINT_ZONES mock) ============
insert into public.tint_zones (code, label_fr, detail_fr, zone_group, is_front, legally_restricted, base_minutes, display_order) values
  ('pare_brise','Pare-brise',null,'avant',true,true,40,1),
  ('front_sides','Vitres avant latérales','(paire)','avant',true,true,30,2),
  ('rear_sides','Vitres arrière latérales','(paire)','arriere',false,false,35,3),
  ('rear_window','Lunette arrière',null,'arriere',false,false,30,4),
  ('panoramic_roof','Toit panoramique',null,'option',false,false,25,5);

-- ============ VLT levels ============
insert into public.vlt_levels (vlt_percent, label_fr) values
  (5,'5% — Limo'),(20,'20% — Privacy'),(35,'35% — Confort'),
  (50,'50% — Subtil'),(70,'70% — Légal avant'),(85,'85% — Quasi clair');

-- ============ workshop hours (WORKSHOP_WEEK mock) ============
insert into public.workshop_hours (weekday, is_open, open_time, close_time) values
  (1,true,'09:00','18:00'),(2,true,'09:00','18:00'),(3,true,'09:00','18:00'),
  (4,true,'09:00','18:00'),(5,true,'09:00','19:00'),(6,true,'09:00','16:00'),
  (7,false,null,null);

-- ============ app settings ============
insert into public.app_settings (key, value) values
  ('timezone','"Europe/Paris"'),
  ('slot_granularity_min','30'),
  ('bay_count','1'),
  ('cancellation_cutoff_hours','24'),
  ('hold_ttl_minutes','10'),
  ('limo_vlt_threshold','20'),
  ('limo_supplement','30.00'),
  ('min_lead_time_hours','2'),
  ('booking_horizon_days','90'),
  ('contact_phone','"06 05 50 50 28"'),
  ('workshop_address','"19 Rue de l''industrie, 67400 Illkirch-Graffenstaden"');

-- ============ pricing v1 (published) ============
insert into public.pricing_versions (status, label, published_at)
values ('published', 'Grille initiale', now());

insert into public.pricing_rules (version_id, body_style_code, base_price, labor_rate_per_min)
select public.current_pricing_version_id(), x.code, x.base, 0.40
from (values
  ('citadine_3p'::public.body_style_code,180.00),
  ('citadine_5p',200.00),('coupe_2p',220.00),('berline_4p',240.00),
  ('break_5p',280.00),('monospace',300.00),('suv_5p',340.00),
  ('utilitaire',320.00),('pickup',330.00)
) as x(code, base);

-- flat per-zone grid (docs/02 §8: the "limousine" premium is the booking-level supplement)
insert into public.zone_pricing (version_id, zone_code, vlt_percent, price_delta)
select public.current_pricing_version_id(), z.code, v.vlt_percent,
       case z.code
         when 'pare_brise'     then 90.00
         when 'front_sides'    then 60.00
         when 'rear_sides'     then 70.00
         when 'rear_window'    then 50.00
         when 'panoramic_roof' then 40.00
       end
from public.tint_zones z cross join public.vlt_levels v;

-- ============ starter taxonomy ============
insert into public.makes (name, slug, display_order) values
  ('Audi','audi',1),('BMW','bmw',2),('Mercedes','mercedes',3),('Mini','mini',4),
  ('Peugeot','peugeot',5),('Renault','renault',6),('Tesla','tesla',7),('Volkswagen','volkswagen',8);

insert into public.models (make_id, name, slug)
select m.id, x.name, x.slug
from (values
  ('bmw','Série 3','serie-3'),('bmw','M3','m3'),('bmw','X5','x5'),
  ('tesla','Model Y','model-y'),('tesla','Model 3','model-3'),
  ('mini','Cooper S','cooper-s'),
  ('audi','RS3','rs3'),('audi','Q5','q5'),
  ('volkswagen','Golf','golf'),
  ('peugeot','208','208'),('peugeot','5008','5008'),
  ('renault','Clio','clio'),
  ('mercedes','GLC','glc')
) as x(make_slug, name, slug)
join public.makes m on m.slug = x.make_slug;

insert into public.generations (model_id, name, year_start, year_end)
select mo.id, x.gen, x.ys, x.ye
from (values
  ('bmw','serie-3','G20',2019,null::int),
  ('bmw','m3','F30',2014,2018),
  ('bmw','x5','G05',2018,null),
  ('tesla','model-y','Juniper',2025,null),
  ('tesla','model-3','Highland',2023,null),
  ('mini','cooper-s','F56',2014,2024),
  ('audi','rs3','8Y',2021,null),
  ('audi','q5','FY',2017,2024),
  ('volkswagen','golf','8',2019,null),
  ('peugeot','208','II',2019,null),
  ('peugeot','5008','II',2017,2024),
  ('renault','clio','V',2019,null),
  ('mercedes','glc','X254',2022,null)
) as x(make_slug, model_slug, gen, ys, ye)
join public.makes ma on ma.slug = x.make_slug
join public.models mo on mo.make_id = ma.id and mo.slug = x.model_slug;

-- variants: base_labor_minutes = vehicle-specific OVERHEAD (zone minutes charged separately)
insert into public.vehicle_variants (generation_id, body_style_code, base_labor_minutes, notes)
select g.id, x.body::public.body_style_code, x.overhead, x.notes
from (values
  ('serie-3','G20','berline_4p',15,null),
  ('m3','F30','berline_4p',15,'vitres sans cadre +10min'),
  ('x5','G05','suv_5p',25,null),
  ('model-y','Juniper','suv_5p',25,'lunette très inclinée'),
  ('model-3','Highland','berline_4p',20,'lunette très inclinée'),
  ('cooper-s','F56','citadine_3p',10,null),
  ('rs3','8Y','berline_4p',15,null),
  ('q5','FY','suv_5p',25,null),
  ('golf','8','citadine_5p',10,null),
  ('208','II','citadine_5p',10,null),
  ('5008','II','suv_5p',25,'7 places — vitrage long'),
  ('clio','V','citadine_5p',10,null),
  ('glc','X254','suv_5p',25,null)
) as x(model_slug, gen, body, overhead, notes)
join public.models mo on mo.slug = x.model_slug
join public.generations g on g.model_id = mo.id and g.name = x.gen;
