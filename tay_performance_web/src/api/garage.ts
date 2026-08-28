/* My Garage: the client's saved vehicles. */
import { supabase } from '../lib/supabase'
import type { GarageVehicle } from '../types/api'
import type { BodyStyleCode } from '../types/domain'
import { badgeFor, generationYears } from './taxonomy'

interface VehicleSelectRow {
  id: string
  variant_id: string
  year: number | null
  color: string | null
  plate: string | null
  nickname: string | null
  vehicle_variants: {
    body_style_code: string
    base_labor_minutes: number
    body_styles: { label_fr: string } | null
    generations: { name: string; year_start: number; year_end: number | null; models: { name: string; makes: { name: string } | null } | null } | null
  } | null
}

const VEHICLE_SELECT = `id, variant_id, year, color, plate, nickname,
  vehicle_variants(body_style_code, base_labor_minutes, body_styles(label_fr),
    generations(name, year_start, year_end, models(name, makes(name))))`

function mapVehicle(v: VehicleSelectRow): GarageVehicle {
  const chain = v.vehicle_variants
  const model = chain?.generations?.models?.name ?? ''
  return {
    vehicleId: v.id,
    variantId: v.variant_id,
    baseLaborMinutes: Number(chain?.base_labor_minutes ?? 0),
    make: chain?.generations?.models?.makes?.name ?? '',
    model,
    generation: chain?.generations?.name ?? '',
    bodyStyle: (chain?.body_style_code ?? 'berline_4p') as BodyStyleCode,
    bodyLabel: chain?.body_styles?.label_fr ?? '',
    years: chain?.generations
      ? generationYears({ yearStart: chain.generations.year_start == null ? null : Number(chain.generations.year_start), yearEnd: chain.generations.year_end == null ? null : Number(chain.generations.year_end) })
      : '',
    badge: badgeFor(model),
    year: v.year ?? undefined,
    nickname: v.nickname ?? undefined,
    plate: v.plate ?? undefined,
    color: v.color ?? undefined,
  }
}

export async function getMyVehicles(): Promise<GarageVehicle[]> {
  const { data, error } = await supabase.from('vehicles').select(VEHICLE_SELECT).order('created_at')
  if (error) throw error
  return ((data ?? []) as unknown as VehicleSelectRow[]).map(mapVehicle)
}

export interface VehicleInput {
  variantId: string
  year?: number | null
  color?: string | null
  plate?: string | null
  nickname?: string | null
}

export async function addVehicle(userId: string, input: VehicleInput): Promise<void> {
  const { error } = await supabase.from('vehicles').insert({
    user_id: userId,
    variant_id: input.variantId,
    year: input.year ?? null,
    color: input.color ?? null,
    plate: input.plate ?? null,
    nickname: input.nickname ?? null,
  })
  if (error) throw error
}

export async function updateVehicle(vehicleId: string, patch: Omit<VehicleInput, 'variantId'>): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({
      year: patch.year ?? null,
      color: patch.color ?? null,
      plate: patch.plate ?? null,
      nickname: patch.nickname ?? null,
    })
    .eq('id', vehicleId)
  if (error) throw error
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
  if (error) throw error
}
