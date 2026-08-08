import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_VEHICLE } from '../../data/mock'
import { bookingReference, dayLabel, getMonth } from './calendar'
import { formatDuration, type DraftAction, type DraftState, type useBookingDraft } from './useBookingDraft'
import styles from './booking.module.css'

type Quote = ReturnType<typeof useBookingDraft>['quote']

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  quote: Quote
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ConfirmStep({ state, dispatch, quote }: StepProps) {
  const month = getMonth(state.monthOffset)
  const day = state.selectedDate?.day ?? 1
  const reference = bookingReference(day, month.month, state.selectedSlot ?? '08:30')

  const rows: [string, string, boolean?][] = [
    ['Date', capitalize(dayLabel(month, day))],
    ['Heure', state.selectedSlot ?? '—'],
    ['Prestation', quote.lines.map((l) => l.zone.labelFr).join(', ')],
    ['Durée estimée', formatDuration(quote.minutes)],
    ['Total à régler', `${quote.total}€`, true],
  ]

  return (
    <section className={styles.stepConfirm}>
      <div className={styles.confirmInner}>
        <div className={styles.confirmBadge} aria-hidden>
          <span style={{ fontSize: 38 }}>✓</span>
        </div>
        <div className={`mono ${styles.confirmKicker}`}>Rendez-vous confirmé</div>
        <h1 className={`clash ${styles.h1}`}>On vous attend à l'atelier.</h1>
        <p className={styles.confirmLede}>
          Un récapitulatif vient de partir par e-mail. Présentez-vous 5 min avant — un café vous attend.
        </p>

        <div className={styles.confirmCard}>
          <div className={styles.confirmCardHead}>
            <span>
              <span className={`mono ${styles.confirmFieldLabel}`}>RÉFÉRENCE</span>
              <span className={`mono ${styles.confirmRef}`}>{reference}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className={`mono ${styles.confirmFieldLabel}`}>VÉHICULE</span>
              <span className={`sat ${styles.confirmVehicle}`}>
                {DEMO_VEHICLE.make} {DEMO_VEHICLE.generation} {DEMO_VEHICLE.model}
              </span>
            </span>
          </div>
          <div className={styles.confirmRows}>
            {rows.map(([label, value, highlight]) => (
              <div key={label} className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{label}</span>
                <span
                  className={highlight ? `mono ${styles.confirmRowTotal}` : styles.confirmRowValue}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.confirmActions}>
          <button
            type="button"
            className="cta"
            style={{ fontSize: 15, padding: '15px 26px', borderRadius: 13 }}
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
