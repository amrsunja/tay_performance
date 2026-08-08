import { ADMIN_CLIENTS } from '../../data/mock'
import styles from './admin.module.css'

export default function ClientsPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Clients</h1>
        <p className={styles.pageSub}>Contacts, véhicules rattachés et historique de passage.</p>
      </div>

      <div className={styles.toolRow}>
        <input className="field" style={{ maxWidth: 320 }} placeholder="Rechercher un client, un e-mail, une plaque…" />
        <button type="button" className="ghost" style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11 }}>
          + Ajouter un client
        </button>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th className={styles.thNum}>Véhicules</th>
              <th className={styles.thNum}>Réservations</th>
              <th>Dernière visite</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {ADMIN_CLIENTS.map((client) => (
              <tr key={client.id}>
                <td>
                  <span className={styles.avatarCell}>
                    <span className={styles.avatar} aria-hidden>
                      {client.fullName
                        .split(' ')
                        .map((p) => p[0])
                        .join('')}
                    </span>
                    <span className={styles.cellStrong}>{client.fullName}</span>
                  </span>
                </td>
                <td>
                  <span className={styles.cellStack}>
                    <span>{client.email}</span>
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                      {client.phone}
                    </span>
                  </span>
                </td>
                <td className={`mono ${styles.tdNum}`}>{client.vehicles}</td>
                <td className={`mono ${styles.tdNum}`}>{client.bookings}</td>
                <td className="mono" style={{ fontSize: 13 }}>
                  {client.lastVisit}
                </td>
                <td className={styles.tdActions}>
                  <button type="button" className={styles.iconBtn} title="Ouvrir la fiche">
                    ↗
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
