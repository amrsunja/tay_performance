import { PRICING_RULES, TINT_ZONES, VLT_STOPS } from '../../data/mock'
import styles from './admin.module.css'

/* zone × VLT delta matrix (mock, admin-editable later) */
function zoneDelta(basePrice: number, vlt: number): number {
  return Math.round(basePrice * (vlt <= 20 ? 1.2 : 1) )
}

export default function PricingPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Matrice tarifaire</h1>
        <p className={styles.pageSub}>
          <span className="mono">total = base(carrosserie) + Σ delta(zone, VLT) + minutes × taux</span> — modifiable
          sans déploiement.
        </p>
      </div>

      <div className={styles.blockHead}>
        <h2 className={`sat ${styles.blockTitle}`}>Base par carrosserie</h2>
        <span className={`mono ${styles.blockHint}`}>EUR · versionné (valid_from)</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Carrosserie</th>
              <th>Classe</th>
              <th className={styles.thNum}>Facteur vitrage</th>
              <th className={styles.thNum}>Base (€)</th>
              <th className={styles.thNum}>Taux main d'œuvre (€/min)</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_RULES.map((rule) => (
              <tr key={rule.bodyStyle}>
                <td className={styles.cellStrong}>{rule.labelFr}</td>
                <td>
                  <span className="chip">{rule.sizeClass}</span>
                </td>
                <td className={`mono ${styles.tdNum}`}>×{rule.glassFactor.toFixed(2)}</td>
                <td className={styles.tdNum}>
                  <input className={`field mono ${styles.priceField}`} defaultValue={rule.basePrice} aria-label={`Base ${rule.labelFr}`} />
                </td>
                <td className={styles.tdNum}>
                  <input className={`field mono ${styles.priceField}`} defaultValue={rule.laborRatePerMin.toFixed(2)} aria-label={`Taux ${rule.labelFr}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.blockHead} style={{ marginTop: 32 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Delta par zone × VLT</h2>
        <span className={`mono ${styles.blockHint}`}>≤20% = film limousine (+20%)</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Zone</th>
              {VLT_STOPS.map((vlt) => (
                <th key={vlt} className={styles.thNum}>
                  <span className="mono">{vlt}%</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TINT_ZONES.map((zone) => (
              <tr key={zone.code}>
                <td>
                  <span className={styles.cellStack}>
                    <span className={styles.cellStrong}>{zone.labelFr}</span>
                    <span className={`chip ${zone.group === 'avant' ? 'chip--front' : 'chip--rear'}`} style={{ alignSelf: 'flex-start' }}>
                      {zone.group === 'avant' ? 'AVANT' : zone.group === 'arriere' ? 'ARRIÈRE' : 'OPTION'}
                    </span>
                  </span>
                </td>
                {VLT_STOPS.map((vlt) => {
                  const illegal = zone.isFront && vlt < 70
                  return (
                    <td key={vlt} className={`mono ${styles.tdNum}`}>
                      {illegal ? (
                        <span className={styles.illegalCell} title="Interdit à l'avant (<70% VLT)">
                          {zoneDelta(zone.price, vlt)}€ ⚠
                        </span>
                      ) : (
                        <span>{zoneDelta(zone.price, vlt)}€</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.saveRow}>
        <span className={`mono ${styles.blockHint}`}>Dernière révision : 22/06/2026 · admin</span>
        <button type="button" className="cta" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }}>
          Publier la nouvelle grille
        </button>
      </div>
    </div>
  )
}
