import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import logo from '../../assets/logo.svg'
import { useAuth } from '../../auth/AuthProvider'
import { getCatalog } from '../../api/catalog'
import NewBookingModal from './NewBookingModal'
import styles from './admin.module.css'

const NAV = [
  { to: '/admin', label: 'File du jour', icon: '▤', end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: '▦' },
  { to: '/admin/clients', label: 'Clients', icon: '◉' },
  { to: '/admin/vehicules', label: 'Véhicules', icon: '⬡' },
  { to: '/admin/tarifs', label: 'Tarifs', icon: '€' },
  { to: '/admin/config', label: 'Config', icon: '⚙' },
]

function todayLabel() {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(),
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [creating, setCreating] = useState(false)
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  const bayCount = catalog.data?.settings.bayCount ?? 1

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.sidebarLogo} aria-label="Retour au site">
          <img src={logo} alt="Tay Performance" />
        </Link>
        <div className={`mono ${styles.sidebarTag}`}>ADMIN · ATELIER</div>
        <nav className={styles.sidebarNav} aria-label="Navigation admin">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon} aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <span className={`mono ${styles.sidebarFootLine}`}>
            {bayCount > 1 ? `${bayCount} baies` : 'Baie 1'} · Illkirch 67400
          </span>
          <button
            type="button"
            className={`mono ${styles.sidebarFootLine}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'var(--text-faint)' }}
            onClick={async () => {
              await signOut()
              navigate('/admin/login', { replace: true })
            }}
          >
            ↩ Déconnexion
          </button>
        </div>
      </aside>

      <div className={styles.mainCol}>
        <header className={styles.topbar}>
          <div className={styles.topbarDate}>
            <span className={styles.topbarDot} aria-hidden />
            <span className={`mono ${styles.topbarDateText}`}>{todayLabel()}</span>
          </div>
          <div className={styles.topbarRight}>
            <label className={`mono ${styles.baySelect}`}>
              BAIE
              <select className={styles.baySelectField} defaultValue="1" aria-label="Sélection de la baie">
                {Array.from({ length: bayCount }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Baie {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="cta"
              style={{ fontSize: 13, padding: '10px 18px', borderRadius: 11 }}
              onClick={() => setCreating(true)}
            >
              + Nouvelle réservation
            </button>
          </div>
        </header>
        <main className={styles.workspace}>
          <Outlet />
        </main>
      </div>

      {creating && <NewBookingModal onClose={() => setCreating(false)} />}
    </div>
  )
}
