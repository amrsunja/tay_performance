import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import SectionTag from '../../components/ui/SectionTag'
import CountUp from '../../components/ui/CountUp'
import { useReveal } from '../../hooks/useReveal'
import heroImg from '../../assets/visuel3.jpg'
import visuel1 from '../../assets/visuel1.jpg'
import visuel2 from '../../assets/visuel2.jpg'
import visuel4 from '../../assets/visuel4.jpg'
import visuel5 from '../../assets/visuel5.jpg'
import visuel6 from '../../assets/visuel6.jpg'
import styles from './landing.module.css'

const SERVICES = [
  { id: '01', tone: 'blue', title: 'Covering & Wrapping', body: 'Changement de teinte, finitions mat / satin / brillant, protection carrosserie.' },
  { id: '02', tone: 'red', title: 'Detailing premium', body: 'Rénovation, polissage, traitement céramique longue durée.' },
  { id: '03', tone: 'blue', title: 'Angel Eyes & optique', body: 'Éclairage LED, rénovation de phares, finition signature.' },
  { id: '04', tone: 'amber', title: 'Pose vitrage', body: 'Remplacement et calibrage, essuie-glaces, finitions atelier.' },
] as const

const STEPS = [
  { id: '01', tone: 'blue', title: 'Configurez', body: 'Sélectionnez votre véhicule, vos zones et vos teintes. Le prix et la durée s’affichent en direct.' },
  { id: '02', tone: 'amber', title: 'Réservez', body: 'Choisissez un créneau réel à l’atelier. Disponibilités en temps réel, aucune double réservation.' },
  { id: '03', tone: 'red', title: 'Déposez', body: 'Vous déposez la voiture, vous repartez. Photos avant/après et garantie dans votre espace.' },
] as const

const GALLERY = [
  { src: visuel1, title: "L'équipe Tay Performance", caption: 'BMW Série 5 · finition complète', border: 'var(--brand-blue)', cls: 'galBig' },
  { src: visuel4, title: 'Pose vitrage', caption: '', border: 'var(--brand-red)', cls: '' },
  { src: visuel2, title: 'Précision atelier', caption: '', border: 'var(--octane-500)', cls: 'galTall' },
  { src: visuel5, title: 'Teinte arrière', caption: '', border: 'var(--brand-blue)', cls: '' },
  { src: visuel6, title: 'Film teinté · pose intérieure', caption: '', border: 'var(--octane-500)', cls: 'galWide' },
] as const

const MARQUEE_ITEMS = ['VITRES TEINTÉES', 'COVERING', 'DETAILING', 'ANGEL EYES', 'PROTECTION CÉRAMIQUE', 'POSE VITRAGE']
const MARQUEE_DOTS = ['var(--brand-blue)', 'var(--octane-500)', 'var(--brand-red)']

export default function LandingPage() {
  useReveal()
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (parallaxRef.current && y < 1100) {
        parallaxRef.current.style.transform = `translateY(${y * 0.28}px)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={styles.page}>
      <SiteHeader />

      {/* ============ HERO ============ */}
      <section className={styles.hero}>
        <div ref={parallaxRef} className={styles.heroParallax}>
          <img src={heroImg} alt="" className={styles.heroImg} />
        </div>
        <div className={styles.heroShadeX} />
        <div className={styles.heroShadeY} />
        <div className={styles.heroSweeps} aria-hidden>
          <span className={`${styles.sweep} ${styles.sweepBlue}`} />
          <span className={`${styles.sweep} ${styles.sweepAmber}`} />
          <span className={`${styles.sweep} ${styles.sweepRed}`} />
        </div>
        <div className={styles.heroGrain} aria-hidden />

        <div className={styles.heroContent}>
          <div data-reveal>
            <SectionTag>Vitres Teintées · Covering · Detailing · 67400</SectionTag>
          </div>
          <h1 className={`clash ${styles.heroTitle}`}>
            <span className={styles.heroLine}>
              <span data-reveal data-delay="90" style={{ display: 'inline-block' }}>
                L'obscurité,
              </span>
            </span>
            <span className={styles.heroLine}>
              <span data-reveal data-delay="200" style={{ display: 'inline-block', color: 'var(--accent-500)' }}>
                posée au millimètre.
              </span>
            </span>
          </h1>
          <p data-reveal data-delay="520" className={styles.heroLede}>
            Pose professionnelle de films teintés sur-mesure. Vous déposez la voiture, nos installateurs s'occupent du
            reste — précision, garantie, conformité légale française.
          </p>
          <div data-reveal data-delay="640" className={styles.heroCtas}>
            <Link to="/reserver" className="cta" style={{ fontSize: 16, padding: '17px 30px' }}>
              Réserver un créneau <span style={{ fontSize: 18 }}>→</span>
            </Link>
            <a href="#galerie" className="ghost" style={{ fontSize: 16, padding: '17px 24px', fontWeight: 500 }}>
              Voir la galerie
            </a>
          </div>
        </div>

        <div className={styles.scrollHint} aria-hidden>
          <span className={`mono ${styles.scrollHintLabel}`}>SCROLL</span>
          <span className={styles.scrollHintArrow}>↓</span>
        </div>

        <div data-reveal className={styles.statBand}>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={1200} suffix="+" />
            </div>
            <div className={styles.statLabel}>Véhicules traités</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={49} divide={10} />
              <span style={{ color: 'var(--brand-blue)' }}>★</span>
            </div>
            <div className={styles.statLabel}>Note moyenne clients</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={100} suffix="%" />
            </div>
            <div className={styles.statLabel}>Conforme loi 2026</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={90} suffix=" min" />
            </div>
            <div className={styles.statLabel}>Pose moyenne citadine</div>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className={styles.marquee} aria-hidden>
        <div className={styles.marqueeTrack}>
          {[0, 1].map((copy) => (
            <span key={copy} className={styles.marqueeCopy}>
              {MARQUEE_ITEMS.map((item, i) => (
                <span key={item} className={styles.marqueeItem}>
                  {item}
                  <span style={{ color: MARQUEE_DOTS[i % 3], margin: '0 22px' }}>●</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ============ SERVICES ============ */}
      <section id="services" className={styles.sectionAlt}>
        <div className={styles.inner}>
          <div className={styles.sectionHead}>
            <div data-reveal data-anim="left">
              <SectionTag gradient="linear-gradient(90deg,#29ABE2,#FF9E1B)">Nos prestations</SectionTag>
              <h2 className={`sat ${styles.h2}`}>
                Le garage digital,
                <br />
                prestation par prestation
              </h2>
            </div>
            <Link to="/reserver" data-reveal data-anim="right" className="navlink" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
              Tout voir →
            </Link>
          </div>
          <div className={styles.servicesGrid}>
            <article className={`card card--amber ${styles.serviceHero}`} data-reveal>
              <img src={visuel6} alt="Pose de film teinté" className={styles.serviceHeroImg} />
              <div className={styles.serviceHeroShade} />
              <div className={styles.serviceHeroBody}>
                <span className={`mono ${styles.featuredChip}`}>PRESTATION PHARE</span>
                <h3 className="sat">Vitres teintées sur-mesure</h3>
                <p>
                  Films découpés au véhicule, pose intérieure sans bulle, teintes de 5% à 85% VLT. Avant, arrière,
                  lunette, bande pare-soleil.
                </p>
              </div>
            </article>
            {SERVICES.map((svc, i) => (
              <article key={svc.id} className={`card card--${svc.tone} ${styles.serviceCard}`} data-reveal data-delay={80 * (i + 1)}>
                <div className={`mono ${styles.serviceNum}`} style={{ color: svc.tone === 'blue' ? 'var(--brand-blue)' : svc.tone === 'red' ? 'var(--brand-red)' : 'var(--octane-500)' }}>
                  {svc.id}
                </div>
                <h3 className="sat">{svc.title}</h3>
                <p>{svc.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROCESS ============ */}
      <section id="process" className={styles.section}>
        <div className={styles.inner}>
          <div data-reveal className={styles.processHead}>
            <SectionTag gradient="linear-gradient(90deg,#FF9E1B,#ED1C24)" centered>
              Comment ça marche
            </SectionTag>
            <h2 className={`sat ${styles.h2}`}>Trois étapes, zéro friction</h2>
          </div>
          <div className={styles.processGrid}>
            {STEPS.map((step, i) => (
              <article key={step.id} className={`card card--${step.tone} ${styles.stepCard}`} data-reveal data-delay={120 * i}>
                <div className={`clash ${styles.stepNum}`}>{step.id}</div>
                <h3 className="sat">{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ GALLERY ============ */}
      <section id="galerie" className={styles.sectionAlt}>
        <div className={styles.inner}>
          <div data-reveal style={{ marginBottom: 44 }}>
            <SectionTag gradient="linear-gradient(90deg,#29ABE2,#ED1C24)">Réalisations</SectionTag>
            <h2 className={`sat ${styles.h2}`}>L'atelier en action</h2>
          </div>
          <div className={styles.galleryGrid}>
            {GALLERY.map((item, i) => (
              <figure key={item.title} className={`${styles.galItem} ${item.cls ? styles[item.cls] : ''}`} data-reveal data-delay={80 * i}>
                <img src={item.src} alt={item.title} className={styles.galImg} />
                <figcaption className={styles.galCap} style={{ borderTop: `2px solid ${item.border}` }}>
                  <div className={`sat ${styles.galCapTitle}`}>{item.title}</div>
                  {item.caption && <div className={styles.galCapSub}>{item.caption}</div>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONFORMITE ============ */}
      <section id="conformite" className={styles.section}>
        <div className={styles.inner}>
          <div data-reveal className={styles.legalCard}>
            <div className={styles.legalGlowline} aria-hidden />
            <div>
              <span className={styles.legalTag}>Conformité garantie</span>
              <h2 className={`sat ${styles.legalTitle}`}>
                On vous pose la teinte légale,
                <br />
                pas une amende.
              </h2>
              <p className={styles.legalBody}>
                Notre configurateur applique la réglementation française 2026 en direct : minimum 70% VLT à l'avant,
                arrière libre. Vous voyez tout de suite ce qui est autorisé.
              </p>
            </div>
            <div className={styles.legalGrid}>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--status-success)' }}>≥70%</div>
                <span>VLT mini à l'avant</span>
              </div>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--brand-blue)' }}>Libre</div>
                <span>Vitres arrière</span>
              </div>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--brand-red)' }}>135€</div>
                <span>Amende évitée</span>
              </div>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--text-hi)' }}>10cm</div>
                <span>Bande pare-soleil max</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="reserver" className={styles.ctaSection}>
        <div className={styles.ctaHalo} aria-hidden />
        <div data-reveal className={styles.ctaInner}>
          <h2 className={`clash ${styles.ctaTitle}`}>
            Prêt à teinter
            <br />
            votre véhicule&nbsp;?
          </h2>
          <p className={styles.ctaLede}>Devis transparent en moins de 3 minutes. Créneau confirmé en direct.</p>
          <Link to="/reserver" className="cta" style={{ fontSize: 17, padding: '19px 38px', marginTop: 34, animation: 'tp-pulse 2.8s ease-in-out infinite' }}>
            Réserver maintenant <span style={{ fontSize: 18 }}>→</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
