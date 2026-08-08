/* ============================================================
   Domain model — mirrors business_requirements.md §3
   (UI phase: consumed by the mock data layer; the same shapes
   will map onto Supabase rows when the BL is connected.)
   ============================================================ */

export type UserRole = 'admin' | 'staff' | 'client'

export type ServiceType = 'tint' | 'detailing' | 'wrapping' | 'mechanical'

export type BodyStyleCode =
  | 'citadine_3p'
  | 'citadine_5p'
  | 'berline_4p'
  | 'coupe_2p'
  | 'break_5p'
  | 'suv_5p'
  | 'monospace'
  | 'utilitaire'
  | 'pickup'

export type TintZoneCode =
  | 'pare_brise'
  | 'front_sides'
  | 'rear_sides'
  | 'rear_window'
  | 'panoramic_roof'

export type ZoneGroup = 'avant' | 'arriere' | 'option'

export type BookingStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type SlotStatus = 'open' | 'held' | 'booked' | 'blocked'

export type LegalFlag = 'compliant' | 'non_compliant_ack'

/** France 2026 — minimum VLT allowed on front glazing. */
export const FRONT_LEGAL_MIN_VLT = 70

export interface TintZone {
  code: TintZoneCode
  labelFr: string
  detailFr?: string
  group: ZoneGroup
  isFront: boolean
  legallyRestricted: boolean
  /** UI phase pricing snapshot (admin-editable later). */
  price: number
  /** Film labor minutes for this zone. */
  minutes: number
  /** Layered preview asset painted over the base vehicle photo. */
  layerSrc?: string
}

export interface VehicleSummary {
  id: string
  make: string
  model: string
  generation: string
  bodyLabel: string
  bodyStyle: BodyStyleCode
  years: string
  year?: number
  nickname?: string
  plate?: string
  color?: string
  badge: string
}

export interface BookingTintSpec {
  zone: TintZoneCode
  vltPercent: number
  priceDelta: number
  isLegal: boolean
}

export interface Booking {
  id: string
  reference: string
  vehicle: VehicleSummary
  serviceType: ServiceType
  dateLabel: string
  timeLabel: string
  durationMin: number
  status: BookingStatus
  legalFlag: LegalFlag
  priceTotal: number
  specs: BookingTintSpec[]
  clientNotes?: string
  warrantyYears?: number
  photos?: { kind: 'before' | 'after'; src: string }[]
}

export interface QueueEntry {
  id: string
  time: string
  endTime: string
  owner: string
  phone: string
  vehicle: VehicleSummary
  specs: BookingTintSpec[]
  durationMin: number
  status: BookingStatus
}

export interface ClientRow {
  id: string
  fullName: string
  email: string
  phone: string
  vehicles: number
  bookings: number
  lastVisit: string
}

export interface PricingRuleRow {
  bodyStyle: BodyStyleCode
  labelFr: string
  sizeClass: 'S' | 'M' | 'L' | 'XL'
  glassFactor: number
  basePrice: number
  laborRatePerMin: number
}

export interface WorkshopDayConfig {
  weekday: number
  labelFr: string
  open: boolean
  openTime: string
  closeTime: string
}

export interface VehicleRequestLead {
  id: string
  rawText: string
  requestedBy: string
  createdAt: string
  status: 'new' | 'resolved'
}
