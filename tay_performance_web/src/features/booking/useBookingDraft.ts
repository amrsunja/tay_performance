import { useMemo, useReducer } from 'react'
import { FRONT_LEGAL_MIN_VLT, type TintZoneCode } from '../../types/domain'
import { TINT_ZONES } from '../../data/mock'

export type BookingStep = 'config' | 'calendar' | 'confirm'

export interface DraftState {
  step: BookingStep
  selected: TintZoneCode[]
  frontVlt: number
  rearVlt: number
  monthOffset: number
  selectedDate: { year: number; month: number; day: number } | null
  selectedSlot: string | null
}

export type DraftAction =
  | { type: 'toggleZone'; zone: TintZoneCode }
  | { type: 'preset'; zones: TintZoneCode[] }
  | { type: 'setFrontVlt'; value: number }
  | { type: 'setRearVlt'; value: number }
  | { type: 'goStep'; step: BookingStep }
  | { type: 'setMonthOffset'; value: number }
  | { type: 'selectDate'; date: { year: number; month: number; day: number } }
  | { type: 'selectSlot'; slot: string }
  | { type: 'restart' }

export const INITIAL_DRAFT: DraftState = {
  step: 'config',
  selected: ['rear_sides', 'rear_window'],
  frontVlt: 70,
  rearVlt: 20,
  monthOffset: 0,
  selectedDate: null,
  selectedSlot: null,
}

function reducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'toggleZone': {
      const selected = state.selected.includes(action.zone)
        ? state.selected.filter((z) => z !== action.zone)
        : [...state.selected, action.zone]
      return { ...state, selected }
    }
    case 'preset':
      return { ...state, selected: action.zones }
    case 'setFrontVlt':
      return { ...state, frontVlt: action.value }
    case 'setRearVlt':
      return { ...state, rearVlt: action.value }
    case 'goStep':
      return { ...state, step: action.step }
    case 'setMonthOffset':
      return { ...state, monthOffset: action.value, selectedDate: null, selectedSlot: null }
    case 'selectDate':
      return { ...state, selectedDate: action.date, selectedSlot: null }
    case 'selectSlot':
      return { ...state, selectedSlot: action.slot }
    case 'restart':
      return INITIAL_DRAFT
    default:
      return state
  }
}

const ZONE_ORDER: TintZoneCode[] = ['pare_brise', 'front_sides', 'rear_sides', 'rear_window', 'panoramic_roof']

export interface QuoteLine {
  zone: (typeof TINT_ZONES)[number]
  vlt: number
  price: number
}

export function useBookingDraft() {
  const [state, dispatch] = useReducer(reducer, INITIAL_DRAFT)

  const quote = useMemo(() => {
    const lines: QuoteLine[] = ZONE_ORDER.filter((code) => state.selected.includes(code)).map((code) => {
      const zone = TINT_ZONES.find((z) => z.code === code)!
      const vlt = zone.group === 'avant' ? state.frontVlt : state.rearVlt
      return { zone, vlt, price: zone.price }
    })
    const hasLimoFilm = lines.some((l) => l.vlt <= 20)
    const limoSupplement = hasLimoFilm && lines.length > 0 ? 30 : 0
    const total = lines.reduce((sum, l) => sum + l.price, 0) + limoSupplement
    const minutes = lines.reduce((sum, l) => sum + l.zone.minutes, 0)
    const frontSelected = lines.some((l) => l.zone.group === 'avant')
    const frontIllegal = state.frontVlt < FRONT_LEGAL_MIN_VLT
    return {
      lines,
      limoSupplement,
      total,
      minutes,
      frontSelected,
      frontIllegal,
      nonCompliant: frontSelected && frontIllegal,
    }
  }, [state.selected, state.frontVlt, state.rearVlt])

  return { state, dispatch, quote }
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  if (minutes < 60) return `~${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `~${h}h${m ? ` ${m}min` : ''}`
}
