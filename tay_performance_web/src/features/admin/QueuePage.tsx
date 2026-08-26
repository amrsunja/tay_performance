import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusPill from '../../components/ui/StatusPill'
import { advanceStatus, getBookingsBetween, onBookingsChange } from '../../api/admin'
import { errorMessage } from '../../lib/supabase'
import type { BookingStatus } from '../../types/domain'
import { formatDuration } from '../booking/useBookingDraft'
import BookingDrawer from './BookingDrawer'
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

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function QueuePage() {
  const queryClient = useQueryClient()
  const [day, setDay] = useState(todayISO())
  const [openBooking, setOpenBooking] = useState<string | null>(null)
  const [error, setError] = useState('')

  const range = useMemo(() => {
    const start = new Date(`${day}T00:00:00`)
    const end = new Date(start.getTime() + 24 * 3600_000)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [day])

  const queue = useQuery({
    queryKey: ['admin', 'queue', day],
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

  const rows = queue.data ?? []
  const totalMinutes = rows.reduce((sum, q) => sum + q.durationMin, 0)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const isToday = day === todayISO()

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>File du jour</h1>
        <p className={styles.pageSub}>Ce qui rentre à l'atelier — variantes, zones, durées. Validez les demandes ici.</p>
      </div>

      <div className={styles.toolRow}>
        <input
          className="field mono"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          style={{ maxWidth: 190 }}
          aria-label="Jour affiché"
        />
        {!isToday && (
          <button type="button" className="ghost" style={{ fontSize: 13, padding: '11px 16px', borderRadius: 11 }} onClick={() => setDay(todayISO())}>
            Aujourd'hui
          </button>
        )}
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
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>Aucune réservation ce jour.</span>
        )}
        {rows.map((entry) => {
          const start = new Date(entry.slotStart)
          const entryStart = start.getHours() * 60 + start.getMinutes()
          const showNowLine =
            isToday &&
            nowMinutes < entryStart &&
            !rows.some((other) => {
              const os = new Date(other.slotStart)
              const om = os.getHours() * 60 + os.getMinutes()
              return om > nowMinutes && om < entryStart
            })
          const next = NEXT_STATUS[entry.status]
          return (
            <div key={entry.id}>
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
                      {zoneShort(spec.zone)} {spec.vltPercent}%{!spec.isLegal && ' ⚠'}
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
