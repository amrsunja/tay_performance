/* Workshop configuration: hours, blackouts, tunable settings, admin account. */
import { supabase } from '../lib/supabase'
import type { BlackoutRow, WorkshopHoursRow } from '../types/api'

/* The read lives in ./catalog (it is public, not admin-only) — re-exported here so
   the admin Config page keeps its single import surface. */
export { getWorkshopHours } from './catalog'

export async function saveWorkshopDay(day: WorkshopHoursRow): Promise<void> {
  const { error } = await supabase.from('workshop_hours').upsert({
    weekday: day.weekday,
    is_open: day.isOpen,
    open_time: day.isOpen ? day.openTime : null,
    close_time: day.isOpen ? day.closeTime : null,
  })
  if (error) throw error
}

export async function getBlackouts(): Promise<BlackoutRow[]> {
  const { data, error } = await supabase
    .from('blackout_dates')
    .select('id, day, reason')
    .gte('day', new Date().toISOString().slice(0, 10))
    .order('day')
  if (error) throw error
  return (data ?? []).map((b) => ({ id: b.id as string, day: b.day as string, reason: b.reason as string }))
}

export async function addBlackout(day: string, reason: string, adminId: string): Promise<void> {
  const { error } = await supabase.from('blackout_dates').insert({ day, reason, created_by: adminId })
  if (error) throw error
}

export async function removeBlackout(id: string): Promise<void> {
  const { error } = await supabase.from('blackout_dates').delete().eq('id', id)
  if (error) throw error
}

export async function saveSetting(key: string, value: string | number, adminId: string): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({
    key,
    value: typeof value === 'number' ? String(value) : JSON.stringify(value),
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Phone that receives the admin SMS alerts — private table, a personal number must not be public (0023). */
export async function getAdminSmsPhone(): Promise<string> {
  const { data, error } = await supabase.from('private_settings').select('value').eq('key', 'admin_sms_phone').maybeSingle()
  if (error) throw error
  return (data?.value as string | undefined) ?? ''
}

/** '' removes it: alerts go back to the workshop's public number (app_settings.contact_phone). */
export async function saveAdminSmsPhone(phone: string, adminId: string): Promise<void> {
  const { error } = phone
    ? await supabase.from('private_settings').upsert({ key: 'admin_sms_phone', value: phone, updated_by: adminId, updated_at: new Date().toISOString() })
    : await supabase.from('private_settings').delete().eq('key', 'admin_sms_phone')
  if (error) throw error
}

/** Count of active future bookings that would fall outside a new closing window — conflict warning. */
export async function countFutureBookings(): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .gte('slot_start', new Date().toISOString())
    .in('status', ['requested', 'confirmed'])
  if (error) throw error
  return count ?? 0
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
