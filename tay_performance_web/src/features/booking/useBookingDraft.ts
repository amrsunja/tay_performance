/* Booking draft state + live quote (full formula, parameterized by the fetched catalog).
   The local quote is instant UX; the authoritative snapshot is recomputed by the
   create_booking RPC server-side (docs/04 §3). Same math, same inputs. */
import { useMemo, useReducer } from 'react'
import { FRONT_LEGAL_MIN_VLT, type TintZoneCode } from '../../types/domain'
import type { Catalog, CatalogZone, CreatedBooking, QuoteSpec, ResolvedVehicle, SlotHold } from '../../types/api'

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
  selected: ['rear_sides', 'rear_window'],
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
  price: number
}

export interface LocalQuote {
  lines: QuoteLine[]
  base: number
  labor: number
  laborRate: number
  limoSupplement: number
  total: number
  minutes: number
  frontSelected: boolean
  frontIllegal: boolean
  nonCompliant: boolean
  specs: QuoteSpec[]
}

export function vltForZone(zone: CatalogZone, frontVlt: number, rearVlt: number): number {
  return zone.group === 'avant' ? frontVlt : rearVlt
}

/** Full pricing formula — mirrors public._compute_quote exactly (docs/04 §2–3). */
export function computeLocalQuote(catalog: Catalog | undefined, state: DraftState): LocalQuote {
  const empty: LocalQuote = {
    lines: [], base: 0, labor: 0, laborRate: 0, limoSupplement: 0, total: 0, minutes: 0,
    frontSelected: false, frontIllegal: state.frontVlt < FRONT_LEGAL_MIN_VLT, nonCompliant: false, specs: [],
  }
  if (!catalog || !state.vehicle) return empty

  const rule = catalog.rules[state.vehicle.bodyStyle]
  const gran = catalog.settings.slotGranularityMin

  const lines: QuoteLine[] = ZONE_ORDER.filter((code) => state.selected.includes(code))
    .map((code) => catalog.zones.find((z) => z.code === code))
    .filter((z): z is CatalogZone => Boolean(z))
    .map((zone) => {
      const vlt = vltForZone(zone, state.frontVlt, state.rearVlt)
      return { zone, vlt, price: zone.deltas[vlt] ?? zone.price }
    })

  const zonesTotal = lines.reduce((sum, l) => sum + l.price, 0)
  const rawMinutes =
    lines.reduce((sum, l) => sum + l.zone.minutes, 0) +
    (lines.length > 0 ? state.vehicle.baseLaborMinutes : 0)
  const minutes = lines.length > 0 ? Math.ceil(rawMinutes / gran) * gran : 0
  const laborRate = rule?.laborRatePerMin ?? 0
  const labor = Math.round(minutes * laborRate * 100) / 100
  const hasLimo = lines.some((l) => l.vlt <= catalog.settings.limoVltThreshold)
  const limoSupplement = hasLimo && lines.length > 0 ? catalog.settings.limoSupplement : 0
  const base = lines.length > 0 ? (rule?.basePrice ?? 0) : 0
  const total = Math.round((base + zonesTotal + labor + limoSupplement) * 100) / 100

  const frontSelected = lines.some((l) => l.zone.group === 'avant')
  const frontIllegal = state.frontVlt < FRONT_LEGAL_MIN_VLT

  return {
    lines,
    base,
    labor,
    laborRate,
    limoSupplement,
    total,
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
