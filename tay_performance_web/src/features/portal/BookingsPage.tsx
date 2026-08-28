import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import StatusPill from '../../components/ui/StatusPill'
import { useReveal } from '../../hooks/useReveal'
import { useAuth } from '../../auth/AuthProvider'
import { cancelBooking, getMyBookings, photoUrl } from '../../api/bookings'
import { getCatalog } from '../../api/catalog'
import { errorMessage, supabase } from '../../lib/supabase'
import type { MyBookingRow } from '../../types/api'
import type { BookingStatus } from '../../types/domain'
import { formatDuration, formatEuro } from '../booking/useBookingDraft'
import styles from './portal.module.css'

const TIMELINE: BookingStatus[] = ['requested', 'confirmed', 'in_progress', 'completed']
const TIMELINE_LABELS: Record<string, string> = {
  requested: 'Demandé',
  confirmed: 'Confirmé',
  in_progress: 'En pose',
  completed: 'Terminé',
}

const ZONE_LABELS: Record<string, string> = {
  pare_brise: 'Pare-brise',
  front_sides: 'Vitres avant latérales',
  rear_sides: 'Vitres arrière latérales',
  rear_window: 'Lunette arrière',
  panoramic_roof: 'Toit panoramique',
}

const FRONT_ZONES = ['pare_brise', 'front_sides']

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
})
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

function Timeline({ status }: { status: BookingStatus }) {
  const activeIndex = TIMELINE.indexOf(status)
  if (activeIndex === -1) return null
  return (
    <div className={styles.timeline}>
      {TIMELINE.map((step, i) => (
        <div key={step} className={styles.timelineStep}>
          <span
            className={[
              styles.timelineDot,
              i < activeIndex ? styles.timelineDotDone : '',
              i === activeIndex ? styles.timelineDotActive : '',
            ].join(' ')}
          />
          <span
            className={`mono ${styles.timelineLabel}`}
            style={i === activeIndex ? { color: 'var(--text-soft)' } : undefined}
          >
            {TIMELINE_LABELS[step]}
          </span>
          {i < TIMELINE.length - 1 && (
            <span className={`${styles.timelineBar} ${i < activeIndex ? styles.timelineBarDone : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function BookingPhoto({ path, kind }: { path: string; kind: 'before' | 'after' }) {
  const url = useQuery({ queryKey: ['photo-url', path], queryFn: () => photoUrl(path), staleTime: 45 * 60_000 })
  if (!url.data) return null
  return (
    <figure className={styles.photo}>
      <img src={url.data} alt={kind === 'before' ? 'Avant la pose' : 'Après la pose'} />
      <figcaption className="mono">{kind === 'before' ? 'AVANT' : 'APRÈS'}</figcaption>
    </figure>
  )
}

function BookingCard({
  booking,
  delay,
  cutoffHours,
  onCancel,
  cancelPending,
}: {
  booking: MyBookingRow
  delay: number
  cutoffHours: number
  onCancel: (id: string) => void
  cancelPending: boolean
}) {
  const navigate = useNavigate()
  const start = new Date(booking.slotStart)
  const cancellable =
    (booking.status === 'requested' || booking.status === 'confirmed') &&
    Date.now() < start.getTime() - cutoffHours * 3600_000

  return (
    <article className={styles.bookingCard} data-reveal data-delay={delay}>
      <div className={styles.bookingHead}>
        <div>
          <span className={`mono ${styles.bookingRef}`}>{booking.reference}</span>
          <h2 className={`sat ${styles.bookingTitle}`}>{booking.vehicleLabel}</h2>
          {booking.forOther && (
            <span className="chip" style={{ fontSize: 11, marginBottom: 6, display: 'inline-block' }}>
              Pour {booking.contactName}
            </span>
          )}
          <div className={`mono ${styles.bookingWhen}`}>
            {dateFmt.format(start)} · {timeFmt.format(start)} · {formatDuration(booking.durationMin)}
          </div>
        </div>
        <div className={styles.bookingHeadRight}>
          <StatusPill status={booking.status} />
          <span className={`mono ${styles.bookingPrice}`}>{formatEuro(booking.priceTotal)}</span>
        </div>
      </div>

      {TIMELINE.includes(booking.status) && <Timeline status={booking.status} />}

      <div className={styles.bookingSpecs}>
        {booking.specs.map((spec) => (
          <span
            key={spec.zone}
            className={`chip ${FRONT_ZONES.includes(spec.zone) ? 'chip--front' : 'chip--rear'}`}
          >
            {ZONE_LABELS[spec.zone] ?? spec.zone} · {spec.vltPercent}%
          </span>
        ))}
        {booking.warrantyYears && (
          <span className="pill pill--success">
            <span aria-hidden>✓</span> Garantie {booking.warrantyYears} ans
          </span>
        )}
      </div>

      {booking.clientNotes && <p className={styles.bookingNotes}>« {booking.clientNotes} »</p>}

      {booking.photos.length > 0 && (
        <div className={styles.photoRow}>
          {booking.photos.map((photo) => (
            <BookingPhoto key={photo.path} path={photo.path} kind={photo.kind} />
          ))}
        </div>
      )}

      <div className={styles.bookingActions}>
        {(booking.status === 'requested' || booking.status === 'confirmed') && (
          <>
            <button
              type="button"
              className="ghost"
              style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }}
              onClick={() => navigate(`/reserver?reschedule=${booking.id}`)}
            >
              Reprogrammer
            </button>
            <button
              type="button"
              className={styles.dangerLink}
              disabled={!cancellable || cancelPending}
              title={cancellable ? undefined : `Annulation possible jusqu'à ${cutoffHours}h avant`}
              onClick={() => onCancel(booking.id)}
            >
              Annuler (≥{cutoffHours}h avant)
            </button>
          </>
        )}
        {booking.status === 'completed' && (
          <Link
            to={`/reserver?variant=${booking.variantId}`}
            className="ghost"
            style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }}
          >
            Re-réserver cette pose
          </Link>
        )}
      </div>
    </article>
  )
}

export default function BookingsPage() {
  useReveal()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const bookings = useQuery({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    enabled: Boolean(session),
  })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  const cutoffHours = catalog.data?.settings.cancellationCutoffHours ?? 24

  // realtime: own booking rows (RLS-scoped) → refresh statuses live
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('my-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, queryClient])

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const onCancel = (id: string) => {
    if (window.confirm('Annuler ce rendez-vous ?')) cancelMutation.mutate(id)
  }

  const list = bookings.data ?? []
  const upcoming = list.filter((b) => b.status === 'requested' || b.status === 'confirmed' || b.status === 'in_progress')
  const past = list.filter((b) => !upcoming.includes(b))

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head} data-reveal>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Espace client · Mes réservations</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Vos rendez-vous<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
          </div>
          <div className={styles.tabs}>
            <Link to="/garage" className={styles.tab}>
              Mon Garage
            </Link>
            <Link to="/reservations" className={`${styles.tab} ${styles.tabActive}`} aria-current="page">
              Mes réservations
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--status-warning)', fontSize: 14, marginBottom: 16 }} role="alert">
            {error}
          </div>
        )}

        {list.length === 0 && !bookings.isPending && (
          <div
            data-reveal
            style={{
              padding: 24,
              borderRadius: 16,
              border: '1px dashed var(--border-strong)',
              background: 'var(--surface-inset)',
              display: 'grid',
              gap: 12,
              maxWidth: 560,
            }}
          >
            <span style={{ color: 'var(--text-soft)', fontSize: 15 }}>
              Aucune réservation sur cet appareil.
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Vous avez déjà réservé sur un autre appareil ? Connectez-vous avec votre numéro — code par SMS, sans
              mot de passe.
            </span>
            <Link
              to="/connexion"
              className="ghost"
              style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11, justifySelf: 'start' }}
            >
              Se connecter par SMS →
            </Link>
            <Link to="/reserver" className="cta" style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12, justifySelf: 'start' }}>
              Réserver une pose →
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 className={`sat ${styles.groupTitle}`} data-reveal>
              À venir
            </h2>
            <div className={styles.bookingList}>
              {upcoming.map((booking, i) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  delay={i * 90}
                  cutoffHours={cutoffHours}
                  onCancel={onCancel}
                  cancelPending={cancelMutation.isPending}
                />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className={`sat ${styles.groupTitle}`} data-reveal>
              Historique
            </h2>
            <div className={styles.bookingList}>
              {past.map((booking, i) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  delay={i * 90}
                  cutoffHours={cutoffHours}
                  onCancel={onCancel}
                  cancelPending={cancelMutation.isPending}
                />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
