/* Client bookings: server quote, creation, my bookings, cancel, reschedule. */
import { supabase } from '../lib/supabase'
import type { CreatedBooking, MyBookingRow, QuoteSpec, ServerQuote } from '../types/api'
import type { BookingStatus, LegalFlag, TintZoneCode } from '../types/domain'

export async function quoteBooking(variantId: string, specs: QuoteSpec[]): Promise<ServerQuote> {
  const { data, error } = await supabase.rpc('quote_booking', {
    p_variant_id: variantId,
    p_specs: specs,
  })
  if (error) throw error
  const q = data as { variant_id: string; duration_min: number; compliant: boolean; specs: ServerQuote['specs']; breakdown: ServerQuote['breakdown'] }
  return { ...q, duration_min: Number(q.duration_min) }
}

export interface CreateBookingInput {
  holdId: string
  variantId: string
  vehicleId?: string | null
  specs: QuoteSpec[]
  contactName: string
  contactPhone: string
  contactEmail?: string | null
  clientNotes?: string | null
  ack: boolean
  /** when set, atomically cancels this old booking (reschedule flow) */
  rescheduleOf?: string | null
}

export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const args = {
    p_hold_id: input.holdId,
    p_variant_id: input.variantId,
    p_specs: input.specs,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_contact_email: input.contactEmail ?? null,
    p_client_notes: input.clientNotes ?? null,
    p_ack: input.ack,
    p_vehicle_id: input.vehicleId ?? null,
  }
  const { data, error } = input.rescheduleOf
    ? await supabase.rpc('reschedule_booking', { p_old_booking_id: input.rescheduleOf, ...args })
    : await supabase.rpc('create_booking', args)
  if (error) throw error
  return data as CreatedBooking
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_booking_client', {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

interface BookingSelectRow {
  id: string
  reference: string
  slot_start: string
  slot_end: string
  duration_min: number
  status: string
  legal_flag: string
  price_total: number
  client_notes: string | null
  variant_id: string
  booking_tint_specs: { zone_code: string; vlt_percent: number; price_delta: number; is_legal: boolean }[]
  bookings_warranty: { warranty_years: number } | null
  booking_photos: { kind: string; storage_path: string }[]
  vehicle_variants: {
    body_style_code: string
    body_styles: { label_fr: string } | null
    generations: { name: string; models: { name: string; makes: { name: string } | null } | null } | null
  } | null
}

const BOOKING_SELECT = `id, reference, slot_start, slot_end, duration_min, status, legal_flag,
  price_total, client_notes, variant_id,
  booking_tint_specs(zone_code, vlt_percent, price_delta, is_legal),
  bookings_warranty(warranty_years),
  booking_photos(kind, storage_path),
  vehicle_variants(body_style_code, body_styles(label_fr),
    generations(name, models(name, makes(name))))`

function mapBookingRow(b: BookingSelectRow): MyBookingRow {
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
    clientNotes: b.client_notes,
    variantId: b.variant_id,
    vehicleLabel: `${chain?.generations?.models?.makes?.name ?? ''} ${chain?.generations?.name ?? ''} ${model}`.trim(),
    bodyLabel: chain?.body_styles?.label_fr ?? '',
    badge: (compact.length <= 3 ? compact : compact.slice(0, 2)).toUpperCase() || '—',
    specs: (b.booking_tint_specs ?? []).map((s) => ({
      zone: s.zone_code as TintZoneCode,
      vltPercent: Number(s.vlt_percent),
      priceDelta: Number(s.price_delta),
      isLegal: Boolean(s.is_legal),
    })),
    warrantyYears: b.bookings_warranty ? Number(b.bookings_warranty.warranty_years) : null,
    photos: (b.booking_photos ?? []).map((p) => ({ kind: p.kind as 'before' | 'after', path: p.storage_path })),
  }
}

export async function getMyBookings(): Promise<MyBookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('slot_start', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as BookingSelectRow[]
  return rows.map(mapBookingRow)
}

export async function getMyBooking(id: string): Promise<MyBookingRow | null> {
  const { data, error } = await supabase.from('bookings').select(BOOKING_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapBookingRow(data as unknown as BookingSelectRow) : null
}

/** Signed URL for a private booking photo (1h). */
export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('booking-photos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
