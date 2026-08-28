/* Own profile (the client record) — read + edit. */
import { supabase } from '../lib/supabase'

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
    phone: (data.phone as string | null) ?? '',
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
