/* /adresse — where the workshop is: address (→ Google Maps on click), opening hours and an
   embedded map. Address comes from app_settings when available, with a static fallback. */
import { useQuery } from '@tanstack/react-query'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import { useReveal } from '../../hooks/useReveal'
import { getCatalog } from '../../api/catalog'
import styles from '../portal/portal.module.css'

export const WORKSHOP = {
  name: 'Tay Performance',
  street: "19 Rue de l'industrie",
  city: '67400 Illkirch-Graffenstaden',
  full: "19 Rue de l'industrie, 67400 Illkirch-Graffenstaden",
} as const

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${WORKSHOP.name}, ${address}`)}`
}
function embedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${WORKSHOP.name}, ${address}`)}&z=15&output=embed`
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  )
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function AddressPage() {
  useReveal()
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  const address = catalog.data?.settings.workshopAddress || WORKSHOP.full
  const phone = catalog.data?.settings.contactPhone || '06 05 50 50 28'
  const [street, ...rest] = address.split(',')
  const city = rest.join(',').trim()

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head} data-reveal>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Atelier · Illkirch-Graffenstaden</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Nous trouver<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
            <p className={styles.lede}>À 10 min de Strasbourg centre — parking sur place, dépôt du véhicule à l'heure du rendez-vous.</p>
          </div>
        </div>

        <div className={styles.addressGrid} data-reveal data-delay={90}>
          <div className={styles.addressCard}>
            <a
              href={mapsUrl(address)}
              target="_blank"
              rel="noreferrer"
              className={styles.addressLink}
              aria-label="Ouvrir l'itinéraire dans Google Maps"
            >
              <span className={styles.addressPin}>
                <PinIcon />
              </span>
              <span>
                <span className={`sat ${styles.addressStreet}`}>{street.trim()}</span>
                <span className={`mono ${styles.addressCity}`}>{city || WORKSHOP.city}</span>
                <span className={`mono ${styles.addressHint}`}>Ouvrir dans Google Maps →</span>
              </span>
            </a>

            <div className={styles.addressMeta}>
              <div>
                <div className={`mono ${styles.addressLabel}`}>Téléphone</div>
                <a className="navlink mono" href={`tel:${phone.replace(/\s/g, '')}`} style={{ fontSize: 15 }}>
                  {phone}
                </a>
              </div>
              <div>
                <div className={`mono ${styles.addressLabel}`}>Horaires</div>
                <div className={styles.hoursList}>
                  {DAYS.map((d, i) => {
                    const h = HOURS[i]
                    return (
                      <div key={d} className={styles.hoursRow}>
                        <span>{d}</span>
                        <span className="mono" style={{ color: h ? 'var(--text-soft)' : 'var(--text-faint)' }}>{h ?? 'Fermé'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <a href="/reserver" className="cta" style={{ fontSize: 15, padding: '14px 24px', borderRadius: 13, justifySelf: 'start' }}>
              Réserver un créneau →
            </a>
          </div>

          <div className={styles.mapCard}>
            <iframe
              title="Carte — Tay Performance"
              src={embedUrl(address)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className={styles.mapFrame}
            />
            <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className={`ghost ${styles.mapCta}`}>
              Itinéraire Google Maps →
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

// mirrors the seeded workshop_hours (0007); admin config remains the source of truth for slots
const HOURS: (string | null)[] = ['09:00 – 18:00', '09:00 – 18:00', '09:00 – 18:00', '09:00 – 18:00', '09:00 – 19:00', '09:00 – 16:00', null]
