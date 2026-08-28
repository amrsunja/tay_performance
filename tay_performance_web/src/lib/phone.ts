/* Phone helpers — France-first, international allowed. No external dependency.
   Storage format everywhere: E.164 (+33612345678). Display: national grouping. */

export interface PhoneCountry {
  iso: string
  dial: string
  label: string
  flag: string
  /** national significant number length(s) */
  lengths: number[]
  /** digit groups for the mask (national number, leading trunk 0 included for FR-style) */
  groups: number[]
  /** trunk prefix stripped when converting to E.164 */
  trunk?: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'FR', dial: '33', label: 'France', flag: '🇫🇷', lengths: [9], groups: [2, 2, 2, 2, 2], trunk: '0' },
  { iso: 'BE', dial: '32', label: 'Belgique', flag: '🇧🇪', lengths: [8, 9], groups: [4, 2, 2, 2], trunk: '0' },
  { iso: 'CH', dial: '41', label: 'Suisse', flag: '🇨🇭', lengths: [9], groups: [3, 3, 2, 2], trunk: '0' },
  { iso: 'LU', dial: '352', label: 'Luxembourg', flag: '🇱🇺', lengths: [6, 7, 8, 9], groups: [3, 3, 3] },
  { iso: 'DE', dial: '49', label: 'Allemagne', flag: '🇩🇪', lengths: [10, 11], groups: [4, 3, 4], trunk: '0' },
  { iso: 'IT', dial: '39', label: 'Italie', flag: '🇮🇹', lengths: [9, 10], groups: [3, 3, 4] },
  { iso: 'ES', dial: '34', label: 'Espagne', flag: '🇪🇸', lengths: [9], groups: [3, 3, 3] },
  { iso: 'PT', dial: '351', label: 'Portugal', flag: '🇵🇹', lengths: [9], groups: [3, 3, 3] },
  { iso: 'NL', dial: '31', label: 'Pays-Bas', flag: '🇳🇱', lengths: [9], groups: [2, 3, 4], trunk: '0' },
  { iso: 'GB', dial: '44', label: 'Royaume-Uni', flag: '🇬🇧', lengths: [10], groups: [4, 6], trunk: '0' },
  { iso: 'MA', dial: '212', label: 'Maroc', flag: '🇲🇦', lengths: [9], groups: [3, 2, 2, 2], trunk: '0' },
  { iso: 'DZ', dial: '213', label: 'Algérie', flag: '🇩🇿', lengths: [9], groups: [3, 2, 2, 2], trunk: '0' },
  { iso: 'TN', dial: '216', label: 'Tunisie', flag: '🇹🇳', lengths: [8], groups: [2, 3, 3] },
  { iso: 'TR', dial: '90', label: 'Turquie', flag: '🇹🇷', lengths: [10], groups: [3, 3, 2, 2], trunk: '0' },
  { iso: 'US', dial: '1', label: 'États-Unis / Canada', flag: '🇺🇸', lengths: [10], groups: [3, 3, 4] },
  { iso: 'XX', dial: '', label: 'Autre (+indicatif)', flag: '🌐', lengths: [6, 7, 8, 9, 10, 11, 12, 13, 14], groups: [3, 3, 3, 3, 3] },
]

export const DEFAULT_COUNTRY = PHONE_COUNTRIES[0]

export function countryByIso(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY
}

/** Detect the country of an E.164 number (longest dial-code match). */
export function countryOfE164(e164: string): PhoneCountry {
  const digits = e164.replace(/^\+/, '')
  let best: PhoneCountry | null = null
  for (const c of PHONE_COUNTRIES) {
    if (c.dial && digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c
  }
  return best ?? countryByIso('XX')
}

/** National significant number (no trunk prefix) from raw user input for a country. */
export function nationalDigits(input: string, country: PhoneCountry): string {
  let d = input.replace(/\D/g, '')
  if (country.iso === 'XX') return d
  // user pasted an international form
  if (input.trim().startsWith('+') || d.startsWith('00')) {
    d = d.replace(/^00/, '')
    if (d.startsWith(country.dial)) d = d.slice(country.dial.length)
  } else if (country.trunk && d.startsWith(country.trunk)) {
    d = d.slice(country.trunk.length)
  }
  return d
}

/** Mask the national digits for display (FR: "06 12 34 56 78"). */
export function formatNational(national: string, country: PhoneCountry): string {
  const withTrunk = country.trunk && national ? country.trunk + national : national
  const maxDigits = Math.max(...country.lengths) + (country.trunk ? country.trunk.length : 0)
  const digits = withTrunk.slice(0, country.iso === 'XX' ? 15 : maxDigits)
  const out: string[] = []
  let i = 0
  for (const g of country.groups) {
    if (i >= digits.length) break
    out.push(digits.slice(i, i + g))
    i += g
  }
  if (i < digits.length) out.push(digits.slice(i))
  return out.join(' ')
}

/** E.164 or null when the national number is not plausible for the country. */
export function toE164(national: string, country: PhoneCountry): string | null {
  const d = national.replace(/\D/g, '')
  if (country.iso === 'XX') {
    return /^\d{7,15}$/.test(d) ? '+' + d : null
  }
  if (!country.lengths.includes(d.length)) return null
  if (country.iso === 'FR' && !/^[1-9]/.test(d)) return null
  return '+' + country.dial + d
}

/** Loose normalisation of any stored/typed value to E.164 (FR default). */
export function normalizePhone(input: string): string | null {
  const raw = input.replace(/[\s.\-()]/g, '')
  if (/^\+\d{8,15}$/.test(raw)) return raw
  if (/^00\d{8,15}$/.test(raw)) return '+' + raw.slice(2)
  if (/^0[1-9]\d{8}$/.test(raw)) return '+33' + raw.slice(1)
  return null
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null
}

/** Pretty display of an E.164 number ("+33 6 12 34 56 78" → "06 12 34 56 78" for FR). */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return ''
  const c = countryOfE164(e164)
  const national = e164.replace(/^\+/, '').slice(c.dial.length)
  if (c.iso === 'FR') return formatNational(national, c)
  return `+${c.dial} ${formatNational(national, c)}`.trim()
}
