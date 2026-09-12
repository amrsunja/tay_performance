import { Link } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { SOCIAL_LINKS } from '../../features/landing/SocialSection'
import { WORKSHOP } from '../../lib/workshop'
import { COMPANY } from '../../lib/legal'
import { GOOGLE, RATING_FR } from '../../lib/reviews'
import { DEVELOPER, SERVICE_AREA, portfolioUrl } from '../../lib/site'
import styles from './layout.module.css'

/* Le footer porte trois choses en plus du contact :
   1. les liens légaux obligatoires (LCEN + RGPD) — présents sur toutes les pages ;
   2. le maillage interne vers les pages indexables (accueil, réserver, adresse) ;
   3. la phrase de zone de chalandise, qui donne à Google les communes desservies. */
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <img src={logo} alt="Tay Performance — vitres teintées à Illkirch-Graffenstaden" style={{ height: 40, width: 'auto', marginBottom: 18 }} />
          <p>
            Atelier de pose de films teintés, covering, sellerie et detailing à Illkirch-Graffenstaden, à 10 minutes
            de Strasbourg centre.
          </p>
          <p className={styles.footerArea}>
            Nous recevons les véhicules de {SERVICE_AREA.slice(0, -1).join(', ')} et de tout le{' '}
            {SERVICE_AREA[SERVICE_AREA.length - 1]}.
          </p>
          <p className={styles.footerArea}>
            <a href={GOOGLE.placeUrl} target="_blank" rel="noreferrer" className="navlink">
              {RATING_FR}/5 sur {GOOGLE.reviewCount} avis Google
            </a>
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
              <a href={`tel:${COMPANY.phoneE164}`} className="navlink">
                {COMPANY.phone}
              </a>
              <br />
              <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" className="navlink">Instagram</a>
              {' · '}
              <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" className="navlink">TikTok</a>
              {' · '}
              <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" className="navlink">Facebook</a>
            </div>
          </div>

          <div>
            <div className={styles.footerColTitle}>Le site</div>
            <div className={styles.footerColBody}>
              <Link to="/reserver" className="navlink">Réserver une pose</Link>
              <br />
              <Link to="/adresse" className="navlink">Nous trouver</Link>
              <br />
              <a href="/#faq" className="navlink">Questions fréquentes</a>
              <br />
              <a href="/#avis" className="navlink">Avis clients</a>
            </div>
          </div>

          <div>
            <div className={styles.footerColTitle}>Informations légales</div>
            <div className={styles.footerColBody}>
              <Link to="/mentions-legales" className="navlink">Mentions légales</Link>
              <br />
              <Link to="/confidentialite" className="navlink">Confidentialité</Link>
              <br />
              <Link to="/cgv" className="navlink">Conditions de vente</Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerLegal}>
        <span>© {new Date().getFullYear()} Tay Performance · SIREN {COMPANY.siren}</span>
        <span>Vitres avant conformes au seuil légal de 70 % de transmission lumineuse</span>
        <span className={styles.footerCredit}>
          Site conçu &amp; développé par{' '}
          <a
            href={portfolioUrl('footer')}
            target="_blank"
            rel="noreferrer author"
            className="navlink"
            title={`${DEVELOPER.name} — ${DEVELOPER.role}`}
          >
            {DEVELOPER.name}
          </a>
          <span className={styles.footerCreditSep} aria-hidden>·</span>
          <a href={portfolioUrl('footer', true)} target="_blank" rel="noreferrer" className="navlink">
            Un site comme celui-ci&nbsp;?
          </a>
        </span>
      </div>
    </footer>
  )
}
