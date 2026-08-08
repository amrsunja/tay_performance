import { VEHICLE_REQUESTS } from '../../data/mock'
import styles from './admin.module.css'

const MAKES = [
  { name: 'Audi', models: 6 },
  { name: 'BMW', models: 9 },
  { name: 'Mercedes', models: 7 },
  { name: 'Mini', models: 3 },
  { name: 'Peugeot', models: 5 },
  { name: 'Renault', models: 5 },
  { name: 'Tesla', models: 4 },
  { name: 'Volkswagen', models: 6 },
]

const VARIANTS = [
  { gen: 'BMW Série 3 · G20 (2019–)', body: 'Berline 4p', labor: 120, active: true },
  { gen: 'BMW M3 · F30 (2014–2018)', body: 'Berline 4p', labor: 120, active: true },
  { gen: 'BMW X5 · G05 (2018–)', body: 'SUV 5p', labor: 180, active: true },
  { gen: 'Tesla Model Y · Juniper (2025–)', body: 'SUV 5p', labor: 170, active: true },
  { gen: 'Mini Cooper S · F56 (2014–2024)', body: 'Citadine 3p', labor: 90, active: true },
  { gen: 'Audi RS3 · 8Y (2021–)', body: 'Berline 4p', labor: 125, active: false },
]

export default function VehiclesPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Taxonomie véhicules</h1>
        <p className={styles.pageSub}>
          Marque → modèle → génération → carrosserie. La feuille <span className="mono">variant</span> pilote prix et
          durée.
        </p>
      </div>

      <div className={styles.twoCol}>
        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Marques</h2>
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }}>
              + Marque
            </button>
          </div>
          <div className={styles.makeGrid}>
            {MAKES.map((make) => (
              <button key={make.name} type="button" className={styles.makeCard}>
                <span className={`sat ${styles.makeName}`}>{make.name}</span>
                <span className={`mono ${styles.makeCount}`}>{make.models} modèles</span>
              </button>
            ))}
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Demandes « je ne trouve pas mon véhicule »</h2>
          </div>
          <div className={styles.leadList}>
            {VEHICLE_REQUESTS.map((lead) => (
              <div key={lead.id} className={styles.leadCard}>
                <div>
                  <div className={styles.cellStrong}>{lead.rawText}</div>
                  <div className={`mono ${styles.leadMeta}`}>
                    {lead.requestedBy} · {lead.createdAt}
                  </div>
                </div>
                {lead.status === 'new' ? (
                  <span className="pill pill--pending">
                    <span aria-hidden>◔</span> À résoudre
                  </span>
                ) : (
                  <span className="pill pill--success">
                    <span aria-hidden>✓</span> Résolu
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Variantes récentes</h2>
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }}>
              + Variante
            </button>
          </div>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Génération</th>
                  <th>Carrosserie</th>
                  <th className={styles.thNum}>Pose (min)</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {VARIANTS.map((v) => (
                  <tr key={v.gen}>
                    <td className={styles.cellStrong}>{v.gen}</td>
                    <td>
                      <span className="chip">{v.body}</span>
                    </td>
                    <td className={`mono ${styles.tdNum}`}>{v.labor}</td>
                    <td>
                      {v.active ? (
                        <span className="pill pill--success">
                          <span aria-hidden>✓</span> Actif
                        </span>
                      ) : (
                        <span className="pill pill--muted">
                          <span aria-hidden>—</span> Masqué
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
