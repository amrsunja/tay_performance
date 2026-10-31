import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBookingsBetween } from '../../api/admin'
import { getBlackouts, getWorkshopHours } from '../../api/configAdmin'
import type { AdminBookingRow } from '../../types/api'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import StatusPill from '../../components/ui/StatusPill'
import BookingDrawer from './BookingDrawer'
import styles from './admin.module.css'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DEFAULT_OPEN_HOUR = 8
const DEFAULT_CLOSE_HOUR = 19
const HOUR_PX = 52
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const dayTitleFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

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

/** DST-safe: calendar arithmetic, not 24h multiples */
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AgendaPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [openBooking, setOpenBooking] = useState<string | null>(null)
  // phone: one day at a time — null = today when it is in the week, else Monday
  const [pickedDay, setPickedDay] = useState<number | null>(null)
  const isPhone = useMediaQuery('(max-width: 700px)')

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const range = useMemo(() => {
    // exclusive upper bound = next Monday 00:00 (covers all of Sunday)
    return { from: monday.toISOString(), to: addDays(monday, DAYS.length).toISOString() }
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
    const today = isoDate(new Date())
    return DAYS.findIndex((_, i) => isoDate(addDays(monday, i)) === today)
  }, [monday])

  const weekLabel = useMemo(() => {
    const end = addDays(monday, DAYS.length - 1)
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
        sub: b.isCustom ? b.bodyLabel || b.contactName : b.specs.map((s) => `${zoneShort(s.zone)} ${s.vltPercent}%${s.isLegal ? '' : ' (!)'}`).join(' · '),
      }
    })
  }, [bookings.data])

  // the grid grows when the admin booked a custom job outside the usual hours
  const OPEN_HOUR = Math.min(DEFAULT_OPEN_HOUR, ...blocks.map((b) => Math.floor(b.start)))
  const CLOSE_HOUR = Math.min(24, Math.max(DEFAULT_CLOSE_HOUR, ...blocks.map((b) => Math.ceil(b.start + b.duration))))
  const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)

  const shiftWeek = (delta: number) => {
    setWeekOffset((w) => (delta === 0 ? 0 : w + delta))
    setPickedDay(null)
  }

  if (isPhone) {
    const dayIndex = pickedDay ?? (todayIndex >= 0 ? todayIndex : 0)
    const dayDate = addDays(monday, dayIndex)
    const dayHours = (hours.data ?? []).find((h) => h.weekday === dayIndex + 1)
    const blackout = (blackouts.data ?? []).find((b) => b.day === isoDate(dayDate))
    const dayBlocks = blocks.filter((b) => b.day === dayIndex)
    return (
      <div>
        <div className={styles.pageHead}>
          <h1 className={`sat ${styles.pageTitle}`}>Agenda atelier</h1>
        </div>

        <div className={styles.agendaWeekNav}>
          <button type="button" className={styles.iconBtn} aria-label="Semaine précédente" onClick={() => shiftWeek(-1)}>‹</button>
          <span className={`mono ${styles.agendaWeekLabel}`}>{weekLabel}</span>
          <button type="button" className={styles.iconBtn} aria-label="Semaine suivante" onClick={() => shiftWeek(1)}>›</button>
          {weekOffset !== 0 && (
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, marginLeft: 'auto' }} onClick={() => shiftWeek(0)}>
              Aujourd'hui
            </button>
          )}
        </div>

        <div className={styles.agendaDayStrip} role="tablist" aria-label="Jour affiché">
          {DAYS.map((d, i) => {
            const date = addDays(monday, i)
            const count = blocks.filter((b) => b.day === i).length
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={i === dayIndex}
                className={`${styles.agendaDayTab} ${i === dayIndex ? styles.agendaDayTabOn : ''} ${i === todayIndex ? styles.agendaDayTabToday : ''}`}
                onClick={() => setPickedDay(i)}
              >
                <span className="mono">{d}</span>
                <span className={`mono ${styles.agendaDayTabNum}`}>{date.getDate()}</span>
                <span className={`mono ${styles.agendaDayTabCount}`}>{count > 0 ? count : '\u00a0'}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.agendaDayTitle}>
          <span className={`sat ${styles.agendaDayTitleText}`}>{dayTitleFmt.format(dayDate)}</span>
          <span className={`mono ${styles.agendaDayTitleHours}`}>
            {blackout ? `Bloqué · ${blackout.reason}` : dayHours?.isOpen ? `${dayHours.openTime} – ${dayHours.closeTime}` : 'Fermé'}
          </span>
        </div>

        <div className={styles.agendaList}>
          {dayBlocks.length === 0 && (
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {bookings.isPending ? 'Chargement…' : 'Aucun rendez-vous ce jour.'}
            </span>
          )}
          {dayBlocks.map(({ booking: b, tone, sub }) => (
            <button
              key={b.id}
              type="button"
              className={styles.agendaItem}
              style={{ borderLeftColor: TONE_STYLES[tone].border }}
              onClick={() => setOpenBooking(b.id)}
            >
              <span className={`mono ${styles.agendaItemTime}`}>
                {timeFmt.format(new Date(b.slotStart))}
                <span className={styles.agendaItemEnd}>→ {timeFmt.format(new Date(b.slotEnd))}</span>
              </span>
              <span className={styles.agendaItemBody}>
                <span className={`sat ${styles.agendaItemTitle}`}>{b.vehicleLabel}</span>
                <span className={styles.agendaItemWho}>{b.contactName}</span>
                {sub && <span className={`mono ${styles.agendaItemSub}`}>{sub}</span>}
                <StatusPill status={b.status} />
              </span>
            </button>
          ))}
        </div>

        {openBooking && <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />}
      </div>
    )
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Agenda atelier</h1>
        <p className={styles.pageSub}>Semaine {weekLabel} · cliquez un bloc pour ouvrir la fiche.</p>
      </div>

      <div className={styles.toolRow}>
        <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => shiftWeek(-1)}>
          ‹ Semaine préc.
        </button>
        {weekOffset !== 0 && (
          <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => shiftWeek(0)}>
            Cette semaine
          </button>
        )}
        <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => shiftWeek(1)}>
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
            const dayDate = addDays(monday, dayIndex)
            const dayISO = isoDate(dayDate)
            const dayHours = (hours.data ?? []).find((h) => h.weekday === dayIndex + 1)
            const isBlackout = blackoutSet.has(dayISO)
            const closedAll = isBlackout || !dayHours?.isOpen
            const openH = dayHours?.openTime ? Number(dayHours.openTime.slice(0, 2)) + Number(dayHours.openTime.slice(3, 5)) / 60 : DEFAULT_OPEN_HOUR
            const closeH = dayHours?.closeTime ? Number(dayHours.closeTime.slice(0, 2)) + Number(dayHours.closeTime.slice(3, 5)) / 60 : DEFAULT_CLOSE_HOUR
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
