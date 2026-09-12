/* Post-booking developer card — shown once per browser after a successful reservation.
   Static: no backend; the CTA deep-links to the developer's portfolio contact form. */
import { useState } from 'react'
import { DEVELOPER, portfolioUrl } from '../../lib/site'
import styles from './DevCard.module.css'

const STORAGE_KEY = 'tp.devcard.dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function DevCard() {
  const [hidden, setHidden] = useState(readDismissed)
  if (hidden) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* private mode — ignore */
    }
    setHidden(true)
  }

  return (
    <aside className={styles.card} aria-label="Développeur du site">
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Fermer">
        ×
      </button>
      <div className={styles.row}>
        <span className={`mono ${styles.tag}`}>&lt;/&gt;</span>
        <div className={styles.body}>
          <p className={styles.title}>
            Vous avez un garage, un atelier ou un commerce&nbsp;?
          </p>
          <p className={styles.text}>
            Ce système de réservation (configurateur, créneaux temps réel, espace client, panneau admin) a été conçu
            et développé par <b>{DEVELOPER.name}</b>. Le même outil, adapté à votre activité, est à portée d'un message.
          </p>
          <div className={styles.actions}>
            <a
              href={portfolioUrl('booking-confirm', true)}
              target="_blank"
              rel="noreferrer"
              className={`ghost ${styles.cta}`}
              onClick={dismiss}
            >
              Me contacter →
            </a>
            <a href={portfolioUrl('booking-confirm')} target="_blank" rel="noreferrer" className={`navlink ${styles.link}`}>
              Voir le portfolio
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
