import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import styles from './layout.module.css'

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/#process', label: 'Process' },
  { to: '/#galerie', label: 'Galerie' },
  { to: '/#conformite', label: 'Conformité' },
]

export default function SiteHeader() {
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
      </nav>
    </header>
  )
}
