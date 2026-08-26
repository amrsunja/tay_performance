import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBookingsBetween } from '../../api/admin'
import { getBlackouts, getWorkshopHours } from '../../api/configAdmin'
import type { AdminBookingRow } from '../../types/api'
import BookingDrawer from './BookingDrawer'
import styles from './admin.module.css'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const OPEN_HOUR = 8
const CLOSE_HOUR = 19
const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)
const HOUR_PX = 52

type Tone = 'amber' | 'blue' | 'green' | 'muted'
const TONE_STYLES: Record<Tone, { border: string; bg: string }> = {
  amber: { border: 'rgba(255,158,27,.55)', bg: 'rgba(255,158,27,.10)' },
  blue: { border: 'rgba(41,171,226,.55)', bg: 'rgba(41,171,226,.10)' },
  green: { border: 'rgba(52,211,153,.5)', bg: 'rgba(52,211,153,.09)' },
  muted: { border: 'var(--border-strong)', bg: 'var(--surface-2)' },
}

function toneOf(b: AdminBookingRow): Tone {
  if (b.status === 'no_show') return 'muted'
  if (b.status === 'requested' || b.specs.some((s) => !s.isLegal)) return 'amber'
  if (b.status === 'in_progress') return 'blue'
  return 'green'
}

function zoneShort(code: string) {
  const map: Record<string, string> = {
    pare_brise: 'PB', front_sides: 'AV', rear_sides: 'AR', rear_window: 'LUN', panoramic_roof: 'TOIT',
  }
  return map[code] ?? code
}

function mondayOf(offsetWeeks: number): Date {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offsetWeeks * 7)
  return monday
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AgendaPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [openBooking, setOpenBooking] = useState<string | null>(null)

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const range = useMemo(() => {
    const end = new Date(monday.getTime() + 6 * 24 * 3600_000)
    return { from: monday.toISOString(), to: end.toISOString() }
  }, [monday])

  const bookings = useQuery({
    queryKey: ['admin', 'agenda', isoDate(monday)],
    queryFn: () => getBookingsBetween(range.from, range.to),
    staleTime: 10_000,
  })
  const hours = useQuery({ queryKey: ['config', 'hours'], queryFn: getWorkshopHours })
  const blackouts = useQuery({ queryKey: ['config', 'blackouts'], queryFn: getBlackouts })

  const blackoutSet = useMemo(() => new Set((blackouts.data ?? []).map((b) => b.day)), [blackouts.data])

  const todayIndex = useMemo(() => {
    const now = new Date()
    const idx = Math.floor((now.getTime() - monday.getTime()) / (24 * 3600_000))
    return idx >= 0 && idx < 6 ? idx : -1
  }, [monday])

  const weekLabel = useMemo(() => {
    const end = new Date(monday.getTime() + 5 * 24 * 3600_000)
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    return `${fmt.format(monday)} → ${fmt.format(end)}`
  }, [monday])

  const blocks = useMemo(() => {
    return (bookings.data ?? []).map((b) => {
      const start = new Date(b.slotStart)
      const dayIndex = (start.getDay() + 6) % 7
      const startHour = start.getHours() + start.getMinutes() / 60
      return {
        booking: b,
        day: dayIndex,
        start: startHour,
        duration: b.durationMin / 60,
        tone: toneOf(b),
        sub: b.specs.map((s) => `${zoneShort(s.zone)} ${s.vltPercent}%${s.isLegal ? '' : ' ⚠'}`).join(' · '),
      }
    })
  }, [bookings.data])

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Agenda atelier</h1>
        <p className={styles.pageSub}>Semaine {weekLabel} · cliquez un bloc pour ouvrir la fiche.</p>
      </div>

      <div className={styles.toolRow}>
        <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setWeekOffset((w) => w - 1)}>
          ‹ Semaine préc.
        </button>
        {weekOffset !== 0 && (
          <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setWeekOffset(0)}>
            Cette semaine
          </button>
        )}
        <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setWeekOffset((w) => w + 1)}>
          Semaine suiv. ›
        </button>
      </div>

      <div className={styles.agendaCard}>
        <div className={styles.agendaGrid} style={{ gridTemplateColumns: `64px repeat(${DAYS.length}, 1fr)` }}>
          {/* header row */}
          <div />
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={`mono ${styles.agendaDayHead}`}
              style={i === todayIndex ? { color: 'var(--octane-500)' } : undefined}
            >
              {d}
              {i === todayIndex && <span className={styles.agendaTodayDot} aria-hidden />}
            </div>
          ))}

          {/* hours column */}
          <div className={styles.agendaHours}>
            {HOURS.map((h) => (
              <div key={h} className={`mono ${styles.agendaHour}`} style={{ height: HOUR_PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* day columns */}
          {DAYS.map((d, dayIndex) => {
            const dayDate = new Date(monday.getTime() + dayIndex * 24 * 3600_000)
            const dayISO = isoDate(dayDate)
            const dayHours = (hours.data ?? []).find((h) => h.weekday === dayIndex + 1)
            const isBlackout = blackoutSet.has(dayISO)
            const closedAll = isBlackout || !dayHours?.isOpen
            const openH = dayHours?.openTime ? Number(dayHours.openTime.slice(0, 2)) + Number(dayHours.openTime.slice(3, 5)) / 60 : OPEN_HOUR
            const closeH = dayHours?.closeTime ? Number(dayHours.closeTime.slice(0, 2)) + Number(dayHours.closeTime.slice(3, 5)) / 60 : CLOSE_HOUR
            return (
              <div key={d} className={styles.agendaDayCol} style={{ height: HOURS.length * HOUR_PX }}>
                {HOURS.map((h) => (
                  <div key={h} className={styles.agendaCell} style={{ height: HOUR_PX }} />
                ))}
                {closedAll ? (
                  <div className={styles.agendaClosed} style={{ top: 0, height: HOURS.length * HOUR_PX }}>
                    <span className="mono">{isBlackout ? 'BLOQUÉ' : 'FERMÉ'}</span>
                  </div>
                ) : (
                  <>
                    {openH > OPEN_HOUR && (
                      <div className={styles.agendaClosed} style={{ top: 0, height: (openH - OPEN_HOUR) * HOUR_PX }}>
                        <span className="mono">FERMÉ</span>
                      </div>
                    )}
                    {closeH < CLOSE_HOUR && (
                      <div
                        className={styles.agendaClosed}
                        style={{ top: (closeH - OPEN_HOUR) * HOUR_PX, height: (CLOSE_HOUR - closeH) * HOUR_PX }}
                      >
                        <span className="mono">FERMÉ</span>
                      </div>
                    )}
                  </>
                )}
                {blocks
                  .filter((b) => b.day === dayIndex)
                  .map((block) => {
                    const tone = TONE_STYLES[block.tone]
                    return (
                      <button
                        key={block.booking.id}
                        type="button"
                        className={styles.agendaBlock}
                        style={{
                          top: (block.start - OPEN_HOUR) * HOUR_PX + 2,
                          height: Math.max(24, block.duration * HOUR_PX - 4),
                          borderColor: tone.border,
                          background: tone.bg,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: 'calc(100% - 8px)',
                        }}
                        onClick={() => setOpenBooking(block.booking.id)}
                      >
                        <span className={`sat ${styles.agendaBlockTitle}`}>{block.booking.vehicleLabel}</span>
                        <span className={`mono ${styles.agendaBlockSub}`}>{block.sub}</span>
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      {openBooking && <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />}
    </div>
  )
}
