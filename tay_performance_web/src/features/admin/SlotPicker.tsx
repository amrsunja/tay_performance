/* Date + free start times (server truth) for a given duration. With `allowManual` the admin can
   also type a time out of the grid — agreed by phone, only an overlap is refused (server rule). */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDaySlots } from '../../api/availability'
import { parisParts, parisToDate } from '../../lib/parisTime'
import styles from './admin.module.css'

const slotTimeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

interface SlotPickerProps {
  durationMin: number
  /** ISO start, '' = none */
  value: string
  onChange: (iso: string) => void
  allowManual?: boolean
}

export default function SlotPicker({ durationMin, value, onChange, allowManual }: SlotPickerProps) {
  const [day, setDay] = useState('')
  const [manualTime, setManualTime] = useState('')

  const slots = useQuery({
    queryKey: ['availability', 'day', day, durationMin],
    queryFn: () => getDaySlots(day, durationMin),
    enabled: Boolean(day) && durationMin > 0,
    staleTime: 0,
  })
  const free = (slots.data ?? []).filter((s) => s.state !== 'taken')

  // another duration = other free starts: an earlier pick from the grid is no longer valid
  useEffect(() => {
    if (!manualTime) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin])

  return (
    <div className={styles.formGroup}>
      <input
        className="field mono"
        type="date"
        value={day}
        min={parisParts(new Date()).date}
        onChange={(e) => {
          setDay(e.target.value)
          setManualTime('')
          onChange('')
        }}
        aria-label="Date"
      />
      {day && (
        <div className={styles.chipRow}>
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
            <span className={`mono ${styles.formHint}`}>Aucun créneau libre ce jour dans les horaires de l'atelier.</span>
          )}
        </div>
      )}
      {day && allowManual && (
        <label className={styles.formHint} style={{ display: 'grid', gap: 6 }}>
          Ou une autre heure (heure de Paris)
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
    </div>
  )
}
