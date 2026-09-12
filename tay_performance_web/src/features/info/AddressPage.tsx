/* /adresse — where the workshop is: address (→ Google Maps on click), opening hours and an
   embedded map. Address comes from app_settings and the opening hours from workshop_hours,
   i.e. exactly what the admin sets in Admin → Config → Horaires d'ouverture. Both tables are
   anon-readable by RLS, so no session is needed. Address keeps a static fallback; the hours
   have none on purpose — showing stale hours is worse than showing none. */
import { useQuery } from '@tanstack/react-query'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import { useReveal } from '../../hooks/useReveal'
import { useSeo } from '../../lib/seo'
import { getCatalog, getWorkshopHours } from '../../api/catalog'
import type { WorkshopHoursRow } from '../../types/api'
import { WORKSHOP, mapsUrl } from '../../lib/workshop'
import styles from '../portal/portal.module.css'

/* WORKSHOP / mapsUrl vivent dans src/lib/workshop.ts — le footer les utilise sur toutes
   les pages et cette page-ci est chargée à la demande. Ré-export pour compatibilité. */
export { WORKSHOP, mapsUrl } from '../../lib/workshop'

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

/* index = ISO weekday - 1 (1 = lundi … 7 = dimanche, matching workshop_hours.weekday) */
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** "Now" as the *workshop* sees it, not as the visitor's device sees it — a client
    in another timezone must still be told whether Illkirch is open right now. */
function workshopNow(timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // hour12:false yields "24" at midnight in some engines
  const hour = Number(part('hour')) % 24
  return { weekday: ISO_WEEKDAY[part('weekday')] ?? 1, minutes: hour * 60 + Number(part('minute')) }
}

function toMinutes(time: string | null): number | null {
  if (!time) return null
  const [h, m] = time.split(':')
  const mins = Number(h) * 60 + Number(m)
  return Number.isFinite(mins) ? mins : null
}

interface OpenState {
  open: boolean
  /** "ferme à 18:00" / "ouvre demain à 09:00" — null when the week has no open day at all. */
  detail: string | null
}

/** Open/closed right now, plus the next transition. A day row missing from the table
    is closed (the check constraint guarantees close_time > open_time, so no overnight
    ranges to wrap around). */
export function openState(hours: WorkshopHoursRow[], timeZone: string): OpenState | null {
  if (hours.length === 0) return null
  const byDay = new Map(hours.map((h) => [h.weekday, h]))
  const { weekday, minutes } = workshopNow(timeZone)

  const today = byDay.get(weekday)
  const openAt = toMinutes(today?.openTime ?? null)
  const closeAt = toMinutes(today?.closeTime ?? null)
  if (today?.isOpen && openAt != null && closeAt != null && minutes >= openAt && minutes < closeAt) {
    return { open: true, detail: `ferme à ${today.closeTime}` }
  }
  if (today?.isOpen && openAt != null && minutes < openAt) {
    return { open: false, detail: `ouvre à ${today.openTime}` }
  }
  for (let step = 1; step <= 7; step++) {
    const next = byDay.get(((weekday - 1 + step) % 7) + 1)
    if (next?.isOpen && next.openTime) {
      const label = step === 1 ? 'demain' : DAYS[next.weekday - 1].toLowerCase()
      return { open: false, detail: `ouvre ${label} à ${next.openTime}` }
    }
  }
  return { open: false, detail: null }
}

export default function AddressPage() {
  useReveal()
  useSeo({
    title: "Nous trouver — Atelier vitres teintées à Illkirch-Graffenstaden (Strasbourg)",
    description:
      "Tay Performance, 19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden — à 10 min de Strasbourg centre. Horaires, plan d'accès et parking sur place pour votre pose de vitres teintées.",
    path: '/adresse',
  })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  // hours come straight from the admin Config tab — never hardcode them here again
  const hours = useQuery({ queryKey: ['workshop-hours'], queryFn: getWorkshopHours, staleTime: 5 * 60_000 })
  const address = catalog.data?.settings.workshopAddress || WORKSHOP.full
  const phone = catalog.data?.settings.contactPhone || '06 05 50 50 28'
  const timeZone = catalog.data?.settings.timezone || 'Europe/Paris'
  const week = hours.data ?? []
  const status = week.length ? openState(week, timeZone) : null
  const todayWeekday = workshopNow(timeZone).weekday
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
            <p className={styles.lede}>
              19 rue de l'Industrie, à 10 minutes de Strasbourg centre. Parking devant l'atelier, salle d'attente
              avec café si vous préférez rester pendant la pose.
            </p>
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
                <div className={styles.hoursHead}>
                  <span className={`mono ${styles.addressLabel}`}>Horaires</span>
                  {status && (
                    <span className={`mono ${styles.hoursStatus} ${status.open ? styles.hoursStatusOpen : styles.hoursStatusShut}`}>
                      <span className={styles.hoursStatusDot} aria-hidden />
                      {status.open ? 'Ouvert' : 'Fermé'}
                      {status.detail ? ` · ${status.detail}` : ''}
                    </span>
                  )}
                </div>

                {hours.isPending ? (
                  <div className={styles.hoursList} aria-hidden>
                    {DAYS.map((d) => (
                      <div key={d} className={styles.hoursSkeleton} />
                    ))}
                  </div>
                ) : week.length === 0 ? (
                  <p className={styles.hoursFallback}>
                    Horaires momentanément indisponibles — appelez-nous au{' '}
                    <a className="navlink mono" href={`tel:${phone.replace(/\s/g, '')}`}>
                      {phone}
                    </a>
                    .
                  </p>
                ) : (
                  <div className={styles.hoursList}>
                    {DAYS.map((label, i) => {
                      const day = week.find((h) => h.weekday === i + 1)
                      const open = Boolean(day?.isOpen && day.openTime && day.closeTime)
                      const isToday = todayWeekday === i + 1
                      return (
                        <div key={label} className={`${styles.hoursRow} ${isToday ? styles.hoursRowToday : ''}`}>
                          <span>
                            {label}
                            {isToday && <span className={`mono ${styles.hoursToday}`}>aujourd'hui</span>}
                          </span>
                          <span className="mono" style={{ color: open ? 'var(--text-soft)' : 'var(--text-faint)' }}>
                            {open ? `${day!.openTime} – ${day!.closeTime}` : 'Fermé'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
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
