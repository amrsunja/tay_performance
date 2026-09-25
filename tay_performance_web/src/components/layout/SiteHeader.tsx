/* Site header — desktop: inline nav; mobile (≤900px): burger menu + always-visible
   profile icon (or "Se connecter") on the right of the bar. */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { useAuth } from '../../auth/AuthProvider'
import Icon from '../ui/Icon'
import styles from './layout.module.css'

const NAV = [
  { to: '/#services', label: 'Prestations' },
  { to: '/#process', label: 'Comment ça se passe' },
  { to: '/#avis', label: 'Avis' },
  { to: '/#galerie', label: 'Réalisations' },
  { to: '/#faq', label: 'FAQ' },
]

function ProfileIcon() {
  return <Icon name="user" size={20} />
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <span className={`${styles.burger} ${open ? styles.burgerOpen : ''}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

export default function SiteHeader() {
  const { session, loading, isAdmin } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // close the drawer on navigation, on Escape, and lock body scroll while open
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const account = !loading && (
    session ? (
      <Link to="/profil" aria-label="Mon profil" title="Mon profil" className={styles.profileBtn}>
        <ProfileIcon />
      </Link>
    ) : (
      <>
        <Link to="/connexion" className={`ghost ${styles.signIn}`} style={{ fontSize: 14, padding: '11px 20px', borderRadius: 12 }}>
          Se connecter
        </Link>
        <Link to="/connexion" aria-label="Se connecter" title="Se connecter" className={`${styles.profileBtn} ${styles.profileBtnMobile}`}>
          <ProfileIcon />
        </Link>
      </>
    )
  )

  // admin shortcut — UX only, RequireAdmin + RLS still guard /admin
  const admin = !loading && session && isAdmin && (
    <>
      <Link
        to="/admin"
        className={`ghost ${styles.adminBtn}`}
        style={{ fontSize: 14, padding: '11px 18px', borderRadius: 12 }}
      >
        <Icon name="settings" size={16} /> Admin
      </Link>
      <Link
        to="/admin"
        aria-label="Panneau admin"
        title="Panneau admin"
        className={`${styles.profileBtn} ${styles.profileBtnMobile} ${styles.adminIconBtn}`}
      >
        <Icon name="settings" size={19} />
      </Link>
    </>
  )

  const links = (
    <>
      {NAV.map((item) => (
        <a key={item.to} href={item.to} className="navlink" style={{ fontSize: 14 }} onClick={() => setOpen(false)}>
          {item.label}
        </a>
      ))}
      <NavLink to="/adresse" className="navlink" style={{ fontSize: 14 }}>
        Adresse
      </NavLink>
      <NavLink to="/garage" className="navlink" style={{ fontSize: 14 }}>
        Mon Garage
      </NavLink>
      <NavLink to="/reservations" className={`navlink ${styles.mobileOnly}`} style={{ fontSize: 14 }}>
        Mes réservations
      </NavLink>
      <Link to="/reserver" className="cta" style={{ fontSize: 14, padding: '11px 22px', borderRadius: 12 }}>
        Réserver
      </Link>
    </>
  )

  return (
    <>
    <div className={styles.headerSpacer} aria-hidden />
    <header className={styles.header}>
      <Link to="/" aria-label="Tay Performance — accueil">
        <img src={logo} alt="Tay Performance" className={styles.logo} />
      </Link>

      {/* desktop */}
      <nav className={styles.nav} aria-label="Navigation principale">
        {links}
        {admin}
        {account}
      </nav>

      {/* mobile: profile always visible + burger */}
      <div className={styles.mobileBar}>
        {admin}
        {account}
        <button
          type="button"
          className={styles.burgerBtn}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <BurgerIcon open={open} />
        </button>
      </div>

      {/* drawer + scrim are portaled to <body>: the header's backdrop-filter would otherwise
          become the containing block of these fixed elements (clipped to the bar height) */}
      {createPortal(
        <>
          {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden />}
          <nav id="mobile-nav" className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`} aria-label="Menu mobile" aria-hidden={!open}>
            <div className={styles.drawerHead}>
              <span className={`mono ${styles.drawerTitle}`}>Menu</span>
              <button type="button" className={styles.burgerBtn} aria-label="Fermer le menu" onClick={() => setOpen(false)}>
                <BurgerIcon open />
              </button>
            </div>
            {links}
            {!loading && session && isAdmin && (
              <Link to="/admin" className={`navlink ${styles.drawerAdmin}`} style={{ fontSize: 14 }}>
                <Icon name="settings" size={18} /> Panneau admin
              </Link>
            )}
            {!loading && (
              <Link to={session ? '/profil' : '/connexion'} className={`navlink ${styles.drawerAccount}`} style={{ fontSize: 14 }}>
                <ProfileIcon /> {session ? 'Mon profil' : 'Se connecter'}
              </Link>
            )}
          </nav>
        </>,
        document.body,
      )}
    </header>
    </>
  )
}
