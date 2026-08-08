import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import logo from '../../assets/logo.svg'
import { useReveal } from '../../hooks/useReveal'
import { useBookingDraft, type BookingStep } from './useBookingDraft'
import ConfigStep from './ConfigStep'
import CalendarStep from './CalendarStep'
import ConfirmStep from './ConfirmStep'
import styles from './booking.module.css'

const STEP_ORDER: BookingStep[] = ['config', 'calendar', 'confirm']
const STEP_LABELS: Record<BookingStep, string> = {
  config: 'Configuration',
  calendar: 'Créneau',
  confirm: 'Confirmé',
}

export default function BookingPage() {
  const { state, dispatch, quote } = useBookingDraft()
  useReveal([state.step])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [state.step])

  const stepIndex = STEP_ORDER.indexOf(state.step)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label="Retour à l'accueil">
          <img src={logo} alt="Tay Performance" className={styles.logo} />
        </Link>
        <div className={styles.headerRight}>
          <div className={styles.stepper} aria-label="Progression de la réservation">
            {STEP_ORDER.map((step, i) => (
              <span key={step} className={styles.stepperItem}>
                <span
                  className={[
                    styles.stepDot,
                    i === stepIndex ? styles.stepDotActive : '',
                    i < stepIndex ? styles.stepDotDone : '',
                  ].join(' ')}
                />
                <span className={`mono ${styles.stepLabel}`} style={i === stepIndex ? { color: 'var(--text-dim)' } : undefined}>
                  {STEP_LABELS[step]}
                </span>
                {i < STEP_ORDER.length - 1 && <span className={styles.stepLink} />}
              </span>
            ))}
          </div>
          <a href="tel:0605505028" className="navlink" style={{ fontSize: 14 }}>
            06 05 50 50 28
          </a>
        </div>
      </header>

      {state.step === 'config' && <ConfigStep state={state} dispatch={dispatch} quote={quote} />}
      {state.step === 'calendar' && <CalendarStep state={state} dispatch={dispatch} quote={quote} />}
      {state.step === 'confirm' && <ConfirmStep state={state} dispatch={dispatch} quote={quote} />}

      <footer className={styles.footer}>
        <span className="mono">© 2026 Tay Performance · 19 Rue de l'industrie, 67400 Illkirch-Graffenstaden</span>
        <span className="mono">Conforme réglementation vitres teintées · France 2026</span>
      </footer>
    </div>
  )
}
