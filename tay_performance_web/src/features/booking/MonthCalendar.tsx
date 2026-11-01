/* Month grid with server-truth availability — the client funnel and the admin dialogs show the same one. */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMonthAvailability } from '../../api/availability'
import { getMonth } from './calendar'
import styles from './booking.module.css'

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

export interface CalendarDate {
  year: number
  month: number // 0-indexed
  day: number
}

interface MonthCalendarProps {
  durationMin: number
  monthOffset: number
  onMonthChange: (offset: number) => void
  selected: CalendarDate | null
  onSelect: (date: CalendarDate) => void
  maxMonthOffset?: number
  /** admin: closed and full days can be picked too (past days never) */
  allowUnavailable?: boolean
}

export default function MonthCalendar({ durationMin, monthOffset, onMonthChange, selected, onSelect, maxMonthOffset = 2, allowUnavailable }: MonthCalendarProps) {
  const month = getMonth(monthOffset)
  const today = new Date()

  const monthAvail = useQuery({
    queryKey: ['availability', 'month', month.year, month.month + 1, durationMin],
    queryFn: () => getMonthAvailability(month.year, month.month + 1, durationMin),
    enabled: durationMin > 0,
    staleTime: 15_000,
  })

  const availByDay = useMemo(() => {
    const map = new Map<number, { state: string; freeCount: number }>()
    for (const d of monthAvail.data ?? []) {
      map.set(Number(d.day.slice(8, 10)), { state: d.state, freeCount: d.freeCount })
    }
    return map
  }, [monthAvail.data])

  const selectedDay = selected && selected.month === month.month && selected.year === month.year ? selected.day : null

  return (
    <div className={styles.calCard}>
      <div className={styles.calNav}>
        <button type="button" className={styles.navBtn} aria-label="Mois précédent" disabled={monthOffset === 0} onClick={() => onMonthChange(monthOffset - 1)}>
          ‹
        </button>
        <div className={`sat ${styles.calLabel}`}>{month.label}</div>
        <button type="button" className={styles.navBtn} aria-label="Mois suivant" disabled={monthOffset >= maxMonthOffset} onClick={() => onMonthChange(monthOffset + 1)}>
          ›
        </button>
      </div>
      <div className={styles.calWeekRow}>
        {WEEKDAYS.map((d) => (
          <div key={d} className={`mono ${styles.calWeekDay}`}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.calGrid}>
        {Array.from({ length: month.firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: month.days }).map((_, i) => {
          const day = i + 1
          const avail = availByDay.get(day) ?? { state: monthAvail.isPending ? 'loading' : 'closed', freeCount: 0 }
          const isToday = today.getFullYear() === month.year && today.getMonth() === month.month && today.getDate() === day
          const isSelected = selectedDay === day
          const pickable = Boolean(allowUnavailable) && (avail.state === 'closed' || avail.state === 'full')
          const clickable = avail.state === 'available' || pickable
          const cls = [
            styles.calDay,
            avail.state === 'past' || avail.state === 'closed' || avail.state === 'loading' ? styles.calDayMuted : '',
            avail.state === 'full' ? styles.calDayFull : '',
            pickable ? styles.calDayPickable : '',
            isToday ? styles.calDayToday : '',
            isSelected ? styles.calDaySelected : '',
          ].join(' ')
          return (
            <button key={day} type="button" className={cls} disabled={!clickable} onClick={() => onSelect({ year: month.year, month: month.month, day })}>
              <span className={`mono ${styles.calDayNum}`}>{day}</span>
              {avail.state === 'available' && (
                <>
                  <span className={`mono ${styles.calDaySub}`}>
                    {avail.freeCount}
                    <span className={styles.calDaySubWord}> libre{avail.freeCount > 1 ? 's' : ''}</span>
                  </span>
                  <span className={styles.calDot} aria-hidden />
                </>
              )}
              {avail.state === 'full' && <span className={`mono ${styles.calDaySubFull}`}>complet</span>}
              {avail.state === 'closed' && <span className={`mono ${styles.calDaySubClosed}`}>fermé</span>}
            </button>
          )
        })}
      </div>
      <div className={styles.calLegend}>
        <span className={styles.bpLegendItem}>
          <span className={styles.calDotStatic} />
          <span className={`mono ${styles.bpLegendText}`}>Créneaux libres</span>
        </span>
        <span className={styles.bpLegendItem}>
          <span className={styles.calSquareDashed} />
          <span className={`mono ${styles.bpLegendText}`}>Complet</span>
        </span>
        <span className={styles.bpLegendItem}>
          <span className={styles.calSquareToday} />
          <span className={`mono ${styles.bpLegendText}`}>Aujourd'hui</span>
        </span>
      </div>
    </div>
  )
}
