/* Deterministic mock availability — replaced by Supabase slot queries later. */
import { WORKSHOP_SLOTS } from '../../data/mock'

export interface MonthInfo {
  year: number
  month: number // 0-indexed
  label: string
  days: number
  firstWeekday: number // 0 = Monday
}

export type DayAvailability =
  | { state: 'past' }
  | { state: 'closed' }
  | { state: 'full' }
  | { state: 'available'; freeSlots: number }

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function getMonth(offset: number, from = new Date()): MonthInfo {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1)
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    firstWeekday: (d.getDay() + 6) % 7,
  }
}

export function dayAvailability(info: MonthInfo, day: number, today = new Date()): DayAvailability {
  const date = new Date(info.year, info.month, day)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (date < startOfToday) return { state: 'past' }
  if (date.getDay() === 0) return { state: 'closed' } // Sunday
  // deterministic pseudo-availability (mock only)
  if ((day * 3 + info.month * 5) % 7 === 0) return { state: 'full' }
  return { state: 'available', freeSlots: ((day * 2 + info.month) % 4) + 1 }
}

export function slotIsOpen(day: number, month: number, slotIndex: number): boolean {
  return (day + slotIndex * 3 + month) % 4 !== 0
}

export function daySlots(day: number, month: number) {
  return WORKSHOP_SLOTS.map((time, i) => ({ time, open: slotIsOpen(day, month, i) }))
}

export function dayLabel(info: MonthInfo, day: number): string {
  const date = new Date(info.year, info.month, day)
  return `${DAY_NAMES[date.getDay()]} ${day} ${MONTH_NAMES[info.month].toLowerCase()}`
}

export function bookingReference(day: number, month: number, slot: string): string {
  const slotIndex = WORKSHOP_SLOTS.indexOf(slot)
  const n = 1000 + ((day * 37 + slotIndex * 131 + month * 53) % 8999)
  return `TP-${new Date().getFullYear()}-${n}`
}
