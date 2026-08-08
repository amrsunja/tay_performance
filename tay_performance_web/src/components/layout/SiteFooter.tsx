import logo from '../../assets/logo.svg'
import styles from './layout.module.css'

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
              19 Rue de l'industrie
              <br />
              67400 Illkirch-Graffenstaden
            </div>
          </div>
          <div>
            <div className={styles.footerColTitle}>Contact</div>
            <div className={`${styles.footerColBody} mono`}>
              06 05 50 50 28
              <br />
              @tay_performance
            </div>
          </div>
        </div>
      </div>
      <div className={styles.footerLegal}>
        <span>© 2026 Tay Performance. Tous droits réservés.</span>
        <span>Conforme réglementation vitres teintées · France 2026</span>
      </div>
    </footer>
  )
}
