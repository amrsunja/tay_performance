/* Admin panel data access: queue, agenda, lifecycle, notes, photos, warranty,
   clients, vehicle requests, manual booking. All admin-gated by RLS. */
import { supabase } from '../lib/supabase'
import type {
  AdminBookingRow,
  AdminClientRow,
  QuoteSpec,
  StatusHistoryRow,
  VehicleRequestRow,
} from '../types/api'
import type { BookingStatus, LegalFlag, TintZoneCode } from '../types/domain'

interface AdminBookingSelectRow {
  id: string
  reference: string
  slot_start: string
  slot_end: string
  duration_min: number
  status: string
  legal_flag: string
  price_total: number
  contact_name: string
  contact_phone: string
  contact_email: string | null
  client_notes: string | null
  user_id: string | null
  created_by_admin: boolean
  booking_tint_specs: { zone_code: string; vlt_percent: number; is_legal: boolean }[]
  vehicle_variants: {
    body_style_code: string
    body_styles: { label_fr: string } | null
    generations: { name: string; models: { name: string; makes: { name: string } | null } | null } | null
  } | null
}

const ADMIN_BOOKING_SELECT = `id, reference, slot_start, slot_end, duration_min, status, legal_flag,
  price_total, contact_name, contact_phone, contact_email, client_notes, user_id, created_by_admin,
  booking_tint_specs(zone_code, vlt_percent, is_legal),
  vehicle_variants(body_style_code, body_styles(label_fr),
    generations(name, models(name, makes(name))))`

function mapRow(b: AdminBookingSelectRow): AdminBookingRow {
  const chain = b.vehicle_variants
  const model = chain?.generations?.models?.name ?? ''
  const compact = model.replace(/[^A-Za-z0-9]/g, '')
  return {
    id: b.id,
    reference: b.reference,
    slotStart: b.slot_start,
    slotEnd: b.slot_end,
    durationMin: Number(b.duration_min),
    status: b.status as BookingStatus,
    legalFlag: b.legal_flag as LegalFlag,
    priceTotal: Number(b.price_total),
    contactName: b.contact_name,
    contactPhone: b.contact_phone,
    contactEmail: b.contact_email,
    clientNotes: b.client_notes,
    userId: b.user_id,
    vehicleLabel: `${chain?.generations?.models?.makes?.name ?? ''} ${chain?.generations?.name ?? ''} ${model}`.trim(),
    bodyLabel: chain?.body_styles?.label_fr ?? '',
    badge: (compact.length <= 3 ? compact : compact.slice(0, 2)).toUpperCase() || '—',
    createdByAdmin: Boolean(b.created_by_admin),
    specs: (b.booking_tint_specs ?? []).map((s) => ({
      zone: s.zone_code as TintZoneCode,
      vltPercent: Number(s.vlt_percent),
      isLegal: Boolean(s.is_legal),
    })),
  }
}

/** Bookings whose slot_start falls inside [fromISO, toISO). Cancelled excluded by default. */
export async function getBookingsBetween(fromISO: string, toISO: string, includeCancelled = false): Promise<AdminBookingRow[]> {
  let q = supabase
    .from('bookings')
    .select(ADMIN_BOOKING_SELECT)
    .gte('slot_start', fromISO)
    .lt('slot_start', toISO)
    .order('slot_start')
  if (!includeCancelled) q = q.not('status', 'in', '(cancelled)')
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as AdminBookingSelectRow[]).map(mapRow)
}

export async function getAdminBooking(id: string): Promise<AdminBookingRow | null> {
  const { data, error } = await supabase.from('bookings').select(ADMIN_BOOKING_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapRow(data as unknown as AdminBookingSelectRow) : null
}

export async function advanceStatus(bookingId: string, to: BookingStatus, note?: string): Promise<void> {
  const { error } = await supabase.rpc('set_booking_status', {
    p_booking_id: bookingId,
    p_status: to,
    p_note: note ?? null,
  })
  if (error) throw error
}

export async function getStatusHistory(bookingId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await supabase
    .from('booking_status_history')
    .select('from_status, to_status, changed_at, note')
    .eq('booking_id', bookingId)
    .order('changed_at')
  if (error) throw error
  return (data ?? []).map((h) => ({
    fromStatus: (h.from_status as BookingStatus | null) ?? null,
    toStatus: h.to_status as BookingStatus,
    changedAt: h.changed_at as string,
    note: (h.note as string | null) ?? null,
  }))
}

/* ---------- admin notes (client-invisible table) ---------- */

export async function getAdminNotes(bookingId: string): Promise<string> {
  const { data, error } = await supabase
    .from('booking_admin_notes')
    .select('notes')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  return (data?.notes as string | undefined) ?? ''
}

export async function saveAdminNotes(bookingId: string, notes: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from('booking_admin_notes')
    .upsert({ booking_id: bookingId, notes, updated_by: adminId, updated_at: new Date().toISOString() })
  if (error) throw error
}

/* ---------- photos ---------- */

export interface BookingPhoto {
  id: string
  kind: 'before' | 'after'
  path: string
}

export async function getBookingPhotos(bookingId: string): Promise<BookingPhoto[]> {
  const { data, error } = await supabase
    .from('booking_photos')
    .select('id, kind, storage_path')
    .eq('booking_id', bookingId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((p) => ({ id: p.id as string, kind: p.kind as 'before' | 'after', path: p.storage_path as string }))
}

export async function uploadBookingPhoto(bookingId: string, kind: 'before' | 'after', file: File, adminId: string): Promise<void> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `bookings/${bookingId}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from('booking-photos').upload(path, file, { upsert: false })
  if (upErr) throw upErr
  const { error } = await supabase.from('booking_photos').insert({
    booking_id: bookingId,
    kind,
    storage_path: path,
    created_by: adminId,
  })
  if (error) {
    await supabase.storage.from('booking-photos').remove([path]) // no orphan objects
    throw error
  }
}

export async function deleteBookingPhoto(photo: BookingPhoto): Promise<void> {
  const { error } = await supabase.from('booking_photos').delete().eq('id', photo.id)
  if (error) throw error
  await supabase.storage.from('booking-photos').remove([photo.path])
}

/* ---------- warranty ---------- */

export async function issueWarranty(bookingId: string, years: number, adminId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings_warranty')
    .upsert({ booking_id: bookingId, warranty_years: years, issued_by: adminId })
  if (error) throw error
}

/* ---------- clients ---------- */

export async function listClients(search: string): Promise<AdminClientRow[]> {
  const { data, error } = await supabase.rpc('admin_list_clients', { p_search: search || null })
  if (error) throw error
  return ((data ?? []) as {
    id: string; full_name: string | null; email: string | null; phone: string | null
    is_anonymous: boolean; vehicles_count: number; bookings_count: number
    last_visit: string | null; created_at: string
  }[]).map((c) => ({
    id: c.id,
    fullName: c.full_name,
    email: c.email,
    phone: c.phone,
    isAnonymous: Boolean(c.is_anonymous),
    vehiclesCount: Number(c.vehicles_count),
    bookingsCount: Number(c.bookings_count),
    lastVisit: c.last_visit,
    createdAt: c.created_at,
  }))
}

export async function updateClientProfile(id: string, patch: { fullName?: string; email?: string; phone?: string }): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: patch.fullName ?? null, email: patch.email ?? null, phone: patch.phone ?? null })
    .eq('id', id)
  if (error) throw error
}

export async function getClientBookings(userId: string): Promise<AdminBookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(ADMIN_BOOKING_SELECT)
    .eq('user_id', userId)
    .order('slot_start', { ascending: false })
    .limit(30)
  if (error) throw error
  return ((data ?? []) as unknown as AdminBookingSelectRow[]).map(mapRow)
}

/* ---------- vehicle requests ---------- */

export async function listVehicleRequests(): Promise<VehicleRequestRow[]> {
  const { data, error } = await supabase
    .from('vehicle_requests')
    .select('id, raw_text, contact_email, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    rawText: r.raw_text as string,
    contactEmail: (r.contact_email as string | null) ?? null,
    status: r.status as VehicleRequestRow['status'],
    createdAt: r.created_at as string,
  }))
}

export async function resolveVehicleRequest(requestId: string, variantId: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_vehicle_request', {
    p_request_id: requestId,
    p_variant_id: variantId,
  })
  if (error) throw error
}

export async function rejectVehicleRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_vehicle_request', { p_request_id: requestId })
  if (error) throw error
}

/* ---------- manual booking ---------- */

export interface AdminCreateBookingInput {
  variantId: string
  specs: QuoteSpec[]
  slotStartISO: string
  contactName: string
  contactPhone: string
  contactEmail?: string | null
  clientNotes?: string | null
  bay?: number
}

export async function adminCreateBooking(input: AdminCreateBookingInput): Promise<{ reference: string }> {
  const { data, error } = await supabase.rpc('admin_create_booking', {
    p_variant_id: input.variantId,
    p_specs: input.specs,
    p_slot_start: input.slotStartISO,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_contact_email: input.contactEmail ?? null,
    p_client_notes: input.clientNotes ?? null,
    p_bay: input.bay ?? 1,
    p_user_id: null,
    p_vehicle_id: null,
  })
  if (error) throw error
  return { reference: (data as { reference: string }).reference }
}

/* ---------- realtime ---------- */

/** Subscribe to booking changes (admin sees all rows through RLS). Returns unsubscribe. */
export function onBookingsChange(handler: () => void): () => void {
  const channel = supabase
    .channel('admin-bookings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, handler)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
