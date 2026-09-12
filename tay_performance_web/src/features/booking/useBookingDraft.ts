/* Booking draft state + live quote (full formula, parameterized by the fetched catalog).
   The local quote is instant UX; the authoritative snapshot is recomputed by the
   create_booking RPC server-side (docs/04 §3). Same math, same inputs. */
import { useMemo, useReducer } from 'react'
import { FRONT_LEGAL_MIN_VLT, TLV_STOPS, type TintZoneCode } from '../../types/domain'
import type { Catalog, CatalogZone, CreatedBooking, ModelPriceOverride, PricingRuleInfo, QuoteSpec, ResolvedVehicle, SlotHold } from '../../types/api'

export type BookingStep = 'vehicle' | 'config' | 'calendar' | 'confirm'

export interface DraftState {
  step: BookingStep
  vehicle: ResolvedVehicle | null
  selected: TintZoneCode[]
  frontVlt: number
  rearVlt: number
  ack: boolean
  monthOffset: number
  selectedDate: { year: number; month: number; day: number } | null
  hold: SlotHold | null
  contactName: string
  contactPhone: string
  contactEmail: string
  clientNotes: string
  /** the RDV is for someone else: contact_* = that person, booker_* = the profile's own contact */
  forOther: boolean
  bookerName: string
  bookerPhone: string
  bookerEmail: string
  rescheduleOf: string | null
  result: CreatedBooking | null
}

export type DraftAction =
  | { type: 'setVehicle'; vehicle: ResolvedVehicle }
  | { type: 'changeVehicle' }
  | { type: 'toggleZone'; zone: TintZoneCode }
  | { type: 'preset'; zones: TintZoneCode[] }
  | { type: 'setFrontVlt'; value: number }
  | { type: 'setRearVlt'; value: number }
  | { type: 'setAck'; value: boolean }
  | { type: 'goStep'; step: BookingStep }
  | { type: 'setMonthOffset'; value: number }
  | { type: 'selectDate'; date: { year: number; month: number; day: number } }
  | { type: 'setHold'; hold: SlotHold }
  | { type: 'clearHold' }
  | {
      type: 'setContact'
      field: 'contactName' | 'contactPhone' | 'contactEmail' | 'clientNotes' | 'bookerName' | 'bookerPhone' | 'bookerEmail'
      value: string
    }
  | { type: 'setForOther'; value: boolean }
  | { type: 'setReschedule'; bookingId: string }
  | { type: 'hydrateSpecs'; selected: TintZoneCode[]; frontVlt: number; rearVlt: number }
  | { type: 'setResult'; result: CreatedBooking }
  | { type: 'restart' }

export const INITIAL_DRAFT: DraftState = {
  step: 'vehicle',
  vehicle: null,
  selected: ['rear_sides'],
  frontVlt: 70,
  rearVlt: 20,
  ack: false,
  monthOffset: 0,
  selectedDate: null,
  hold: null,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  clientNotes: '',
  forOther: false,
  bookerName: '',
  bookerPhone: '',
  bookerEmail: '',
  rescheduleOf: null,
  result: null,
}

function reducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'setVehicle':
      return { ...state, vehicle: action.vehicle, step: 'config' }
    case 'changeVehicle':
      return { ...state, vehicle: null, step: 'vehicle', hold: null, selectedDate: null }
    case 'toggleZone': {
      const selected = state.selected.includes(action.zone)
        ? state.selected.filter((z) => z !== action.zone)
        : [...state.selected, action.zone]
      return { ...state, selected, ack: false, hold: null }
    }
    case 'preset':
      return { ...state, selected: action.zones, ack: false, hold: null }
    case 'setFrontVlt':
      return { ...state, frontVlt: action.value, ack: false }
    case 'setRearVlt':
      return { ...state, rearVlt: action.value }
    case 'setAck':
      return { ...state, ack: action.value }
    case 'goStep':
      return { ...state, step: action.step }
    case 'setMonthOffset':
      return { ...state, monthOffset: action.value, selectedDate: null, hold: null }
    case 'selectDate':
      return { ...state, selectedDate: action.date, hold: null }
    case 'setHold':
      return { ...state, hold: action.hold }
    case 'clearHold':
      return { ...state, hold: null }
    case 'setContact':
      return { ...state, [action.field]: action.value }
    case 'setForOther':
      return { ...state, forOther: action.value }
    case 'setReschedule':
      return { ...state, rescheduleOf: action.bookingId }
    case 'hydrateSpecs':
      return { ...state, selected: action.selected, frontVlt: action.frontVlt, rearVlt: action.rearVlt }
    case 'setResult':
      return { ...state, result: action.result, step: 'confirm', hold: null }
    case 'restart':
      return INITIAL_DRAFT
    default:
      return state
  }
}

const ZONE_ORDER: TintZoneCode[] = ['pare_brise', 'front_sides', 'rear_sides', 'rear_window', 'panoramic_roof']

export interface QuoteLine {
  zone: CatalogZone
  vlt: number
  /** pack price for this body style (0 when sur devis) */
  price: number
  minutes: number
  /** price comes from a per-model override (Tesla Model 3 …) */
  overridden: boolean
}

export interface LocalQuote {
  lines: QuoteLine[]
  /** null = sur devis (utilitaire / pick-up): the workshop sets the price after analysis */
  total: number | null
  onRequest: boolean
  modelOverride: boolean
  minutes: number
  frontSelected: boolean
  frontIllegal: boolean
  nonCompliant: boolean
  specs: QuoteSpec[]
}

/** Legacy specs (rear_window, panoramic_roof) → v2 packs. */
export function normalizeSelection(zones: TintZoneCode[]): TintZoneCode[] {
  const out = new Set<TintZoneCode>()
  for (const z of zones) {
    if (z === 'rear_window') out.add('rear_sides')
    else if (z === 'panoramic_roof') continue
    else out.add(z)
  }
  return Array.from(out)
}

/** Snap any percentage onto the TLV levels sold (85 → 70, 10 → 5 …). */
export function nearestTlv(v: number): number {
  return TLV_STOPS.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), TLV_STOPS[0] as number)
}

export function vltForZone(zone: CatalogZone, frontVlt: number, rearVlt: number): number {
  return zone.group === 'avant' ? frontVlt : rearVlt
}

/** Pack price of a zone for a body style, with the optional per-model override. */
export function zonePrice(
  zone: Pick<CatalogZone, 'code'>,
  rule: Pick<PricingRuleInfo, 'rearPrice' | 'frontPrice' | 'windshieldPrice'> | undefined,
  override?: Pick<ModelPriceOverride, 'rearPrice' | 'frontPrice' | 'windshieldPrice'> | null,
): { price: number; overridden: boolean } {
  switch (zone.code) {
    case 'rear_sides':
      return override?.rearPrice != null ? { price: override.rearPrice, overridden: true } : { price: rule?.rearPrice ?? 0, overridden: false }
    case 'front_sides':
      return override?.frontPrice != null ? { price: override.frontPrice, overridden: true } : { price: rule?.frontPrice ?? 0, overridden: false }
    case 'pare_brise':
      return override?.windshieldPrice != null
        ? { price: override.windshieldPrice, overridden: true }
        : { price: rule?.windshieldPrice ?? 0, overridden: false }
    default:
      return { price: 0, overridden: false }
  }
}

/** Minutes of a zone: fixed minutes (pare-brise) + share of the pose time (arrière 60 % / avant 40 %). */
export function zoneMinutes(zone: Pick<CatalogZone, 'minutes' | 'timeSharePct'>, poseMinutes: number): number {
  return zone.minutes + Math.round((poseMinutes * zone.timeSharePct) / 100)
}

/** Pricing v2 — mirrors public._compute_quote exactly (migration 0016). */
export function computeLocalQuote(catalog: Catalog | undefined, state: DraftState): LocalQuote {
  const empty: LocalQuote = {
    lines: [], total: 0, onRequest: false, modelOverride: false, minutes: 0,
    frontSelected: false, frontIllegal: state.frontVlt < FRONT_LEGAL_MIN_VLT, nonCompliant: false, specs: [],
  }
  if (!catalog || !state.vehicle) return empty

  const rule = catalog.rules[state.vehicle.bodyStyle]
  const override = state.vehicle.modelId ? catalog.modelOverrides[state.vehicle.modelId] : undefined
  const onRequest = Boolean(rule?.quoteOnRequest)
  const gran = catalog.settings.slotGranularityMin

  const lines: QuoteLine[] = ZONE_ORDER.filter((code) => state.selected.includes(code))
    .map((code) => catalog.zones.find((z) => z.code === code))
    .filter((z): z is CatalogZone => Boolean(z))
    .map((zone) => {
      const vlt = vltForZone(zone, state.frontVlt, state.rearVlt)
      const { price, overridden } = zonePrice(zone, rule, override)
      return { zone, vlt, price: onRequest ? 0 : price, minutes: zoneMinutes(zone, state.vehicle!.baseLaborMinutes), overridden }
    })

  const rawMinutes = lines.reduce((sum, l) => sum + l.minutes, 0)
  const minutes = lines.length > 0 ? Math.max(gran, Math.ceil(rawMinutes / gran) * gran) : 0
  const zonesTotal = lines.reduce((sum, l) => sum + l.price, 0)
  const total = lines.length === 0 ? 0 : onRequest ? null : Math.round(zonesTotal * 100) / 100

  const frontSelected = lines.some((l) => l.zone.group === 'avant')
  const frontIllegal = state.frontVlt < FRONT_LEGAL_MIN_VLT

  return {
    lines,
    total,
    onRequest,
    modelOverride: lines.some((l) => l.overridden),
    minutes,
    frontSelected,
    frontIllegal,
    nonCompliant: frontSelected && frontIllegal,
    specs: lines.map((l) => ({ zone_code: l.zone.code, vlt_percent: l.vlt })),
  }
}

export function useBookingDraft() {
  const [state, dispatch] = useReducer(reducer, INITIAL_DRAFT)
  return { state, dispatch }
}

export function useLocalQuote(catalog: Catalog | undefined, state: DraftState): LocalQuote {
  return useMemo(() => computeLocalQuote(catalog, state), [catalog, state])
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  if (minutes < 60) return `~${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `~${h}h${m ? ` ${m}min` : ''}`
}

export function formatEuro(n: number): string {
  return Number.isInteger(n) ? `${n}€` : `${n.toFixed(2)}€`
}

/** Price cell for a booking / quote: null = the workshop still has to set it. */
export const PRICE_PENDING_LABEL = 'Sur devis'
export function formatPrice(n: number | null | undefined): string {
  return n == null ? PRICE_PENDING_LABEL : formatEuro(n)
}
