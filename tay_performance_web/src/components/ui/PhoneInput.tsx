/* Masked phone input — France by default ("06 12 34 56 78"), country picker for the rest.
   Emits the E.164 value ('' while incomplete/invalid) so callers can store it as-is. */
import { useEffect, useState } from 'react'
import {
  countryByIso,
  countryOfE164,
  DEFAULT_COUNTRY,
  formatNational,
  nationalDigits,
  PHONE_COUNTRIES,
  toE164,
} from '../../lib/phone'

interface PhoneInputProps {
  /** E.164 or '' */
  value: string
  onChange: (e164: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export default function PhoneInput({
  value,
  onChange,
  placeholder,
  required = true,
  autoFocus,
  disabled,
  className,
  style,
  'aria-label': ariaLabel,
}: PhoneInputProps) {
  const initialCountry = value ? countryOfE164(value) : DEFAULT_COUNTRY
  const [iso, setIso] = useState(initialCountry.iso)
  const [text, setText] = useState(() =>
    value ? formatNational(value.replace(/^\+/, '').slice(initialCountry.dial.length), initialCountry) : '',
  )
  const country = countryByIso(iso)

  // external reset (e.g. profile loaded after mount)
  useEffect(() => {
    if (!value) return
    const c = countryOfE164(value)
    const nat = value.replace(/^\+/, '').slice(c.dial.length)
    const current = toE164(nationalDigits(text, country), country)
    if (current !== value) {
      setIso(c.iso)
      setText(formatNational(nat, c))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const apply = (raw: string, c = country) => {
    let cc = c
    // typing "+xx" switches country automatically
    if (raw.trim().startsWith('+')) {
      const guess = countryOfE164(raw.replace(/[^\d+]/g, ''))
      if (guess.iso !== 'XX' && guess.iso !== cc.iso) {
        cc = guess
        setIso(guess.iso)
      }
    }
    const nat = nationalDigits(raw, cc)
    setText(cc.iso === 'XX' ? '+' + nat : formatNational(nat, cc))
    onChange(toE164(nat, cc) ?? '')
  }

  const complete = value !== '' && toE164(nationalDigits(text, country), country) === value
  const showError = required && text.replace(/\D/g, '').length > 0 && !complete

  return (
    <div className={className} style={{ display: 'flex', gap: 6, alignItems: 'stretch', ...style }}>
      <select
        className="field mono"
        aria-label="Indicatif pays"
        value={iso}
        disabled={disabled}
        onChange={(e) => {
          const c = countryByIso(e.target.value)
          setIso(c.iso)
          apply(nationalDigits(text, country), c)
        }}
        style={{ width: 96, flex: '0 0 auto', padding: '0 8px', fontSize: 13 }}
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.dial ? `+${c.dial}` : '+…'}
          </option>
        ))}
      </select>
      <input
        className="field mono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-label={ariaLabel ?? 'Téléphone'}
        aria-invalid={showError || undefined}
        placeholder={placeholder ?? (country.iso === 'FR' ? '06 12 34 56 78' : `+${country.dial} …`)}
        value={text}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => apply(e.target.value)}
        onPaste={(e) => {
          e.preventDefault()
          apply(e.clipboardData.getData('text'))
        }}
        style={{ flex: 1, minWidth: 0, borderColor: showError ? 'var(--status-warning)' : undefined }}
      />
    </div>
  )
}
