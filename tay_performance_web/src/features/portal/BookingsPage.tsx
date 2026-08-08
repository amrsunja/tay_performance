import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import StatusPill from '../../components/ui/StatusPill'
import { useReveal } from '../../hooks/useReveal'
import { CLIENT_BOOKINGS, TINT_ZONES } from '../../data/mock'
import type { Booking, BookingStatus } from '../../types/domain'
import { formatDuration } from '../booking/useBookingDraft'
import styles from './portal.module.css'

const TIMELINE: BookingStatus[] = ['requested', 'confirmed', 'in_progress', 'completed']
const TIMELINE_LABELS: Record<string, string> = {
  requested: 'Demandé',
  confirmed: 'Confirmé',
  in_progress: 'En pose',
  completed: 'Terminé',
}

function zoneLabel(code: string) {
  return TINT_ZONES.find((z) => z.code === code)?.labelFr ?? code
}

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
          <span className={`mono ${styles.timelineLabel}`} style={i === activeIndex ? { color: 'var(--text-soft)' } : undefined}>
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

function BookingCard({ booking, delay }: { booking: Booking; delay: number }) {
  return (
    <article className={styles.bookingCard} data-reveal data-delay={delay}>
      <div className={styles.bookingHead}>
        <div>
          <span className={`mono ${styles.bookingRef}`}>{booking.reference}</span>
          <h2 className={`sat ${styles.bookingTitle}`}>
            {booking.vehicle.make} {booking.vehicle.generation} {booking.vehicle.model}
          </h2>
          <div className={`mono ${styles.bookingWhen}`}>
            {booking.dateLabel} · {booking.timeLabel} · {formatDuration(booking.durationMin)}
          </div>
        </div>
        <div className={styles.bookingHeadRight}>
          <StatusPill status={booking.status} />
          <span className={`mono ${styles.bookingPrice}`}>{booking.priceTotal}€</span>
        </div>
      </div>

      {(booking.status === 'requested' || booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed') && (
        <Timeline status={booking.status} />
      )}

      <div className={styles.bookingSpecs}>
        {booking.specs.map((spec) => (
          <span key={spec.zone} className={`chip ${TINT_ZONES.find((z) => z.code === spec.zone)?.isFront ? 'chip--front' : 'chip--rear'}`}>
            {zoneLabel(spec.zone)} · {spec.vltPercent}%
          </span>
        ))}
        {booking.warrantyYears && (
          <span className="pill pill--success">
            <span aria-hidden>✓</span> Garantie {booking.warrantyYears} ans
          </span>
        )}
      </div>

      {booking.clientNotes && <p className={styles.bookingNotes}>« {booking.clientNotes} »</p>}

      {booking.photos && (
        <div className={styles.photoRow}>
          {booking.photos.map((photo) => (
            <figure key={photo.kind} className={styles.photo}>
              <img src={photo.src} alt={photo.kind === 'before' ? 'Avant la pose' : 'Après la pose'} />
              <figcaption className={`mono`}>{photo.kind === 'before' ? 'AVANT' : 'APRÈS'}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className={styles.bookingActions}>
        {(booking.status === 'requested' || booking.status === 'confirmed') && (
          <>
            <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }}>
              Reprogrammer
            </button>
            <button type="button" className={styles.dangerLink}>
              Annuler (≥24h avant)
            </button>
          </>
        )}
        {booking.status === 'completed' && (
          <Link to="/reserver" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }}>
            Re-réserver cette pose
          </Link>
        )}
      </div>
    </article>
  )
}

export default function BookingsPage() {
  useReveal()
  const upcoming = CLIENT_BOOKINGS.filter((b) => b.status === 'requested' || b.status === 'confirmed' || b.status === 'in_progress')
  const past = CLIENT_BOOKINGS.filter((b) => !upcoming.includes(b))

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

        <h2 className={`sat ${styles.groupTitle}`} data-reveal>
          À venir
        </h2>
        <div className={styles.bookingList}>
          {upcoming.map((booking, i) => (
            <BookingCard key={booking.id} booking={booking} delay={i * 90} />
          ))}
        </div>

        <h2 className={`sat ${styles.groupTitle}`} data-reveal>
          Historique
        </h2>
        <div className={styles.bookingList}>
          {past.map((booking, i) => (
            <BookingCard key={booking.id} booking={booking} delay={i * 90} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
