/* Client auth: PHONE + SMS OTP only (no passwords, no magic email links).
   Two flows:
   - LINK    — an existing anonymous session adds a verified phone and becomes a
               real account IN PLACE (same user id, all bookings/vehicles kept):
               updateUser({ phone }) → verifyOtp type 'phone_change'.
   - SIGN-IN — no session (or switching device): signInWithOtp({ phone }) →
               verifyOtp type 'sms'. Creates the account on first use. */
import { supabase } from '../lib/supabase'

export { normalizePhone } from '../lib/phone'

export function isValidEmail(v: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
}

/* ---------- LINK: anonymous session → verified account (same user id) ---------- */

export async function sendLinkPhoneOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ phone })
  if (error) throw error
}

export async function verifyLinkPhoneOtp(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })
  if (error) throw error
  await supabase.auth.refreshSession() // pick up is_anonymous=false in the JWT
}

/* ---------- SIGN-IN / SIGN-UP: by phone OTP ---------- */

export async function sendSignInOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) throw error
}

export async function verifySignInOtp(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
}

/** "already registered" detection for the link flow → offer the sign-in path */
export function isPhoneTakenError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? '').toLowerCase()
  return msg.includes('already') && msg.includes('registered')
}
