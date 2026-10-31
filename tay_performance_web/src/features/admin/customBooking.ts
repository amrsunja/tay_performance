/* Shared by the devis confirmation and the new-booking wizard. */

export const CUSTOM_DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 90, label: '1 h 30' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 240, label: '4 h' },
  { minutes: 360, label: '6 h' },
  { minutes: 480, label: '8 h' },
  { minutes: 600, label: '10 h' },
]

/** '' = no price yet ("sur devis"); accepts the French comma. */
export function parsePriceInput(input: string): { value: number | null; valid: boolean } {
  if (input.trim() === '') return { value: null, valid: true }
  const n = Number(input.replace(',', '.'))
  return { value: n, valid: Number.isFinite(n) && n >= 0 }
}
