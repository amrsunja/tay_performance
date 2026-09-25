import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusPill from '../../components/ui/StatusPill'
import { advanceStatus, getBookingsBetween, onBookingsChange } from '../../api/admin'
import { errorMessage } from '../../lib/supabase'
import type { BookingStatus } from '../../types/domain'
import { formatDuration } from '../booking/useBookingDraft'
import { filterBookings } from '../../lib/phone'
import BookingDrawer from './BookingDrawer'
import Icon from '../../components/ui/Icon'
import styles from './admin.module.css'

function zoneShort(code: string) {
  const map: Record<string, string> = {
    pare_brise: 'PB', front_sides: 'AV', rear_sides: 'AR', rear_window: 'LUN', panoramic_roof: 'TOIT',
  }
  return map[code] ?? code
}

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  requested: 'confirmed',
  confirmed: 'in_progress',
  in_progress: 'completed',
}

const MAX_DURATION = 150
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

/* ---------- period filter (month by default) ---------- */
type View = 'month' | 'week' | 'day'
const VIEWS: View[] = ['month', 'week', 'day']
const VIEW_LABEL: Record<View, string> = { month: 'Mois', week: 'Semaine', day: 'Jour' }

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayISO(): string {
  return isoOf(new Date())
}
function parseDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}
/** calendar arithmetic (DST-safe: works on y/m/d, not on milliseconds) */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function periodBounds(view: View, anchor: string): { start: Date; end: Date } {
  const a = parseDay(anchor)
  if (view === 'day') return { start: a, end: addDays(a, 1) }
  if (view === 'week') {
    const start = addDays(a, -((a.getDay() + 6) % 7)) // Monday
    return { start, end: addDays(start, 7) }
  }
  return { start: new Date(a.getFullYear(), a.getMonth(), 1), end: new Date(a.getFullYear(), a.getMonth() + 1, 1) }
}
function shiftAnchor(view: View, anchor: string, dir: -1 | 1): string {
  const a = parseDay(anchor)
  if (view === 'day') return isoOf(addDays(a, dir))
  if (view === 'week') return isoOf(addDays(a, 7 * dir))
  return isoOf(new Date(a.getFullYear(), a.getMonth() + dir, 1))
}
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayHeadFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function periodLabel(view: View, start: Date, end: Date): string {
  if (view === 'month') return capitalize(monthFmt.format(start))
  if (view === 'day') return capitalize(longDayFmt.format(start))
  return `${shortFmt.format(start)} – ${shortFmt.format(addDays(end, -1))} ${addDays(end, -1).getFullYear()}`
}

export default function QueuePage() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(todayISO())
  const [openBooking, setOpenBooking] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')

  const range = useMemo(() => {
    const { start, end } = periodBounds(view, anchor)
    return { start, end, from: start.toISOString(), to: end.toISOString() }
  }, [view, anchor])

  const queue = useQuery({
    queryKey: ['admin', 'queue', view, anchor],
    queryFn: () => getBookingsBetween(range.from, range.to),
    staleTime: 10_000,
  })

  useEffect(() => {
    return onBookingsChange(() => queryClient.invalidateQueries({ queryKey: ['admin'] }))
  }, [queryClient])

  const statusMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: BookingStatus }) => advanceStatus(id, to),
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const rows = useMemo(() => filterBookings(queue.data ?? [], filter), [queue.data, filter])
  const totalMinutes = rows.reduce((sum, q) => sum + q.durationMin, 0)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const today = todayISO()
  const todayInPeriod = parseDay(today) >= range.start && parseDay(today) < range.end
  const minutesOf = (iso: string) => {
    const d = new Date(iso)
    return d.getHours() * 60 + d.getMinutes()
  }
  // "MAINTENANT" marker only among today's rows
  const todayStarts = rows.filter((r) => isoOf(new Date(r.slotStart)) === today).map((r) => minutesOf(r.slotStart))
  // per-day totals for the group headers (week / month views)
  const dayTotals = useMemo(() => {
    const m = new Map<string, { count: number; minutes: number }>()
    for (const r of rows) {
      const k = isoOf(new Date(r.slotStart))
      const t = m.get(k) ?? { count: 0, minutes: 0 }
      t.count += 1
      t.minutes += r.durationMin
      m.set(k, t)
    }
    return m
  }, [rows])

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>File du jour</h1>
        <p className={styles.pageSub}>
          {periodLabel(view, range.start, range.end)} · ce qui rentre à l'atelier — variantes, zones, durées. Validez les demandes ici.
        </p>
      </div>

      <div className={styles.toolRow} style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 10 }}>
        <div role="group" aria-label="Période affichée" style={{ display: 'flex', gap: 6 }}>
          {VIEWS.map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 13, padding: '10px 14px', borderRadius: 11 }}
            aria-label="Période précédente"
            onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
          >
            ‹
          </button>
          {view === 'day' ? (
            <input
              className="field mono"
              type="date"
              value={anchor}
              onChange={(e) => e.target.value && setAnchor(e.target.value)}
              style={{ maxWidth: 190 }}
              aria-label="Jour affiché"
            />
          ) : view === 'month' ? (
            <input
              className="field mono"
              type="month"
              value={anchor.slice(0, 7)}
              onChange={(e) => e.target.value && setAnchor(`${e.target.value}-01`)}
              style={{ maxWidth: 190 }}
              aria-label="Mois affiché"
            />
          ) : (
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-soft)', padding: '0 6px', whiteSpace: 'nowrap' }}>
              {periodLabel(view, range.start, range.end)}
            </span>
          )}
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 13, padding: '10px 14px', borderRadius: 11 }}
            aria-label="Période suivante"
            onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}
          >
            ›
          </button>
        </div>
        {!todayInPeriod && (
          <button type="button" className="ghost" style={{ fontSize: 13, padding: '11px 16px', borderRadius: 11 }} onClick={() => setAnchor(todayISO())}>
            Aujourd'hui
          </button>
        )}
        <input
          className="field"
          type="search"
          placeholder="Filtrer : nom, téléphone, référence…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 300 }}
          aria-label="Filtrer les réservations de la période"
        />
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>{rows.length}</div>
          <div className={styles.statCardLabel}>véhicules planifiés</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>{formatDuration(totalMinutes)}</div>
          <div className={styles.statCardLabel}>de pose cumulée</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>{rows.filter((q) => q.status === 'in_progress').length}</div>
          <div className={styles.statCardLabel}>en pose maintenant</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`} style={{ color: 'var(--status-pending)' }}>
            {rows.filter((q) => q.status === 'requested').length}
          </div>
          <div className={styles.statCardLabel}>demandes à valider</div>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      <div className={styles.queueList}>
        {queue.isPending && (
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</span>
        )}
        {!queue.isPending && rows.length === 0 && (
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            {view === 'day' ? 'Aucune réservation ce jour.' : 'Aucune réservation sur cette période.'}
          </span>
        )}
        {rows.map((entry, i) => {
          const start = new Date(entry.slotStart)
          const entryDay = isoOf(start)
          const entryStart = minutesOf(entry.slotStart)
          const showNowLine =
            entryDay === today &&
            nowMinutes < entryStart &&
            !todayStarts.some((om) => om > nowMinutes && om < entryStart)
          const showDayHead = view !== 'day' && (i === 0 || isoOf(new Date(rows[i - 1].slotStart)) !== entryDay)
          const dayTotal = dayTotals.get(entryDay)
          const next = NEXT_STATUS[entry.status]
          return (
            <div key={entry.id}>
              {showDayHead && (
                <div
                  className="mono"
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 4px 6px',
                    fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: entryDay === today ? 'var(--octane-300)' : 'var(--text-dim)',
                    borderBottom: '1px solid var(--border-subtle)', marginBottom: 6,
                  }}
                >
                  <span>{dayHeadFmt.format(start)}{entryDay === today ? " · aujourd'hui" : ''}</span>
                  {dayTotal && (
                    <span style={{ color: 'var(--text-faint)' }}>
                      {dayTotal.count} véh. · {formatDuration(dayTotal.minutes)}
                    </span>
                  )}
                </div>
              )}
              {showNowLine && (
                <div className={styles.nowLine} aria-label="Maintenant">
                  <span className={`mono ${styles.nowLabel}`}>MAINTENANT</span>
                  <span className={styles.nowBar} />
                </div>
              )}
              <article className={styles.queueRow}>
                <div className={`mono ${styles.queueTime}`}>
                  <span className={styles.queueTimeStart}>{timeFmt.format(start)}</span>
                  <span className={styles.queueTimeEnd}>→ {timeFmt.format(new Date(entry.slotEnd))}</span>
                </div>
                <div className={styles.queueVehicle}>
                  <span className={`mono ${styles.queueBadge}`}>{entry.badge}</span>
                  <span>
                    <span className={`sat ${styles.queueVehicleName}`}>{entry.vehicleLabel}</span>
                    <span className={styles.queueOwner}>
                      {entry.contactName} · <span className="mono">{entry.contactPhone}</span>
                      {entry.forOther && (
                        <span className="chip" style={{ marginLeft: 8, fontSize: 11 }} title={`Réservé par ${entry.bookerName ?? 'profil'}`}>
                          pour un tiers · par {entry.bookerName?.split(' ')[0] ?? 'profil'}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
                <div className={styles.queueSpecs}>
                  {entry.specs.map((spec) => (
                    <span
                      key={spec.zone}
                      className={`chip ${!spec.isLegal ? '' : ['pare_brise', 'front_sides'].includes(spec.zone) ? 'chip--front' : 'chip--rear'}`}
                      style={!spec.isLegal ? { borderColor: 'rgba(248,113,113,.5)', color: 'var(--status-warning)' } : undefined}
                      title={!spec.isLegal ? 'Non conforme — ack client requis' : undefined}
                    >
                      {zoneShort(spec.zone)} {spec.vltPercent}%{!spec.isLegal && <Icon name="warning" size={11} />}
                    </span>
                  ))}
                </div>
                <div className={styles.queueDuration}>
                  <span className={`mono ${styles.queueDurationText}`}>{formatDuration(entry.durationMin)}</span>
                  <span className={styles.durationTrack}>
                    <span
                      className={styles.durationFill}
                      style={{ width: `${Math.min(100, (entry.durationMin / MAX_DURATION) * 100)}%` }}
                    />
                  </span>
                </div>
                <div className={styles.queueStatus}>
                  <StatusPill status={entry.status} />
                </div>
                <div className={styles.queueActions}>
                  {next && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={`Avancer le statut → ${next}`}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: entry.id, to: next })}
                    >
                      ▸
                    </button>
                  )}
                  <button type="button" className={styles.iconBtn} title="Ouvrir la fiche" onClick={() => setOpenBooking(entry.id)}>
                    ↗
                  </button>
                </div>
              </article>
            </div>
          )
        })}
      </div>

      {openBooking && <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />}
    </div>
  )
}
