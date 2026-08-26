-- 0001 — extensions & enums
-- Tay Performance · Phase 2 backend
-- See docs/02_DATABASE_SCHEMA.md

create extension if not exists btree_gist;   -- exclusion constraints on (int, tstzrange)
create extension if not exists pg_trgm;      -- fuzzy admin search (clients, plates)

create type public.user_role       as enum ('client', 'staff', 'admin');
create type public.service_type    as enum ('tint', 'detailing', 'wrapping', 'mechanical');
create type public.body_style_code as enum ('citadine_3p','citadine_5p','berline_4p','coupe_2p',
                                            'break_5p','suv_5p','monospace','utilitaire','pickup');
create type public.tint_zone_code  as enum ('pare_brise','front_sides','rear_sides',
                                            'rear_window','panoramic_roof');
create type public.zone_group      as enum ('avant','arriere','option');
create type public.booking_status  as enum ('requested','confirmed','in_progress','completed',
                                            'cancelled','no_show');
create type public.legal_flag      as enum ('compliant','non_compliant_ack');
create type public.photo_kind      as enum ('before','after');
create type public.request_status  as enum ('new','resolved','rejected');
create type public.pricing_status  as enum ('draft','published','archived');
