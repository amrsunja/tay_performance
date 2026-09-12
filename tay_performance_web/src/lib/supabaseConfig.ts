/* ============================================================
   Public Supabase configuration — hardened against broken builds.

   The project URL and the publishable ("anon") key are PUBLIC by design:
   RLS + SECURITY DEFINER RPCs are the security boundary
   (docs/03_AUTH_AND_SECURITY.md). They are therefore checked in here as the
   canonical values, and the build-time env only *overrides* them when it is
   actually valid.

   Why this file exists — the production incident it fixes:
   the deployed bundle shipped
     HTTPS://FUQSWTANWIUZJZAKQHHN.SUPABASE.CO
     SB_PUBLISHABLE_YPARSX16QZTO-ENV0JZWPA_SUBTCSJI
   i.e. the host provider injected VITE_SUPABASE_* in UPPERCASE. API keys are
   case-sensitive, so every REST call answered
     401 {"message":"Invalid API key"}
   and the booking funnel rendered an empty catalog with no error at all.
   A mangled env value must never again be able to take the site down.
   ============================================================ */

const FALLBACK_URL = 'https://fuqswtanwiuzjzakqhhn.supabase.co'
const FALLBACK_KEY = 'sb_publishable_ypaRSx16qztO-env0jzWpA_suBtCSjI'

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^['"]+|['"]+$/g, '')
}

/** Publishable key (new format) or legacy JWT anon key. Case-sensitive on purpose. */
function isValidKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return false // never ship a service key
  return /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key) || /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)
}

/** Normalise the project URL: lowercase origin (supabase-js matches the host with a
    case-sensitive regex), no trailing slash. */
function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.replace(/\/+$/, ''))
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null
    url.hostname = url.hostname.toLowerCase()
    url.protocol = url.protocol.toLowerCase()
    return url.origin
  } catch {
    return null
  }
}

const envUrl = normalizeUrl(clean(import.meta.env.VITE_SUPABASE_URL))
const envKeyRaw = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)
const envKey = isValidKey(envKeyRaw) ? envKeyRaw : null

export const SUPABASE_URL = envUrl ?? FALLBACK_URL
export const SUPABASE_ANON_KEY = envKey ?? FALLBACK_KEY

/** True when the build env was unusable and the checked-in values took over. */
export const SUPABASE_CONFIG_FELL_BACK = !envUrl || !envKey

if (import.meta.env.PROD && SUPABASE_CONFIG_FELL_BACK) {
  console.warn(
    '[tay] VITE_SUPABASE_* from the build environment is missing or malformed ' +
      `(url ${envUrl ? 'ok' : 'invalid'}, key ${envKey ? 'ok' : 'invalid'}) — ` +
      'falling back to the checked-in public project config. ' +
      'Fix the deploy environment variables (they must keep their exact case).',
  )
}
