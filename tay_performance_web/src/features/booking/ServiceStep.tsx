import type { Dispatch } from 'react'
import baseFront from '../../assets/bmw_original_front.png'
import visuelCustom from '../../assets/visuel1.jpg'
import Icon from '../../components/ui/Icon'
import type { DraftAction } from './useBookingDraft'
import styles from './booking.module.css'

/** First step of the funnel: fixed-price tint, or a personalized request the workshop follows up by phone. */
export default function ServiceStep({ dispatch }: { dispatch: Dispatch<DraftAction> }) {
  return (
    <section className={styles.step}>
      <div className={styles.stepInnerNarrow}>
        <div>
          <div className={styles.kickerRow}>
            <span className={styles.kickerLine} />
            <span className={`mono ${styles.kicker}`}>Réserver · Votre prestation</span>
          </div>
          <h1 className={`clash ${styles.h1}`}>
            Que peut-on faire pour vous<span style={{ color: 'var(--accent-500)' }}>&nbsp;?</span>
          </h1>
          <p className={styles.lede}>
            Vitres teintées : prix et créneau en ligne, immédiatement. Autre chose : décrivez votre projet, l'atelier vous
            rappelle pour fixer la date et le prix avec vous.
          </p>
        </div>

        <div className={styles.serviceGrid}>
          <button type="button" className={styles.serviceCard} onClick={() => dispatch({ type: 'chooseService', service: 'tint' })}>
            <span className={styles.serviceArt}>
              <img src={baseFront} alt="" />
            </span>
            <span className={`sat ${styles.serviceTitle}`}>Vitres teintées</span>
            <span className={styles.serviceBody}>Choisissez vos vitres et votre teinte, voyez le prix, réservez votre créneau en 2 minutes.</span>
            <span className={`mono ${styles.serviceMeta}`}>
              Prix et créneau en ligne <Icon name="arrow-right" size={14} />
            </span>
          </button>

          <button type="button" className={styles.serviceCard} onClick={() => dispatch({ type: 'chooseService', service: 'custom' })}>
            <span className={styles.serviceArt}>
              <img src={visuelCustom} alt="" />
            </span>
            <span className={`sat ${styles.serviceTitle}`}>Autre prestation</span>
            <span className={styles.serviceBody}>Covering, sellerie, detailing, éclairage intérieur ou projet sur mesure.</span>
            <span className={`mono ${styles.serviceMeta}`}>
              Sur devis, l'atelier vous rappelle <Icon name="arrow-right" size={14} />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
