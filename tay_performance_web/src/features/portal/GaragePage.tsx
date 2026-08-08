import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import { useReveal } from '../../hooks/useReveal'
import { GARAGE_VEHICLES } from '../../data/mock'
import styles from './portal.module.css'

export default function GaragePage() {
  useReveal()

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head} data-reveal>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Espace client · Mon Garage</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Vos véhicules<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
            <p className={styles.lede}>
              Vos variantes sont déjà résolues — réservez une nouvelle pose en un geste.
            </p>
          </div>
          <div className={styles.tabs}>
            <Link to="/garage" className={`${styles.tab} ${styles.tabActive}`} aria-current="page">
              Mon Garage
            </Link>
            <Link to="/reservations" className={styles.tab}>
              Mes réservations
            </Link>
          </div>
        </div>

        <div className={styles.vehicleGrid}>
          {GARAGE_VEHICLES.map((vehicle, i) => (
            <article key={vehicle.id} className={styles.vehicleCard} data-reveal data-delay={i * 90}>
              <div className={styles.vehicleTop}>
                <span className={`mono ${styles.vehicleBadge}`}>{vehicle.badge}</span>
                <span className={`chip`}>{vehicle.nickname}</span>
              </div>
              <h2 className={`sat ${styles.vehicleTitle}`}>
                {vehicle.make} {vehicle.generation} {vehicle.model}
              </h2>
              <div className={`mono ${styles.vehicleSub}`}>
                {vehicle.bodyLabel} · {vehicle.years}
              </div>
              <dl className={styles.vehicleSpecs}>
                <div>
                  <dt>Année</dt>
                  <dd className="mono">{vehicle.year}</dd>
                </div>
                <div>
                  <dt>Immat.</dt>
                  <dd className="mono">{vehicle.plate}</dd>
                </div>
                <div>
                  <dt>Teinte</dt>
                  <dd>{vehicle.color}</dd>
                </div>
              </dl>
              <div className={styles.vehicleActions}>
                <Link to="/reserver" className="cta" style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12 }}>
                  Réserver une pose →
                </Link>
                <button type="button" className="ghost" style={{ fontSize: 14, padding: '12px 18px', borderRadius: 12 }}>
                  Modifier
                </button>
              </div>
            </article>
          ))}

          {/* ghosted add-vehicle card (quiet, premium empty-state) */}
          <button type="button" className={styles.addCard} data-reveal data-delay={GARAGE_VEHICLES.length * 90}>
            <span className={styles.addGhostCar} aria-hidden>
              <svg viewBox="0 0 380 180" width="150">
                <path
                  d="M28 122 Q24 96 52 92 L96 92 L120 56 Q128 44 146 44 L246 44 Q266 44 276 60 L300 92 L340 96 Q360 100 356 122 L356 134 L28 134 Z"
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="2"
                  strokeDasharray="6 7"
                />
                <circle cx="92" cy="132" r="17" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 5" />
                <circle cx="300" cy="132" r="17" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 5" />
              </svg>
            </span>
            <span className={`sat ${styles.addTitle}`}>Ajouter un véhicule</span>
            <span className={styles.addSub}>Marque → modèle → génération → carrosserie</span>
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
