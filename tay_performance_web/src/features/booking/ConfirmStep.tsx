import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import type { ResolvedVehicle } from '../../types/api'
import { formatDuration, formatEuro, type DraftAction, type DraftState } from './useBookingDraft'
import styles from './booking.module.css'

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  vehicle: ResolvedVehicle
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
})
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ConfirmStep({ state, dispatch, vehicle }: StepProps) {
  const { isAnonymous } = useAuth()
  const booking = state.result

  if (!booking) return null

  const start = new Date(booking.slot_start)
  const rows: [string, string, boolean?][] = [
    ['Date', capitalize(dateFmt.format(start))],
    ['Heure', timeFmt.format(start)],
    ['Prestation', booking.specs.map((s) => s.label_fr).join(', ')],
    ['Durée estimée', formatDuration(booking.duration_min)],
    ['Total à régler', formatEuro(Number(booking.price_total)), true],
  ]

  return (
    <section className={styles.stepConfirm}>
      <div className={styles.confirmInner}>
        <div className={styles.confirmBadge} aria-hidden>
          <span style={{ fontSize: 38 }}>✓</span>
        </div>
        <div className={`mono ${styles.confirmKicker}`}>
          {booking.old_reference ? 'Rendez-vous reprogrammé' : 'Demande envoyée'}
        </div>
        <h1 className={`clash ${styles.h1}`}>Votre créneau est réservé.</h1>
        <p className={styles.confirmLede}>
          L'atelier confirme votre rendez-vous rapidement — vous recevrez un e-mail dès validation. Votre véhicule a
          été ajouté à votre garage.
          {booking.old_reference ? ` Votre ancienne réservation ${booking.old_reference} est annulée.` : ''}
        </p>

        <div className={styles.confirmCard}>
          <div className={styles.confirmCardHead}>
            <span>
              <span className={`mono ${styles.confirmFieldLabel}`}>RÉFÉRENCE</span>
              <span className={`mono ${styles.confirmRef}`}>{booking.reference}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className={`mono ${styles.confirmFieldLabel}`}>VÉHICULE</span>
              <span className={`sat ${styles.confirmVehicle}`}>
                {vehicle.make} {vehicle.generation} {vehicle.model}
              </span>
            </span>
          </div>
          <div className={styles.confirmRows}>
            {rows.map(([label, value, highlight]) => (
              <div key={label} className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{label}</span>
                <span className={highlight ? `mono ${styles.confirmRowTotal}` : styles.confirmRowValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* account securing — phone OTP, keeps the whole history (docs/03 §1.1 v2) */}
        {isAnonymous && (
          <div className={styles.confirmCard} style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 0 }}>
              <b>Retrouvez vos réservations sur tous vos appareils.</b> Liez votre numéro de téléphone — un simple
              code SMS, aucun mot de passe.
            </p>
            <Link
              to="/connexion"
              className="ghost"
              style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11, display: 'inline-block' }}
            >
              Sécuriser mon compte par SMS →
            </Link>
          </div>
        )}

        <div className={styles.confirmActions}>
          <Link to="/reservations" className="cta" style={{ fontSize: 15, padding: '15px 26px', borderRadius: 13 }}>
            Voir mes réservations
          </Link>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 15, fontWeight: 500, padding: '15px 26px', borderRadius: 13 }}
            onClick={() => dispatch({ type: 'restart' })}
          >
            Nouvelle réservation
          </button>
          <Link to="/" className="ghost" style={{ fontSize: 15, fontWeight: 500, padding: '15px 26px', borderRadius: 13 }}>
            Retour au site
          </Link>
        </div>
      </div>
    </section>
  )
}
