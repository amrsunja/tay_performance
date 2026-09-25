/* Own profile (the client record) — read + edit. */
import { supabase } from '../lib/supabase'
import { e164FromStored } from '../lib/phone'

export interface MyProfile {
  id: string
  fullName: string
  email: string
  phone: string
  isAnonymous: boolean
}

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_anonymous')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id as string,
    fullName: (data.full_name as string | null) ?? '',
    email: (data.email as string | null) ?? '',
    // auth-linked phones are stored without "+" — always hand E.164 to the UI
    phone: e164FromStored(data.phone as string | null) || ((data.phone as string | null) ?? ''),
    isAnonymous: Boolean(data.is_anonymous),
  }
}

export async function updateMyProfile(
  userId: string,
  patch: { fullName?: string; email?: string; phone?: string },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: patch.fullName?.trim() || null,
      email: patch.email?.trim() || null,
      phone: patch.phone?.trim() || null,
    })
    .eq('id', userId)
  if (error) throw error
}
