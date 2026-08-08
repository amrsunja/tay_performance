import { BLACKOUT_DATES, WORKSHOP_WEEK } from '../../data/mock'
import styles from './admin.module.css'

export default function ConfigPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Configuration atelier</h1>
        <p className={styles.pageSub}>Horaires, granularité des créneaux, baies et jours bloqués.</p>
      </div>

      <div className={styles.twoCol}>
        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Horaires d'ouverture</h2>
          </div>
          <div className={styles.configCard}>
            {WORKSHOP_WEEK.map((day) => (
              <div key={day.weekday} className={styles.dayRow}>
                <label className={styles.daySwitch}>
                  <input type="checkbox" defaultChecked={day.open} aria-label={`${day.labelFr} ouvert`} />
                  <span className={styles.switchTrack} aria-hidden>
                    <span className={styles.switchThumb} />
                  </span>
                  <span className={styles.dayName}>{day.labelFr}</span>
                </label>
                {day.open ? (
                  <span className={`mono ${styles.dayHours}`}>
                    <input className={`field mono ${styles.timeField}`} defaultValue={day.openTime} aria-label={`${day.labelFr} ouverture`} />
                    →
                    <input className={`field mono ${styles.timeField}`} defaultValue={day.closeTime} aria-label={`${day.labelFr} fermeture`} />
                  </span>
                ) : (
                  <span className={`mono ${styles.dayClosed}`}>Fermé</span>
                )}
              </div>
            ))}
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Créneaux & capacité</h2>
          </div>
          <div className={styles.configCard}>
            <div className={styles.configRow}>
              <span>Granularité des créneaux</span>
              <select className={`field mono ${styles.selectField}`} defaultValue="30" aria-label="Granularité">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
            <div className={styles.configRow}>
              <span>Nombre de baies en parallèle</span>
              <select className={`field mono ${styles.selectField}`} defaultValue="1" aria-label="Baies">
                <option value="1">1 baie</option>
                <option value="2">2 baies</option>
                <option value="3">3 baies</option>
              </select>
            </div>
            <div className={styles.configRow}>
              <span>Fenêtre d'annulation client</span>
              <select className={`field mono ${styles.selectField}`} defaultValue="24" aria-label="Fenêtre annulation">
                <option value="12">≥12h avant</option>
                <option value="24">≥24h avant</option>
                <option value="48">≥48h avant</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Jours bloqués</h2>
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }}>
              + Bloquer une date
            </button>
          </div>
          <div className={styles.configCard}>
            {BLACKOUT_DATES.map((blackout) => (
              <div key={blackout.id} className={styles.blackoutRow}>
                <span className={`mono ${styles.blackoutDate}`}>{blackout.date}</span>
                <span className={styles.blackoutReason}>{blackout.reason}</span>
                <button type="button" className={styles.iconBtn} title="Débloquer">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Notifications</h2>
          </div>
          <div className={styles.configCard}>
            <div className={styles.configRow}>
              <span>E-mail de confirmation client</span>
              <span className="pill pill--success">
                <span aria-hidden>✓</span> Actif
              </span>
            </div>
            <div className={styles.configRow}>
              <span>Rappel J-1</span>
              <span className="pill pill--success">
                <span aria-hidden>✓</span> Actif
              </span>
            </div>
            <div className={styles.configRow}>
              <span>SMS (passerelle)</span>
              <span className="pill pill--muted">
                <span aria-hidden>—</span> V2
              </span>
            </div>
          </div>

          <div className={styles.saveRow}>
            <button type="button" className="cta" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }}>
              Enregistrer la configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
