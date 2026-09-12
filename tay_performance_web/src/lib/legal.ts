/* Single source of truth for every legal / regulatory string on the site.
   Used by /mentions-legales, /confidentialite, /cgv, the footer and the JSON-LD.

   ⚠ CHAMPS À COMPLÉTER PAR L'EXPLOITANT (cherchez "À COMPLÉTER") — les mentions
   légales sont obligatoires (art. 6-III LCEN) et une donnée fausse engage la
   responsabilité de l'éditeur. Tant qu'un champ vaut TODO, il s'affiche en clair
   sur la page pour qu'on ne l'oublie pas. */

const TODO = (label: string) => `⚠ À COMPLÉTER : ${label}`

export const COMPANY = {
  /** Raison sociale telle qu'inscrite au registre. */
  legalName: 'Abdulla TOMOV',
  /** Forme juridique — ex. "Entrepreneur individuel", "SASU", "SARL". */
  legalForm: TODO('forme juridique (EI / SASU / SARL…)'),
  /** Nom commercial / enseigne. */
  tradeName: 'Tay Performance',
  /** Directeur de la publication (art. 6-III-1 LCEN). */
  publisher: 'Abdulla TOMOV',
  siren: '987 811 411',
  /** SIRET = SIREN + NIC (5 chiffres de l'établissement). */
  siret: TODO('SIRET complet — SIREN 987 811 411 + les 5 chiffres NIC'),
  /** TVA intracommunautaire, ou la mention de franchise en base. */
  vat: TODO('n° TVA intracommunautaire, ou "TVA non applicable, art. 293 B du CGI"'),
  /** Capital social — uniquement si société. Laisser null pour une EI. */
  capital: null as string | null,
  /** RCS ou Répertoire des Métiers + ville d'immatriculation. */
  registry: TODO('RCS ou Répertoire des Métiers + ville (ex. "RCS Strasbourg")'),
  /** Code APE / NAF. */
  ape: TODO('code APE / NAF'),
  address: {
    street: "19 Rue de l'Industrie",
    postalCode: '67400',
    city: 'Illkirch-Graffenstaden',
    country: 'France',
    full: "19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden, France",
  },
  phone: '06 05 50 50 28',
  phoneE164: '+33605505028',
  /** Adresse de contact publiée — obligatoire, doit être relevée. */
  email: TODO('adresse e-mail de contact publique (ex. contact@tayperformance.fr)'),
  /** Assurance RC professionnelle — obligatoire à mentionner pour un artisan. */
  insurance: TODO('assureur RC pro + n° de contrat + couverture géographique'),
} as const

export const HOST = {
  name: 'Hostinger International Ltd.',
  address: '61 Lordou Vironos Street, 6023 Larnaca, Chypre',
  phone: '+370 645 03378',
  url: 'https://www.hostinger.fr',
} as const

/** Sous-traitants qui touchent à des données personnelles (art. 28 RGPD). */
export const PROCESSORS = [
  {
    name: 'Supabase Inc.',
    role: 'Base de données, authentification et stockage des photos de prestation',
    location: 'Union européenne (région Francfort, Allemagne)',
    url: 'https://supabase.com/privacy',
  },
  {
    name: 'Hostinger International Ltd.',
    role: 'Hébergement du site',
    location: 'Union européenne',
    url: 'https://www.hostinger.fr/politique-de-confidentialite',
  },
  {
    name: 'Resend, Inc.',
    role: 'Envoi des e-mails de confirmation et de suivi de rendez-vous',
    location: 'États-Unis — clauses contractuelles types de la Commission européenne',
    url: 'https://resend.com/legal/privacy-policy',
  },
  {
    name: 'Twilio Inc.',
    role: 'Envoi des SMS de vérification du numéro de téléphone',
    location: 'États-Unis — clauses contractuelles types de la Commission européenne',
    url: 'https://www.twilio.com/legal/privacy',
  },
  {
    name: 'Google Ireland Ltd.',
    role: 'Carte Google Maps intégrée sur la page « Nous trouver »',
    location: 'Union européenne / États-Unis',
    url: 'https://policies.google.com/privacy',
  },
] as const

/** Durées de conservation affichées dans la politique de confidentialité. */
export const RETENTION = [
  ['Compte client et véhicules enregistrés', "Jusqu'à la suppression du compte, puis 3 ans sans nouvelle réservation"],
  ['Réservations et historique de prestation', "3 ans après la dernière prestation (prospection), 10 ans pour les pièces comptables (art. L123-22 du Code de commerce)"],
  ['Photos avant / après de la prestation', "3 ans après la prestation, sauf demande de suppression"],
  ['E-mail et téléphone de contact', "Le temps de la relation client, puis 3 ans"],
  ['Journaux techniques de connexion', '12 mois'],
] as const

/** Date de dernière révision — à bumper à chaque modification de fond. */
export const LEGAL_UPDATED = '12 septembre 2026'
export const LEGAL_UPDATED_ISO = '2026-09-12'

/** Médiateur de la consommation — obligatoire pour un pro vendant à des particuliers (art. L612-1 C. conso). */
export const MEDIATOR = {
  name: TODO('nom du médiateur de la consommation auquel vous avez adhéré'),
  url: TODO('site du médiateur'),
} as const

export function isTodo(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('⚠ À COMPLÉTER')
}
