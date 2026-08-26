import { createClient } from '@supabase/supabase-js'

/**
 * Single Supabase client for the whole app.
 * Only the anon key ever ships to the browser — RLS + SECURITY DEFINER RPCs
 * are the security boundary (docs/03_AUTH_AND_SECURITY.md).
 *
 * After running `supabase gen types typescript` you can parameterize this
 * client with the generated Database type for full end-to-end typing.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Fail loudly at boot — a silent missing env produces confusing 401s later.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // magic-link / email-confirm redirects
  },
})

/** Map RPC error messages (docs/04 §13 vocabulary) to French UI copy. */
const ERROR_COPY: Record<string, string> = {
  SLOT_TAKEN: "Ce créneau vient d'être pris — choisissez-en un autre.",
  HOLD_EXPIRED: 'Créneau expiré — sélectionnez à nouveau un horaire.',
  DURATION_CHANGED: 'La durée a changé — re-choisissez un créneau adapté.',
  CUTOFF_PASSED: 'Annulation impossible si près du rendez-vous — appelez-nous.',
  ILLEGAL_SPEC_REQUIRES_ACK: "Configuration non conforme — cochez l'acceptation explicite.",
  ILLEGAL_TRANSITION: 'Transition de statut impossible.',
  NO_PUBLISHED_PRICING: 'Aucune grille tarifaire publiée.',
  PRICING_INCOMPLETE: 'Grille tarifaire incomplète.',
  INVALID_SPECS: 'Configuration invalide.',
  INVALID_CONTACT: 'Renseignez au minimum votre nom et votre téléphone.',
  NOT_FOUND: 'Introuvable.',
  FORBIDDEN: 'Accès refusé.',
}

export function errorMessage(e: unknown): string {
  const raw =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e)
  for (const code of Object.keys(ERROR_COPY)) {
    if (raw.includes(code)) return ERROR_COPY[code]
  }
  return 'Une erreur est survenue. Réessayez.'
}
