/* The client's calendar and free times, plus any other time the admin wants. A time overlapping
   an RDV is shown as such and needs an explicit confirmation (server: p_allow_overlap, 0024). */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSlotConflicts } from '../../api/admin'
import { getDaySlots } from '../../api/availability'
import { parisToDate } from '../../lib/parisTime'
import Icon from '../../components/ui/Icon'
import MonthCalendar, { type CalendarDate } from '../booking/MonthCalendar'
import booking from '../booking/booking.module.css'
import styles from './admin.module.css'

const slotTimeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const MAX_MONTH_OFFSET = 12

const pad = (n: number) => String(n).padStart(2, '0')

/** none: free · unresolved: being checked, or overlapping and not confirmed · accepted: confirmed by the admin */
export type SlotConflictState = 'none' | 'unresolved' | 'accepted'

interface SlotPickerProps {
  durationMin: number
  /** ISO start, '' = none */
  value: string
  onChange: (iso: string) => void
  onConflictChange: (state: SlotConflictState) => void
}

export default function SlotPicker({ durationMin, value, onChange, onConflictChange }: SlotPickerProps) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [date, setDate] = useState<CalendarDate | null>(null)
  const [manualTime, setManualTime] = useState('')
  const [accepted, setAccepted] = useState(false)
  const day = date ? `${date.year}-${pad(date.month + 1)}-${pad(date.day)}` : ''

  const slots = useQuery({
    queryKey: ['availability', 'day', day, durationMin],
    queryFn: () => getDaySlots(day, durationMin),
    enabled: Boolean(day) && durationMin > 0,
    staleTime: 0,
  })
  const free = (slots.data ?? []).filter((s) => s.state !== 'taken')

  const conflicts = useQuery({
    queryKey: ['admin', 'slot-conflicts', value, durationMin],
    queryFn: () => getSlotConflicts(value, new Date(new Date(value).getTime() + durationMin * 60_000).toISOString()),
    enabled: Boolean(value) && durationMin > 0,
    staleTime: 0,
  })
  const taken = conflicts.data?.bookings ?? []
  const holds = conflicts.data?.holds ?? 0
  const hasConflict = taken.length > 0 || holds > 0

  // another time = another decision
  useEffect(() => setAccepted(false), [value, durationMin])

  // another duration = other free starts: a pick from the grid may no longer exist
  useEffect(() => {
    if (!manualTime) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin])

  useEffect(() => {
    // a failed check falls through to the server, which refuses an unconfirmed overlap anyway
    if (!value || conflicts.isError) onConflictChange('none')
    else if (conflicts.isPending) onConflictChange('unresolved')
    else if (hasConflict) onConflictChange(accepted ? 'accepted' : 'unresolved')
    else onConflictChange('none')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, conflicts.isPending, conflicts.isError, hasConflict, accepted])

  return (
    <div className={styles.formGroup}>
      <MonthCalendar
        allowUnavailable
        maxMonthOffset={MAX_MONTH_OFFSET}
        durationMin={durationMin}
        monthOffset={monthOffset}
        onMonthChange={setMonthOffset}
        selected={date}
        onSelect={(d) => {
          setDate(d)
          setManualTime('')
          onChange('')
        }}
      />

      {day && (
        <div className={styles.chipRow} style={{ marginTop: 4 }}>
          {free.map((s) => (
            <button
              key={s.slotStart}
              type="button"
              className="chip mono"
              aria-pressed={!manualTime && value === s.slotStart}
              onClick={() => {
                setManualTime('')
                onChange(s.slotStart)
              }}
            >
              {slotTimeFmt.format(new Date(s.slotStart))}
            </button>
          ))}
          {!slots.isPending && free.length === 0 && (
            <span className={`mono ${styles.formHint}`}>Aucun créneau libre ce jour — choisissez une heure ci-dessous.</span>
          )}
        </div>
      )}

      {day && (
        <label className={styles.formHint} style={{ display: 'grid', gap: 6 }}>
          Ou l'heure de votre choix (heure de Paris)
          <input
            className="field mono"
            type="time"
            step={900}
            value={manualTime}
            onChange={(e) => {
              setManualTime(e.target.value)
              onChange(/^\d{2}:\d{2}$/.test(e.target.value) ? parisToDate(day, e.target.value).toISOString() : '')
            }}
            aria-label="Heure"
          />
        </label>
      )}

      {value && hasConflict && (
        <div className={booking.warnBox} role="alert">
          <Icon name="warning" size={20} style={{ color: 'var(--status-warning)', marginTop: 1, flex: 'none' }} />
          <span className={booking.warnText}>
            <b>Vous avez déjà un rendez-vous sur ce créneau.</b>
            {taken.map((b) => (
              <span key={b.id} style={{ display: 'block', marginTop: 4 }}>
                <span className="mono">{slotTimeFmt.format(new Date(b.slotStart))} – {slotTimeFmt.format(new Date(b.slotEnd))}</span>
                {' · '}{b.vehicleLabel} · {b.contactName}
              </span>
            ))}
            {holds > 0 && <span style={{ display: 'block', marginTop: 4 }}>Un client est en train de réserver ce créneau.</span>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontWeight: 500 }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              Créer quand même sur ce créneau
            </label>
          </span>
        </div>
      )}
    </div>
  )
}
