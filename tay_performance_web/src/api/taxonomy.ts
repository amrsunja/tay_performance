/* Vehicle taxonomy: public funnel reads + admin CRUD. */
import { supabase } from '../lib/supabase'
import type { GenerationRow, MakeRow, ModelRow, ResolvedVehicle, VariantRow } from '../types/api'
import type { BodyStyleCode } from '../types/domain'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generationYears(g: { yearStart: number; yearEnd: number | null }): string {
  return g.yearEnd ? `${g.yearStart}–${g.yearEnd}` : `${g.yearStart}–présent`
}

export function badgeFor(model: string): string {
  const compact = model.replace(/[^A-Za-z0-9]/g, '')
  return (compact.length <= 3 ? compact : compact.slice(0, 2)).toUpperCase()
}

/* ---------- funnel reads ---------- */

export async function getMakes(): Promise<MakeRow[]> {
  const { data, error } = await supabase
    .from('makes')
    .select('id, name, slug, is_active, models(count)')
    .eq('is_active', true)
    .order('display_order')
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    slug: m.slug as string,
    isActive: Boolean(m.is_active),
    modelCount: Array.isArray(m.models) ? Number((m.models[0] as { count?: number })?.count ?? 0) : 0,
  }))
}

export async function getModels(makeId: string): Promise<ModelRow[]> {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('make_id', makeId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id as string,
    makeId: m.make_id as string,
    name: m.name as string,
    slug: m.slug as string,
    isActive: Boolean(m.is_active),
  }))
}

export async function getGenerations(modelId: string): Promise<GenerationRow[]> {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('model_id', modelId)
    .eq('is_active', true)
    .order('year_start', { ascending: false })
  if (error) throw error
  return (data ?? []).map((g) => ({
    id: g.id as string,
    modelId: g.model_id as string,
    name: g.name as string,
    yearStart: Number(g.year_start),
    yearEnd: g.year_end === null ? null : Number(g.year_end),
    isActive: Boolean(g.is_active),
  }))
}

export async function getVariants(generationId: string): Promise<VariantRow[]> {
  const { data, error } = await supabase
    .from('vehicle_variants')
    .select('*, body_styles(label_fr)')
    .eq('generation_id', generationId)
    .eq('is_active', true)
  if (error) throw error
  return (data ?? []).map((v) => ({
    id: v.id as string,
    generationId: v.generation_id as string,
    bodyStyle: v.body_style_code as BodyStyleCode,
    bodyLabelFr: ((v.body_styles as { label_fr?: string } | null)?.label_fr ?? v.body_style_code) as string,
    baseLaborMinutes: Number(v.base_labor_minutes),
    notes: (v.notes as string | null) ?? null,
    isActive: Boolean(v.is_active),
  }))
}

/** Recent variants with the full chain label — admin list. */
export async function getRecentVariants(): Promise<VariantRow[]> {
  const { data, error } = await supabase
    .from('vehicle_variants')
    .select('*, body_styles(label_fr), generations(name, year_start, year_end, models(name, makes(name)))')
    .order('is_active', { ascending: false })
    .limit(40)
  if (error) throw error
  return (data ?? []).map((v) => {
    const gen = v.generations as {
      name?: string
      year_start?: number
      year_end?: number | null
      models?: { name?: string; makes?: { name?: string } | null } | null
    } | null
    const years = gen
      ? generationYears({ yearStart: Number(gen.year_start), yearEnd: gen.year_end == null ? null : Number(gen.year_end) })
      : ''
    return {
      id: v.id as string,
      generationId: v.generation_id as string,
      bodyStyle: v.body_style_code as BodyStyleCode,
      bodyLabelFr: ((v.body_styles as { label_fr?: string } | null)?.label_fr ?? v.body_style_code) as string,
      baseLaborMinutes: Number(v.base_labor_minutes),
      notes: (v.notes as string | null) ?? null,
      isActive: Boolean(v.is_active),
      chainLabel: gen
        ? `${gen.models?.makes?.name ?? ''} ${gen.models?.name ?? ''} · ${gen.name} (${years})`
        : (v.id as string),
    }
  })
}

/** Load one variant with its display chain — used to hydrate a draft from a garage vehicle or URL. */
export async function resolveVariant(variantId: string): Promise<ResolvedVehicle | null> {
  const { data, error } = await supabase
    .from('vehicle_variants')
    .select('*, body_styles(label_fr), generations(name, year_start, year_end, models(name, makes(name)))')
    .eq('id', variantId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const gen = data.generations as {
    name?: string
    year_start?: number
    year_end?: number | null
    models?: { name?: string; makes?: { name?: string } | null } | null
  } | null
  const model = gen?.models?.name ?? ''
  return {
    variantId: data.id as string,
    baseLaborMinutes: Number(data.base_labor_minutes),
    make: gen?.models?.makes?.name ?? '',
    model,
    generation: gen?.name ?? '',
    bodyStyle: data.body_style_code as BodyStyleCode,
    bodyLabel: ((data.body_styles as { label_fr?: string } | null)?.label_fr ?? '') as string,
    years: gen
      ? generationYears({ yearStart: Number(gen.year_start), yearEnd: gen.year_end == null ? null : Number(gen.year_end) })
      : '',
    badge: badgeFor(model),
  }
}

/* ---------- vehicle requests (taxonomy gaps) ---------- */

export async function submitVehicleRequest(rawText: string, contactEmail: string | null, userId: string) {
  const { error } = await supabase.from('vehicle_requests').insert({
    user_id: userId,
    raw_text: rawText,
    contact_email: contactEmail,
  })
  if (error) throw error
}

/* ---------- admin CRUD ---------- */

export async function createMake(name: string) {
  const { error } = await supabase.from('makes').insert({ name, slug: slugify(name) })
  if (error) throw error
}

export async function createModel(makeId: string, name: string) {
  const { error } = await supabase.from('models').insert({ make_id: makeId, name, slug: slugify(name) })
  if (error) throw error
}

export async function createGeneration(modelId: string, name: string, yearStart: number, yearEnd: number | null) {
  const { error } = await supabase
    .from('generations')
    .insert({ model_id: modelId, name, year_start: yearStart, year_end: yearEnd })
  if (error) throw error
}

export async function createVariant(generationId: string, bodyStyle: BodyStyleCode, baseLaborMinutes: number, notes: string | null) {
  const { error } = await supabase.from('vehicle_variants').insert({
    generation_id: generationId,
    body_style_code: bodyStyle,
    base_labor_minutes: baseLaborMinutes,
    notes,
  })
  if (error) throw error
}

export async function setVariantActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('vehicle_variants').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
