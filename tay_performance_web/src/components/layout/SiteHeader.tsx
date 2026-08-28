import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { useAuth } from '../../auth/AuthProvider'
import styles from './layout.module.css'

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/#process', label: 'Process' },
  { to: '/#galerie', label: 'Galerie' },
  { to: '/#conformite', label: 'Conformité' },
]

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" strokeLinecap="round" />
    </svg>
  )
}

export default function SiteHeader() {
  const { session, loading } = useAuth()

  return (
    <header className={styles.header}>
      <Link to="/" aria-label="Tay Performance — accueil">
        <img src={logo} alt="Tay Performance" className={styles.logo} />
      </Link>
      <nav className={styles.nav} aria-label="Navigation principale">
        {NAV.map((item) => (
          <a key={item.to} href={item.to} className="navlink" style={{ fontSize: 14 }}>
            {item.label}
          </a>
        ))}
        <NavLink to="/garage" className="navlink" style={{ fontSize: 14 }}>
          Mon Garage
        </NavLink>
        <Link to="/reserver" className="cta" style={{ fontSize: 14, padding: '11px 22px', borderRadius: 12 }}>
          Réserver
        </Link>
        {!loading &&
          (session ? (
            <Link
              to="/profil"
              aria-label="Mon profil"
              title="Mon profil"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-1)',
                color: 'var(--text-soft)',
              }}
            >
              <ProfileIcon />
            </Link>
          ) : (
            <Link to="/connexion" className="ghost" style={{ fontSize: 14, padding: '11px 20px', borderRadius: 12 }}>
              Se connecter
            </Link>
          ))}
      </nav>
    </header>
  )
}
