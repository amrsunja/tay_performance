/* Single source of truth for public identity: canonical URL, developer credit, SEO copy.
   ⚠ SITE_URL must match the production domain — also mirrored in public/sitemap.xml + public/robots.txt. */

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || 'https://tayperformance.fr'

export const SITE_NAME = 'Tay Performance'
export const SITE_TAGLINE = 'Vitres teintées, covering & detailing à Strasbourg / Illkirch-Graffenstaden'

export const DEFAULT_DESCRIPTION =
  'Tay Performance — pose professionnelle de vitres teintées sur-mesure à Strasbourg (Illkirch-Graffenstaden, 67400). ' +
  'Films teintés 5 % à 70 % TLV, covering, sellerie, detailing, éclairage intérieur. Réservation en ligne, conformité réglementation française, garantie.'

/** Cities used for local SEO copy (Eurométropole de Strasbourg). */
export const SERVICE_AREA = ['Strasbourg', 'Illkirch-Graffenstaden', 'Schiltigheim', 'Lingolsheim', 'Ostwald', 'Geispolsheim', 'Bas-Rhin (67)'] as const

/* ---------- developer credit ---------- */

export const DEVELOPER = {
  name: 'Amir Azdoyev',
  short: 'Amir EI',
  role: 'Développeur Flutter / React / Supabase',
  url: 'https://amirazdoyev.framer.website/',
} as const

type UtmContent = 'footer' | 'booking-confirm' | 'meta'

/** Portfolio link with attribution (UTM params land in Framer / GA analytics). */
export function portfolioUrl(content: UtmContent, contact = false): string {
  const u = new URL(DEVELOPER.url)
  u.searchParams.set('utm_source', 'tayperformance')
  u.searchParams.set('utm_medium', 'referral')
  u.searchParams.set('utm_campaign', 'dev-credit')
  u.searchParams.set('utm_content', content)
  if (contact) u.hash = 'contact'
  return u.toString()
}
