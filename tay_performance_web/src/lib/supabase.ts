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
  INVALID_CONTACT: 'Renseignez votre nom, votre téléphone et votre e-mail.',
  BOOKER_CONTACT_REQUIRED: 'Renseignez aussi vos propres coordonnées (nom, téléphone, e-mail).',
  EMAIL_REQUIRED: 'Une adresse e-mail valide est requise.',
  PHONE_REQUIRED: 'Un numéro de téléphone valide est requis.',
  INVALID_INPUT: 'Décrivez votre véhicule (3 caractères minimum).',
  NOT_FOUND: 'Introuvable.',
  FORBIDDEN: 'Accès refusé.',
}

export function errorMessage(e: unknown): string {
  // always keep the raw error inspectable — a mapped French toast must never
  // hide the real cause from the console
  console.error('[tay] error:', e)

  const raw =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e)
  for (const code of Object.keys(ERROR_COPY)) {
    if (raw.includes(code)) return ERROR_COPY[code]
  }

  // auth-layer failures (signInAnonymously / OTP) — not part of the RPC vocabulary
  const lower = raw.toLowerCase()
  const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0
  if (lower.includes('captcha')) {
    return 'Vérification anti-robot activée côté serveur — contactez-nous ou réessayez plus tard.'
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Trop de tentatives depuis votre connexion — patientez quelques minutes puis réessayez.'
  }
  if (lower.includes('anonymous') && (lower.includes('disabled') || lower.includes('not enabled'))) {
    // ops misconfiguration, not a user error: the hosted project must enable
    // Authentication → Sign In/Providers → "Allow anonymous sign-ins"
    return "Réservation momentanément indisponible (config serveur : sessions anonymes désactivées)."
  }
  if (lower.includes('signup') && lower.includes('disabled')) {
    return 'Création de session désactivée côté serveur — contactez-nous.'
  }
  if (status >= 500 || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Connexion au serveur impossible — vérifiez votre réseau et réessayez.'
  }
  return 'Une erreur est survenue. Réessayez.'
}
