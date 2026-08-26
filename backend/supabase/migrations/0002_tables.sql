-- 0002 — tables, constraints, indexes
-- See docs/02_DATABASE_SCHEMA.md

-- ============ identity ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null default 'client',
  full_name    text,
  email        text,
  phone        text,
  is_anonymous boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============ vehicle taxonomy (admin-managed) ============
create table public.makes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique,
  logo_url      text,
  display_order int  not null default 0,
  is_active     boolean not null default true
);

create table public.models (
  id        uuid primary key default gen_random_uuid(),
  make_id   uuid not null references public.makes(id) on delete cascade,
  name      text not null,
  slug      text not null,
  is_active boolean not null default true,
  unique (make_id, slug)
);

create table public.generations (
  id         uuid primary key default gen_random_uuid(),
  model_id   uuid not null references public.models(id) on delete cascade,
  name       text not null,
  year_start int  not null,
  year_end   int,
  is_active  boolean not null default true,
  check (year_end is null or year_end >= year_start)
);

create table public.body_styles (
  code                 public.body_style_code primary key,
  label_fr             text not null,
  door_count           int  not null,
  glass_surface_factor numeric(4,2) not null,
  size_class           text not null check (size_class in ('S','M','L','XL')),
  display_order        int  not null default 0
);

create table public.vehicle_variants (
  id                 uuid primary key default gen_random_uuid(),
  generation_id      uuid not null references public.generations(id) on delete cascade,
  body_style_code    public.body_style_code not null references public.body_styles(code),
  base_labor_minutes int  not null default 0 check (base_labor_minutes between 0 and 480),
  notes              text,
  is_active          boolean not null default true,
  unique (generation_id, body_style_code)
);

-- ============ client garage ============
create table public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.vehicle_variants(id),
  year       int check (year is null or year between 1950 and 2100),
  color      text,
  plate      text,
  nickname   text,
  created_at timestamptz not null default now()
);

-- ============ tint catalog ============
create table public.tint_zones (
  code               public.tint_zone_code primary key,
  label_fr           text not null,
  detail_fr          text,
  zone_group         public.zone_group not null,
  is_front           boolean not null,
  legally_restricted boolean not null,
  base_minutes       int  not null check (base_minutes between 1 and 240),
  display_order      int  not null default 0,
  is_active          boolean not null default true
);

create table public.vlt_levels (
  vlt_percent    int primary key check (vlt_percent between 1 and 100),
  label_fr       text not null,
  is_front_legal boolean generated always as (vlt_percent >= 70) stored,
  is_active      boolean not null default true
);

-- ============ versioned pricing ============
create table public.pricing_versions (
  id           uuid primary key default gen_random_uuid(),
  status       public.pricing_status not null default 'draft',
  label        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create unique index one_published_pricing on public.pricing_versions (status)
  where status = 'published';
create unique index one_draft_pricing on public.pricing_versions (status)
  where status = 'draft';

create table public.pricing_rules (
  id                 uuid primary key default gen_random_uuid(),
  version_id         uuid not null references public.pricing_versions(id) on delete cascade,
  body_style_code    public.body_style_code not null references public.body_styles(code),
  base_price         numeric(10,2) not null check (base_price >= 0),
  labor_rate_per_min numeric(6,2)  not null check (labor_rate_per_min >= 0),
  unique (version_id, body_style_code)
);

create table public.zone_pricing (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.pricing_versions(id) on delete cascade,
  zone_code   public.tint_zone_code not null references public.tint_zones(code),
  vlt_percent int not null references public.vlt_levels(vlt_percent),
  price_delta numeric(10,2) not null check (price_delta >= 0),
  unique (version_id, zone_code, vlt_percent)
);

-- ============ workshop configuration ============
create table public.workshop_hours (
  weekday    int primary key check (weekday between 1 and 7),  -- 1 = Monday (ISO)
  is_open    boolean not null default true,
  open_time  time,
  close_time time,
  check (not is_open or (open_time is not null and close_time is not null and close_time > open_time))
);

create table public.blackout_dates (
  id         uuid primary key default gen_random_uuid(),
  day        date not null unique,
  reason     text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ============ soft-locks (slot holds) ============
create table public.booking_holds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  bay_index  int  not null default 1 check (bay_index >= 1),
  slot_start timestamptz not null,
  slot_end   timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (slot_end > slot_start),
  unique (user_id),
  exclude using gist (bay_index with =, tstzrange(slot_start, slot_end) with &&)
);

-- ============ bookings ============
create sequence public.booking_ref_seq start 1000;

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  user_id             uuid references public.profiles(id) on delete set null,
  vehicle_id          uuid references public.vehicles(id) on delete set null,
  variant_id          uuid not null references public.vehicle_variants(id),
  service_type        public.service_type not null default 'tint',
  bay_index           int  not null default 1 check (bay_index >= 1),
  slot_start          timestamptz not null,
  slot_end            timestamptz not null,
  duration_min        int  not null check (duration_min > 0),
  status              public.booking_status not null default 'requested',
  legal_flag          public.legal_flag not null default 'compliant',
  price_total         numeric(10,2) not null check (price_total >= 0),
  price_breakdown     jsonb not null,
  currency            text not null default 'EUR',
  pricing_version_id  uuid not null references public.pricing_versions(id),
  contact_name        text not null check (char_length(contact_name) between 1 and 200),
  contact_phone       text not null check (char_length(contact_phone) between 5 and 40),
  contact_email       text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  client_notes        text check (client_notes is null or char_length(client_notes) <= 2000),
  cancellation_reason text,
  created_by_admin    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (slot_end > slot_start),
  constraint bookings_no_overlap exclude using gist (
    bay_index with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('requested','confirmed','in_progress'))
);

create table public.booking_tint_specs (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  zone_code   public.tint_zone_code not null references public.tint_zones(code),
  vlt_percent int not null references public.vlt_levels(vlt_percent),
  price_delta numeric(10,2) not null,
  minutes     int not null,
  is_legal    boolean not null,
  unique (booking_id, zone_code)
);

create table public.booking_admin_notes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  notes      text not null default '' check (char_length(notes) <= 5000),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status   public.booking_status not null,
  changed_by  uuid references public.profiles(id),
  note        text,
  changed_at  timestamptz not null default now()
);

create table public.booking_photos (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  kind         public.photo_kind not null,
  storage_path text not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table public.bookings_warranty (
  booking_id     uuid primary key references public.bookings(id) on delete cascade,
  warranty_years int not null check (warranty_years between 1 and 10),
  issued_by      uuid references public.profiles(id),
  issued_at      timestamptz not null default now()
);

-- ============ taxonomy gap leads ============
create table public.vehicle_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  raw_text            text not null check (char_length(raw_text) between 3 and 500),
  contact_email       text,
  status              public.request_status not null default 'new',
  resolved_variant_id uuid references public.vehicle_variants(id),
  resolved_by         uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- ============ indexes ============
create index models_make_idx        on public.models (make_id) where is_active;
create index generations_model_idx  on public.generations (model_id) where is_active;
create index variants_gen_idx       on public.vehicle_variants (generation_id) where is_active;
create index vehicles_user_idx      on public.vehicles (user_id);
create index bookings_user_idx      on public.bookings (user_id, slot_start desc);
create index bookings_active_slot_idx on public.bookings (slot_start)
  where status in ('requested','confirmed','in_progress');
create index specs_booking_idx      on public.booking_tint_specs (booking_id);
create index history_booking_idx    on public.booking_status_history (booking_id, changed_at);
create index photos_booking_idx     on public.booking_photos (booking_id);
create index zone_pricing_ver_idx   on public.zone_pricing (version_id);
create index pricing_rules_ver_idx  on public.pricing_rules (version_id);
create index profiles_name_trgm     on public.profiles using gin (full_name gin_trgm_ops);
create index vehicles_plate_trgm    on public.vehicles using gin (plate gin_trgm_ops);
