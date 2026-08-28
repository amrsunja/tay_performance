import { Link } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { SOCIAL_LINKS } from '../../features/landing/SocialSection'
import { WORKSHOP } from '../../features/info/AddressPage'
import styles from './layout.module.css'

const PORTFOLIO_URL = 'https://amirazdoyev.framer.website/'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <img src={logo} alt="Tay Performance" style={{ height: 40, width: 'auto', marginBottom: 18 }} />
          <p>
            Atelier de personnalisation automobile. Vitres teintées, covering, detailing — Strasbourg / Illkirch.
          </p>
        </div>
        <div className={styles.footerCols}>
          <div>
            <div className={styles.footerColTitle}>Atelier</div>
            <div className={styles.footerColBody}>
              <Link to="/adresse" className="navlink">
                {WORKSHOP.street}
                <br />
                {WORKSHOP.city}
              </Link>
            </div>
          </div>
          <div>
            <div className={styles.footerColTitle}>Contact</div>
            <div className={`${styles.footerColBody} mono`}>
              06 05 50 50 28
              <br />
              <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" className="navlink">Instagram</a>
              {' · '}
              <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" className="navlink">TikTok</a>
              {' · '}
              <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" className="navlink">Facebook</a>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.footerLegal}>
        <span>© 2026 Tay Performance. Tous droits réservés.</span>
        <span>Conforme réglementation vitres teintées · France 2026</span>
        <span>
          Site créé par{' '}
          <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer" className="navlink" title="Portfolio d'Amir EI">
            Amir EI
          </a>
        </span>
      </div>
    </footer>
  )
}
