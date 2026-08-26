/* ============================================================
   API-facing types — the frontend view of the Supabase schema.
   Deliberately hand-written (regenerate database.types.ts with
   `supabase gen types typescript` to tighten further).
   ============================================================ */
import type {
  BodyStyleCode,
  BookingStatus,
  LegalFlag,
  TintZoneCode,
  ZoneGroup,
} from './domain'

/* ---------- catalog ---------- */

export interface CatalogZone {
  code: TintZoneCode
  labelFr: string
  detailFr?: string
  group: ZoneGroup
  isFront: boolean
  legallyRestricted: boolean
  minutes: number
  displayOrder: number
  /** price delta per VLT stop (published grid) */
  deltas: Record<number, number>
  /** representative price shown in the zone row (delta at the lowest VLT ≥ 35, fallback any) */
  price: number
}

export interface PricingRuleInfo {
  bodyStyle: BodyStyleCode
  labelFr: string
  sizeClass: 'S' | 'M' | 'L' | 'XL'
  glassFactor: number
  basePrice: number
  laborRatePerMin: number
}

export interface AppSettings {
  timezone: string
  slotGranularityMin: number
  bayCount: number
  cancellationCutoffHours: number
  holdTtlMinutes: number
  limoVltThreshold: number
  limoSupplement: number
  minLeadTimeHours: number
  bookingHorizonDays: number
  contactPhone: string
  workshopAddress: string
}

export interface Catalog {
  zones: CatalogZone[]
  vltStops: number[]
  rules: Partial<Record<BodyStyleCode, PricingRuleInfo>>
  settings: AppSettings
}

/* ---------- taxonomy ---------- */

export interface MakeRow {
  id: string
  name: string
  slug: string
  isActive: boolean
  modelCount?: number
}
export interface ModelRow {
  id: string
  makeId: string
  name: string
  slug: string
  isActive: boolean
}
export interface GenerationRow {
  id: string
  modelId: string
  name: string
  yearStart: number
  yearEnd: number | null
  isActive: boolean
}
export interface VariantRow {
  id: string
  generationId: string
  bodyStyle: BodyStyleCode
  bodyLabelFr: string
  baseLaborMinutes: number
  notes: string | null
  isActive: boolean
  /** denormalized chain label for admin lists */
  chainLabel?: string
}

/** Result of the vehicle funnel — everything the draft needs. */
export interface ResolvedVehicle {
  variantId: string
  vehicleId?: string
  /** variant overhead minutes — lets the local quote match the server exactly */
  baseLaborMinutes: number
  make: string
  model: string
  generation: string
  bodyStyle: BodyStyleCode
  bodyLabel: string
  years: string
  badge: string
  year?: number
  nickname?: string
  plate?: string
  color?: string
}

/* ---------- availability & holds ---------- */

export type SlotState = 'available' | 'taken' | 'held_by_me'

export interface SlotInfo {
  slotStart: string // ISO
  slotEnd: string
  bay: number
  state: SlotState
}

export type DayState = 'past' | 'closed' | 'full' | 'available'

export interface DayAvailability {
  day: string // yyyy-mm-dd
  state: DayState
  freeCount: number
}

export interface SlotHold {
  holdId: string
  bay: number
  slotStart: string
  slotEnd: string
  expiresAt: string
}

/* ---------- quotes & bookings ---------- */

export interface QuoteSpec {
  zone_code: TintZoneCode
  vlt_percent: number
}

export interface ServerQuoteLine {
  zone_code: TintZoneCode
  vlt_percent: number
  delta: number
  minutes: number
  is_legal: boolean
  label_fr: string
}

export interface ServerQuote {
  variant_id: string
  duration_min: number
  compliant: boolean
  specs: ServerQuoteLine[]
  breakdown: {
    base: number
    zones: number
    labor: { minutes: number; rate: number; amount: number }
    limo_supplement: number
    total: number
    pricing_version_id: string
  }
}

export interface CreatedBooking {
  id: string
  reference: string
  slot_start: string
  slot_end: string
  duration_min: number
  status: BookingStatus
  legal_flag: LegalFlag
  price_total: number
  price_breakdown: ServerQuote['breakdown']
  specs: ServerQuoteLine[]
  old_reference?: string
}

export interface MyBookingRow {
  id: string
  reference: string
  slotStart: string
  slotEnd: string
  durationMin: number
  status: BookingStatus
  legalFlag: LegalFlag
  priceTotal: number
  clientNotes: string | null
  variantId: string
  vehicleLabel: string
  bodyLabel: string
  badge: string
  specs: { zone: TintZoneCode; vltPercent: number; priceDelta: number; isLegal: boolean }[]
  warrantyYears: number | null
  photos: { kind: 'before' | 'after'; path: string; url?: string }[]
}

/* ---------- garage ---------- */

export interface GarageVehicle extends ResolvedVehicle {
  vehicleId: string
}

/* ---------- admin ---------- */

export interface AdminBookingRow {
  id: string
  reference: string
  slotStart: string
  slotEnd: string
  durationMin: number
  status: BookingStatus
  legalFlag: LegalFlag
  priceTotal: number
  contactName: string
  contactPhone: string
  contactEmail: string | null
  clientNotes: string | null
  userId: string | null
  vehicleLabel: string
  bodyLabel: string
  badge: string
  createdByAdmin: boolean
  specs: { zone: TintZoneCode; vltPercent: number; isLegal: boolean }[]
}

export interface AdminClientRow {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  isAnonymous: boolean
  vehiclesCount: number
  bookingsCount: number
  lastVisit: string | null
  createdAt: string
}

export interface StatusHistoryRow {
  fromStatus: BookingStatus | null
  toStatus: BookingStatus
  changedAt: string
  note: string | null
}

export interface VehicleRequestRow {
  id: string
  rawText: string
  contactEmail: string | null
  status: 'new' | 'resolved' | 'rejected'
  createdAt: string
}

export interface BlackoutRow {
  id: string
  day: string
  reason: string
}

export interface WorkshopHoursRow {
  weekday: number
  isOpen: boolean
  openTime: string | null
  closeTime: string | null
}

export interface DraftPricing {
  versionId: string
  rules: PricingRuleInfo[]
  /** zone → vlt → delta */
  grid: Record<string, Record<number, number>>
}
