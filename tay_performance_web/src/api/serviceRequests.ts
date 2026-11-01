/* Personalized reservations (« demandes de devis », 0023).
   Client: create / list own / cancel. Admin: list / confirm → real booking / decline. */
import { supabase } from '../lib/supabase'
import type { ServiceRequestRow, ServiceRequestStatus } from '../types/api'

interface RequestSelectRow {
  id: string
  reference: string
  user_id: string | null
  service_label: string
  vehicle_text: string | null
  message: string
  contact_name: string | null
  contact_phone: string
  contact_email: string
  status: string
  admin_reply: string | null
  created_at: string
  bookings: { id: string } | null
}

const REQUEST_SELECT = `id, reference, user_id, service_label, vehicle_text, message, contact_name, contact_phone,
  contact_email, status, admin_reply, created_at, bookings(id)`

function mapRequest(r: RequestSelectRow): ServiceRequestRow {
  return {
    id: r.id,
    reference: r.reference,
    userId: r.user_id,
    serviceLabel: r.service_label,
    vehicleText: r.vehicle_text,
    message: r.message,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    status: r.status as ServiceRequestStatus,
    adminReply: r.admin_reply,
    createdAt: r.created_at,
    bookingId: r.bookings?.id ?? null,
  }
}

/* ---------- client ---------- */

export interface CreateServiceRequestInput {
  serviceLabel: string
  message: string
  contactPhone: string
  contactEmail: string
  contactName?: string | null
  vehicle?: string | null
}

export async function createServiceRequest(input: CreateServiceRequestInput): Promise<{ id: string; reference: string }> {
  const { data, error } = await supabase.rpc('create_service_request', {
    p_service_label: input.serviceLabel,
    p_message: input.message,
    p_contact_phone: input.contactPhone,
    p_contact_email: input.contactEmail,
    p_contact_name: input.contactName?.trim() || null,
    p_vehicle: input.vehicle?.trim() || null,
  })
  if (error) throw error
  return data as { id: string; reference: string }
}

export async function cancelServiceRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_service_request', { p_request_id: requestId })
  if (error) throw error
}

/** RLS: own rows for a client, everything for an admin. */
export async function getServiceRequests(): Promise<ServiceRequestRow[]> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(REQUEST_SELECT)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return ((data ?? []) as unknown as RequestSelectRow[]).map(mapRequest)
}

/* ---------- admin ---------- */

export async function countNewServiceRequests(): Promise<number> {
  const { count, error } = await supabase
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')
  if (error) throw error
  return count ?? 0
}

export interface ConfirmServiceRequestInput {
  requestId: string
  title: string
  slotStartISO: string
  durationMin: number
  price?: number | null
  adminMessage?: string | null
  contactName?: string | null
  vehicle?: string | null
  allowOverlap?: boolean
}

export async function confirmServiceRequest(input: ConfirmServiceRequestInput): Promise<{ id: string; reference: string }> {
  const { data, error } = await supabase.rpc('admin_confirm_service_request', {
    p_request_id: input.requestId,
    p_title: input.title,
    p_slot_start: input.slotStartISO,
    p_duration_min: input.durationMin,
    p_price: input.price ?? null,
    p_admin_message: input.adminMessage?.trim() || null,
    p_contact_name: input.contactName?.trim() || null,
    p_vehicle: input.vehicle?.trim() || null,
    p_allow_overlap: input.allowOverlap ?? false,
  })
  if (error) throw error
  return data as { id: string; reference: string }
}

export async function declineServiceRequest(requestId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_decline_service_request', {
    p_request_id: requestId,
    p_reason: reason?.trim() || null,
  })
  if (error) throw error
}

export interface AdminCreateCustomBookingInput {
  title: string
  slotStartISO: string
  durationMin: number
  contactPhone: string
  contactName?: string | null
  contactEmail?: string | null
  clientNotes?: string | null
  vehicle?: string | null
  price?: number | null
  adminMessage?: string | null
  /** client picked from the list */
  userId?: string | null
  allowOverlap?: boolean
}

export async function adminCreateCustomBooking(input: AdminCreateCustomBookingInput): Promise<{ id: string; reference: string }> {
  const { data, error } = await supabase.rpc('admin_create_custom_booking', {
    p_title: input.title,
    p_slot_start: input.slotStartISO,
    p_duration_min: input.durationMin,
    p_contact_phone: input.contactPhone,
    p_contact_name: input.contactName?.trim() || null,
    p_contact_email: input.contactEmail?.trim() || null,
    p_client_notes: input.clientNotes?.trim() || null,
    p_vehicle: input.vehicle?.trim() || null,
    p_price: input.price ?? null,
    p_admin_message: input.adminMessage?.trim() || null,
    p_user_id: input.userId ?? null,
    p_allow_overlap: input.allowOverlap ?? false,
  })
  if (error) throw error
  return data as { id: string; reference: string }
}
