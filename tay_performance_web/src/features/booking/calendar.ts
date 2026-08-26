/* Pure date/format helpers for the booking calendar.
   Availability itself is server-truth (get_month_availability / get_available_slots). */

export interface MonthInfo {
  year: number
  month: number // 0-indexed
  label: string
  days: number
  firstWeekday: number // 0 = Monday
}

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

export function dayLabel(info: MonthInfo, day: number): string {
  const date = new Date(info.year, info.month, day)
  return `${DAY_NAMES[date.getDay()]} ${day} ${MONTH_NAMES[info.month].toLowerCase()}`
}
