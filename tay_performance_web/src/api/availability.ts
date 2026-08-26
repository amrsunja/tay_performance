/* Server-truth availability + slot holds (docs/04 §6–7). */
import { supabase } from '../lib/supabase'
import type { DayAvailability, DayState, SlotHold, SlotInfo, SlotState } from '../types/api'

export async function getMonthAvailability(year: number, month1: number, durationMin: number): Promise<DayAvailability[]> {
  const { data, error } = await supabase.rpc('get_month_availability', {
    p_year: year,
    p_month: month1,
    p_duration_min: durationMin,
  })
  if (error) throw error
  return ((data ?? []) as { day: string; state: string; free_count: number }[]).map((d) => ({
    day: d.day,
    state: d.state as DayState,
    freeCount: Number(d.free_count),
  }))
}

export async function getDaySlots(dayISO: string, durationMin: number): Promise<SlotInfo[]> {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_day: dayISO,
    p_duration_min: durationMin,
  })
  if (error) throw error
  return ((data ?? []) as { slot_start: string; slot_end: string; bay_index: number; state: string }[]).map((s) => ({
    slotStart: s.slot_start,
    slotEnd: s.slot_end,
    bay: Number(s.bay_index),
    state: s.state as SlotState,
  }))
}

export async function holdSlot(slotStartISO: string, durationMin: number, bay = 1): Promise<SlotHold> {
  const { data, error } = await supabase.rpc('hold_slot', {
    p_slot_start: slotStartISO,
    p_duration_min: durationMin,
    p_bay: bay,
  })
  if (error) throw error
  const h = data as { hold_id: string; bay_index: number; slot_start: string; slot_end: string; expires_at: string }
  return { holdId: h.hold_id, bay: h.bay_index, slotStart: h.slot_start, slotEnd: h.slot_end, expiresAt: h.expires_at }
}

export async function releaseHold(): Promise<void> {
  await supabase.rpc('release_hold')
}
