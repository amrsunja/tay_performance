import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import SectionTag from '../../components/ui/SectionTag'
import CountUp from '../../components/ui/CountUp'
import Icon from '../../components/ui/Icon'
import { useReveal } from '../../hooks/useReveal'
import { useSeo } from '../../lib/seo'
import { DEFAULT_DESCRIPTION, SERVICE_AREA } from '../../lib/site'
import SocialSection from './SocialSection'
import heroImg from '../../assets/visuel3.jpg'
import introVideo from '../../assets/videos/intro.mp4'
import introVideo2 from '../../assets/videos/intro2.mp4'
import visuel1 from '../../assets/visuel1.jpg'
import visuel2 from '../../assets/visuel2.jpg'
import visuel4 from '../../assets/visuel4.jpg'
import visuel5 from '../../assets/visuel5.jpg'
import visuel6 from '../../assets/visuel6.jpg'
import styles from './landing.module.css'

/* The five services Tay Performance actually sells — shown as a slider (mobile: swipe). */
const SERVICES = [
  {
    id: '01',
    tone: 'amber',
    featured: true,
    img: visuel6,
    title: 'Vitres teintées',
    body: 'Films découpés au véhicule, pose intérieure sans bulle, teintes de 5 % à 70 % TLV. Avant, arrière, lunette, pare-brise. Réservation et prix en ligne.',
    cta: { to: '/reserver', label: 'Réserver une pose →' },
  },
  {
    id: '02',
    tone: 'blue',
    img: visuel1,
    title: 'Covering',
    body: 'Changement de teinte total ou partiel, finitions mat / satin / brillant, protection de carrosserie.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '03',
    tone: 'red',
    img: visuel2,
    title: 'Sellerie',
    body: 'Rénovation et personnalisation de l’intérieur : sièges, volant, garnitures, cuir et alcantara.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '04',
    tone: 'blue',
    img: visuel4,
    title: 'Detailing',
    body: 'Rénovation esthétique, polissage, décontamination, traitement céramique longue durée.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '05',
    tone: 'amber',
    img: visuel5,
    title: 'Éclairage intérieur',
    body: 'Ambiance LED sur-mesure, éclairage d’habitacle et de seuils, finition signature.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
] as const

const STEPS = [
  { id: '01', tone: 'blue', title: 'Configurez', body: 'Sélectionnez votre véhicule, vos zones et vos teintes. Le prix et la durée s’affichent en direct.' },
  { id: '02', tone: 'amber', title: 'Réservez', body: 'Choisissez un créneau réel à l’atelier. Disponibilités en temps réel, aucune double réservation.' },
  { id: '03', tone: 'red', title: 'Déposez', body: 'Vous déposez votre véhicule et le récupérez 90 minutes plus tard.' },
] as const

const GALLERY = [
  { src: visuel1, title: "L'équipe Tay Performance", caption: 'BMW Série 5 · finition complète', border: 'var(--brand-blue)', cls: 'galBig' },
  { src: visuel4, title: 'Pose vitrage', caption: '', border: 'var(--brand-red)', cls: '' },
  { src: visuel2, title: 'Précision atelier', caption: '', border: 'var(--octane-500)', cls: 'galTall' },
  { src: visuel5, title: 'Teinte arrière', caption: '', border: 'var(--brand-blue)', cls: '' },
  { src: visuel6, title: 'Film teinté · pose intérieure', caption: '', border: 'var(--octane-500)', cls: 'galWide' },
] as const

const MARQUEE_ITEMS = ['VITRES TEINTÉES', 'COVERING', 'SELLERIE', 'DETAILING', 'ÉCLAIRAGE INTÉRIEUR']
const MARQUEE_DOTS = ['var(--brand-blue)', 'var(--octane-500)', 'var(--brand-red)']

/* FAQ rich result — mirrors the #conformite section (keep both in sync). */
const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Les vitres teintées sont-elles légales en France ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Oui, à condition de respecter la réglementation : les vitres avant (pare-brise et vitres latérales avant) doivent laisser passer au moins 70 % de lumière (TLV ≥ 70 %). Les vitres arrière et la lunette sont libres. Tay Performance applique ces règles automatiquement dans son configurateur.",
      },
    },
    {
      '@type': 'Question',
      name: 'Quel est le prix d’une pose de vitres teintées à Strasbourg ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Le tarif dépend du véhicule, des zones (avant, arrière, lunette, bande pare-soleil) et de la teinte choisie. Le configurateur en ligne de Tay Performance affiche le prix et la durée exacts en direct, avant de réserver un créneau à l’atelier d’Illkirch-Graffenstaden.',
      },
    },
    {
      '@type': 'Question',
      name: 'Combien de temps dure la pose de film teinté ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Selon les zones, comptez généralement de 1 h à 3 h. La durée estimée est calculée automatiquement lors de la réservation en ligne, et vous déposez simplement le véhicule à l’heure du rendez-vous.',
      },
    },
    {
      '@type': 'Question',
      name: 'Où se trouve l’atelier Tay Performance ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden, à 10 minutes de Strasbourg centre. Parking sur place. Nous intervenons pour toute l'Eurométropole de Strasbourg et le Bas-Rhin.",
      },
    },
  ],
}

export default function LandingPage() {
  useReveal()
  useSeo({
    title: 'Vitres Teintées Strasbourg · Tay Performance — Film teinté, Covering, Detailing (Illkirch 67400)',
    description: DEFAULT_DESCRIPTION,
    path: '/',
    jsonLd: LANDING_JSON_LD,
  })
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
          <img src={heroImg} alt="Pose de vitres teintées sur-mesure à l'atelier Tay Performance, Illkirch-Graffenstaden (Strasbourg)" className={styles.heroImg} fetchPriority="high" />
        </div>
        {/* intro videos flanking the bg image (hidden ≤960px) */}
        <div className={styles.heroSideVideos} aria-hidden>
          <div className={`${styles.heroSide} ${styles.heroSideLeft}`}>
            <video src={introVideo} autoPlay muted loop playsInline preload="auto" />
            <span className={styles.heroSideTint} />
          </div>
          <div className={`${styles.heroSide} ${styles.heroSideRight}`}>
            <video src={introVideo2} autoPlay muted loop playsInline preload="auto" />
            <span className={styles.heroSideTint} />
          </div>
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
            <span className="sr-only">Vitres teintées à Strasbourg — Tay Performance. </span>
            <span className={styles.heroLine}>
              <span data-reveal data-anim="hero" data-delay="90" style={{ display: 'inline-block' }}>
                L'obscurité,
              </span>
            </span>
            <span className={styles.heroLine}>
              <span data-reveal data-anim="hero" data-delay="200" style={{ display: 'inline-block', color: 'var(--accent-500)' }}>
                posée au millimètre.
              </span>
            </span>
          </h1>
          <p data-reveal data-anim="hero" data-delay="520" className={styles.heroLede}>
            Pose professionnelle de films teintés sur-mesure. Vous déposez la voiture, nos installateurs s'occupent du
            reste — précision, garantie, conformité légale française.
          </p>
          <div data-reveal data-delay="640" className={styles.heroCtas}>
            <Link to="/reserver" className="cta" style={{ fontSize: 16, padding: '17px 28px' }}>
              Réserver un créneau <Icon name="arrow-right" size={18} />
            </Link>
            <a href="#galerie" className="ghost" style={{ fontSize: 16, padding: '17px 24px', fontWeight: 500 }}>
              Voir la galerie
            </a>
          </div>
        </div>

        <div className={styles.scrollHint} aria-hidden>
          <span className={`mono ${styles.scrollHintLabel}`}>SCROLL</span>
          <span className={styles.scrollHintArrow}>
            <Icon name="arrow-down" size={18} />
          </span>
        </div>

        <div data-reveal className={styles.statBand}>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={3000} suffix="+" />
            </div>
            <div className={styles.statLabel}>Véhicules traités</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={49} divide={10} />
              <Icon name="star" size={20} style={{ color: 'var(--brand-blue)' }} />
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
                  <span className={styles.marqueeDot} style={{ color: MARQUEE_DOTS[i % 3] }} />
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
            <Link to="/reserver" data-reveal data-anim="right" className={`navlink ${styles.sectionHeadLink}`}>
              Tout voir <Icon name="arrow-right" size={15} />
            </Link>
          </div>
          <ServicesSlider />
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
              <figure
                key={item.title}
                className={`${styles.galItem} ${item.cls ? styles[item.cls] : ''}`}
                data-reveal
                data-anim="mask"
                data-delay={90 * i}
              >
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

      {/* ============ SOCIAL ============ */}
      <SocialSection />

      {/* ============ CONFORMITE ============ */}
      <section id="conformite" className={styles.section}>
        <div className={styles.inner}>
          <div data-reveal className={styles.legalCard}>
            <div className={styles.legalGlowline} aria-hidden />
            <div>
              <span className={styles.legalTag}>Conformité garantie</span>
              <h2 className={`sat ${styles.legalTitle}`}>
                <span className="sr-only">Vitres teintées légales en France : </span>
                On vous pose la teinte légale,
                <br />
                pas une amende.
              </h2>
              <p className={styles.legalBody}>
                Notre configurateur applique la réglementation française 2026 en direct : minimum 70% TLV à l'avant,
                arrière libre. Vous voyez tout de suite ce qui est autorisé.
              </p>
            </div>
            <div className={styles.legalGrid}>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--status-success)' }}>≥70%</div>
                <span>TLV mini à l'avant</span>
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
            <span className="sr-only"> Vitres teintées à {SERVICE_AREA.slice(0, 5).join(', ')}.</span>
          </h2>
          <p className={styles.ctaLede}>Devis transparent en moins de 3 minutes. Créneau confirmé en direct.</p>
          <Link
            to="/reserver"
            className="cta"
            style={{ fontSize: 17, padding: '19px 34px', marginTop: 34, animation: 'tp-pulse 2.8s ease-in-out infinite' }}
          >
            Réserver maintenant <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}


/* ---------- services slider (scroll-snap, arrows + dots, swipe on mobile) ---------- */
function ServicesSlider() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  /* scrollLeft that puts slide `el` flush against the scroller's content edge.
     On mobile the track is full-bleed with its own inline padding, so the raw
     offsetLeft would be off by exactly that padding. */
  const offsetOf = (track: HTMLElement, el: HTMLElement) =>
    el.offsetLeft - track.offsetLeft - track.clientLeft - parseFloat(getComputedStyle(track).paddingLeft || '0')

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const onScroll = () => {
      // coalesce to one measure per frame — scroll events fire far faster than
      // paint on a touch device and this loop reads layout
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const slides = Array.from(track.children) as HTMLElement[]
        const left = track.scrollLeft
        let best = 0
        let bestDist = Infinity
        slides.forEach((el, i) => {
          const d = Math.abs(offsetOf(track, el) - left)
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        })
        setActive(best)
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      track.removeEventListener('scroll', onScroll)
    }
  }, [])

  const goTo = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const el = track.children[Math.max(0, Math.min(SERVICES.length - 1, i))] as HTMLElement | undefined
    if (el) track.scrollTo({ left: offsetOf(track, el), behavior: 'smooth' })
  }

  const toneColor = (tone: string) =>
    tone === 'blue' ? 'var(--brand-blue)' : tone === 'red' ? 'var(--brand-red)' : 'var(--octane-500)'

  return (
    <div className={styles.servicesSlider}>
      <div ref={trackRef} className={styles.servicesTrack} role="region" aria-label="Nos prestations" aria-roledescription="carrousel">
        {SERVICES.map((svc, i) => (
          <article
            key={svc.id}
            className={`card card--${svc.tone} ${styles.serviceSlide} ${'featured' in svc && svc.featured ? styles.serviceSlideFeatured : ''}`}
            data-reveal
            data-delay={60 * i}
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${SERVICES.length} — ${svc.title}`}
          >
            <img src={svc.img} alt="" className={styles.serviceSlideImg} loading="lazy" />
            <div className={styles.serviceSlideShade} />
            <div className={styles.serviceSlideBody}>
              {'featured' in svc && svc.featured ? (
                <span className={`mono ${styles.featuredChip}`}>PRESTATION PHARE</span>
              ) : (
                <div className={`mono ${styles.serviceNum}`} style={{ color: toneColor(svc.tone) }}>
                  {svc.id}
                </div>
              )}
              <h3 className="sat">{svc.title}</h3>
              <p>{svc.body}</p>
              <Link to={svc.cta.to} className={`navlink ${styles.serviceSlideLink}`}>
                {svc.cta.label}
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.sliderNav}>
        <div className={styles.sliderDots} role="tablist" aria-label="Aller à une prestation">
          {SERVICES.map((svc, i) => (
            <button
              key={svc.id}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={svc.title}
              className={`${styles.sliderDot} ${active === i ? styles.sliderDotOn : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <div className={styles.sliderArrows}>
          <button
            type="button"
            className={styles.sliderArrow}
            aria-label="Prestation précédente"
            disabled={active === 0}
            onClick={() => goTo(active - 1)}
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <button
            type="button"
            className={styles.sliderArrow}
            aria-label="Prestation suivante"
            disabled={active >= SERVICES.length - 1}
            onClick={() => goTo(active + 1)}
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
