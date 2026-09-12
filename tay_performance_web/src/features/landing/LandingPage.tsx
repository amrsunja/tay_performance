import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import SectionTag from '../../components/ui/SectionTag'
import CountUp from '../../components/ui/CountUp'
import Icon from '../../components/ui/Icon'
import { useReveal } from '../../hooks/useReveal'
import { useSeo } from '../../lib/seo'
import { DEFAULT_DESCRIPTION, SERVICE_AREA, SITE_URL } from '../../lib/site'
import { GOOGLE, RATING_FR, REVIEWS } from '../../lib/reviews'
import SocialSection from './SocialSection'
import { FAQ_ITEMS, FaqSection, ReviewsSection, WhyUsSection } from './TrustSections'
import heroImg from '../../assets/visuel3.jpg'
/* Vidéos d'ambiance ré-encodées : 480p, 12 s, sans piste audio, ~700 Ko au lieu de 11 Mo.
   Les sources longues restent dans src/assets/videos/ pour un futur ré-encodage. */
import introVideo from '../../assets/media/intro.mp4'
import introVideo2 from '../../assets/media/intro2.mp4'
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
    body: "Films découpés au format de chaque vitre, posés par l'intérieur. De 5 % à 70 % de transmission lumineuse, sur les vitres avant, arrière, la lunette et le pare-brise. Prix calculé et créneau réservé en ligne.",
    cta: { to: '/reserver', label: 'Voir mon prix →' },
  },
  {
    id: '02',
    tone: 'blue',
    img: visuel1,
    title: 'Covering',
    body: 'Changement de couleur complet ou par éléments : capot, toit, rétroviseurs. Finitions mat, satin ou brillant, et la peinture d\'origine reste intacte dessous.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '03',
    tone: 'red',
    img: visuel2,
    title: 'Sellerie',
    body: 'Sièges fatigués, volant lustré, garnitures marquées : reprise en cuir ou alcantara, à l\'identique ou dans la finition que vous voulez.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '04',
    tone: 'blue',
    img: visuel4,
    title: 'Detailing',
    body: 'Décontamination, polissage des micro-rayures, phares repolis et protection céramique qui tient plusieurs années.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
  {
    id: '05',
    tone: 'amber',
    img: visuel5,
    title: 'Éclairage intérieur',
    body: 'Bandeaux LED intégrés dans les contre-portes, la planche de bord et les seuils, avec la couleur et l\'intensité de votre choix.',
    cta: { to: '/adresse', label: 'Sur devis à l’atelier →' },
  },
] as const

const STEPS = [
  {
    id: '01',
    tone: 'blue',
    title: 'Vous composez votre pose',
    body: "Votre modèle, les vitres à traiter, la teinte. Le prix et la durée se mettent à jour à chaque choix. Pas de compte à créer, pas de carte bancaire.",
  },
  {
    id: '02',
    tone: 'amber',
    title: 'Vous prenez un créneau',
    body: "Vous voyez l'agenda réel de l'atelier. Le créneau est bloqué pour vous dès que vous le choisissez, l'atelier le valide et vous confirme par e-mail.",
  },
  {
    id: '03',
    tone: 'red',
    title: 'Vous déposez la voiture',
    body: "1 h à 3 h selon les vitres. Vous attendez sur place — canapé, télé, café — ou vous repassez. Vous réglez à la fin, une fois le travail vérifié avec vous.",
  },
] as const

const GALLERY = [
  {
    src: visuel1,
    title: "L'équipe Tay Performance",
    alt: "L'équipe de Tay Performance devant une BMW Série 5 aux vitres teintées, atelier d'Illkirch-Graffenstaden",
    caption: 'BMW Série 5 · finition complète',
    border: 'var(--brand-blue)',
    cls: 'galBig',
  },
  {
    src: visuel4,
    title: 'Pose du film sur vitre latérale',
    alt: 'Pose du film teinté sur une vitre latérale avant, à la raclette, à l\'atelier Tay Performance de Strasbourg',
    caption: '',
    border: 'var(--brand-red)',
    cls: '',
  },
  {
    src: visuel2,
    title: 'Découpe au format du vitrage',
    alt: 'Découpe du film teinté au format exact du vitrage avant maroufflage',
    caption: '',
    border: 'var(--octane-500)',
    cls: 'galTall',
  },
  {
    src: visuel5,
    title: 'Vitres arrière teintées',
    alt: 'Vitres latérales arrière et lunette teintées sur un véhicule sorti de l\'atelier Tay Performance',
    caption: '',
    border: 'var(--brand-blue)',
    cls: '',
  },
  {
    src: visuel6,
    title: 'Film teinté posé par l\'intérieur',
    alt: 'Film teinté posé par l\'intérieur du vitrage, sans bulle, sur un véhicule à Illkirch-Graffenstaden',
    caption: '',
    border: 'var(--octane-500)',
    cls: 'galWide',
  },
] as const

const MARQUEE_ITEMS = ['VITRES TEINTÉES', 'COVERING', 'SELLERIE', 'DETAILING', 'ÉCLAIRAGE INTÉRIEUR']
const MARQUEE_DOTS = ['var(--brand-blue)', 'var(--octane-500)', 'var(--brand-red)']

/* Rich results de la page d'accueil.
   - FAQPage : généré depuis FAQ_ITEMS, qui est AUSSI ce qui s'affiche dans <FaqSection/>.
     Google retire le rich result si la réponse n'est pas visible sur la page — d'où la
     source unique.
   - AggregateRating + Review : recopiés de la fiche Google (src/lib/reviews.ts). Ne
     jamais gonfler ces chiffres, c'est un motif de sanction manuelle. */
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/#faq`,
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

const RATING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  '@id': `${SITE_URL}/#business`,
  name: 'Tay Performance',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: GOOGLE.rating,
    reviewCount: GOOGLE.reviewCount,
    bestRating: 5,
    worstRating: 1,
  },
  review: REVIEWS.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    datePublished: r.date,
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    reviewBody: r.text,
  })),
}

const BREADCRUMB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` }],
}

const LANDING_JSON_LD = [FAQ_JSON_LD, RATING_JSON_LD, BREADCRUMB_JSON_LD]

export default function LandingPage() {
  useReveal()
  useSeo({
    title: 'Vitres teintées Strasbourg — prix en ligne et rendez-vous · Tay Performance (Illkirch 67400)',
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
            <video src={introVideo} autoPlay muted loop playsInline preload="metadata" />
            <span className={styles.heroSideTint} />
          </div>
          <div className={`${styles.heroSide} ${styles.heroSideRight}`}>
            <video src={introVideo2} autoPlay muted loop playsInline preload="metadata" />
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
            <SectionTag>Illkirch-Graffenstaden · 10 min de Strasbourg centre</SectionTag>
          </div>
          <h1 className={`clash ${styles.heroTitle}`}>
            <span className={styles.heroLine}>
              <span data-reveal data-anim="hero" data-delay="90" style={{ display: 'inline-block' }}>
                Vitres teintées
              </span>
            </span>
            <span className={styles.heroLine}>
              <span data-reveal data-anim="hero" data-delay="200" style={{ display: 'inline-block', color: 'var(--accent-500)' }}>
                à Strasbourg.
              </span>
            </span>
          </h1>
          <p data-reveal data-anim="hero" data-delay="520" className={styles.heroLede}>
            Film découpé au format de vos vitres, posé par l'intérieur, sans bulle. Vous choisissez la teinte, le
            site affiche le prix et la durée, vous prenez le créneau. {RATING_FR}/5 sur {GOOGLE.reviewCount} avis
            Google.
          </p>
          <div data-reveal data-delay="640" className={styles.heroCtas}>
            <Link to="/reserver" className="cta" style={{ fontSize: 16, padding: '17px 28px' }}>
              Voir mon prix en 2 min <Icon name="arrow-right" size={18} />
            </Link>
            <a href="#avis" className="ghost" style={{ fontSize: 16, padding: '17px 24px', fontWeight: 500 }}>
              Lire les avis
            </a>
          </div>
        </div>

        <div className={styles.scrollHint} aria-hidden>
          <span className={`mono ${styles.scrollHintLabel}`}>SCROLL</span>
          <span className={styles.scrollHintArrow}>
            <Icon name="arrow-down" size={18} />
          </span>
        </div>

        {/* Chiffres relevés sur la fiche Google le 12/09/2026 — voir src/lib/reviews.ts.
            Ne mettez ici que ce qui est vérifiable : une stat inventée se paie au premier avis. */}
        <div data-reveal className={styles.statBand}>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={50} divide={10} />
              <Icon name="star" size={20} style={{ color: 'var(--octane-500)' }} />
            </div>
            <div className={styles.statLabel}>Note Google</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={GOOGLE.reviewCount} />
            </div>
            <div className={styles.statLabel}>Avis, aucun sous 5 étoiles</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>
              <CountUp target={90} suffix=" min" />
            </div>
            <div className={styles.statLabel}>Pose type sur une citadine</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.statValue}`}>0 €</div>
            <div className={styles.statLabel}>D'acompte à la réservation</div>
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
                Ce qu'on fait
                <br />
                à l'atelier
              </h2>
            </div>
            <Link to="/reserver" data-reveal data-anim="right" className={`navlink ${styles.sectionHeadLink}`}>
              Chiffrer ma pose <Icon name="arrow-right" size={15} />
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
              Comment ça se passe
            </SectionTag>
            <h2 className={`sat ${styles.h2}`}>De la simulation au véhicule rendu</h2>
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

      {/* ============ AVIS GOOGLE ============ */}
      <ReviewsSection />

      {/* ============ GALLERY ============ */}
      <section id="galerie" className={styles.sectionAlt}>
        <div className={styles.inner}>
          <div data-reveal style={{ marginBottom: 44 }}>
            <SectionTag gradient="linear-gradient(90deg,#29ABE2,#ED1C24)">Réalisations</SectionTag>
            <h2 className={`sat ${styles.h2}`}>Des voitures sorties de l'atelier</h2>
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
                <img src={item.src} alt={item.alt} className={styles.galImg} loading="lazy" decoding="async" />
                <figcaption className={styles.galCap} style={{ borderTop: `2px solid ${item.border}` }}>
                  <div className={`sat ${styles.galCapTitle}`}>{item.title}</div>
                  {item.caption && <div className={styles.galCapSub}>{item.caption}</div>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ POURQUOI NOUS ============ */}
      <WhyUsSection />

      {/* ============ SOCIAL ============ */}
      <SocialSection />

      {/* ============ FAQ ============ */}
      <FaqSection />

      {/* ============ CONFORMITE ============ */}
      <section id="conformite" className={styles.section}>
        <div className={styles.inner}>
          <div data-reveal className={styles.legalCard}>
            <div className={styles.legalGlowline} aria-hidden />
            <div>
              <span className={styles.legalTag}>Réglementation</span>
              <h2 className={`sat ${styles.legalTitle}`}>
                <span className="sr-only">Vitres teintées légales en France : </span>
                Ce que la loi autorise,
                <br />
                dit avant la pose.
              </h2>
              <p className={styles.legalBody}>
                Depuis le décret du 13 avril 2016, le pare-brise et les vitres avant doivent laisser passer au moins
                70 % de la lumière. L'arrière et la lunette sont libres. Le configurateur vous signale toute
                configuration hors clous pendant que vous la composez — pas au moment du contrôle technique.
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
                <div className="mono" style={{ color: 'var(--brand-red)' }}>135 €</div>
                <span>Amende + 3 points si trop sombre</span>
              </div>
              <div className={styles.legalStat}>
                <div className="mono" style={{ color: 'var(--text-hi)' }}>Bande</div>
                <span>Pare-soleil tolérée en haut de pare-brise</span>
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
            Votre prix,
            <br />
            maintenant.
          </h2>
          <p className={styles.ctaLede}>
            Deux minutes de configurateur, aucun compte, aucun acompte : vous voyez le montant et les créneaux libres
            avant de vous engager. Nous recevons les véhicules de {SERVICE_AREA.slice(0, 5).join(', ')} et de tout le
            Bas-Rhin.
          </p>
          <Link
            to="/reserver"
            className="cta"
            style={{ fontSize: 17, padding: '19px 34px', marginTop: 34, animation: 'tp-pulse 2.8s ease-in-out infinite' }}
          >
            Configurer ma pose <Icon name="arrow-right" size={18} />
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
            <img
              src={svc.img}
              alt={`${svc.title} — Tay Performance, Illkirch-Graffenstaden`}
              className={styles.serviceSlideImg}
              loading="lazy"
              decoding="async"
            />
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
