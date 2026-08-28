/* Vehicle taxonomy: public funnel reads + admin CRUD. */
import { supabase } from '../lib/supabase'
import type {
  BodyStyleRow,
  GenerationRow,
  MakeRow,
  ModelRow,
  ResolvedVehicle,
  VariantRow,
  VehicleSearchHit,
} from '../types/api'
import type { BodyStyleCode } from '../types/domain'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generationYears(g: { yearStart: number | null; yearEnd: number | null }): string {
  if (g.yearStart == null && g.yearEnd == null) return 'années n.c.'
  if (g.yearStart == null) return `…–${g.yearEnd}`
  return g.yearEnd ? `${g.yearStart}–${g.yearEnd}` : `${g.yearStart}–présent`
}

/** "VII (2012–2019)" — or just the years when the generation is only named by its years. */
export function generationLabel(
  g: { name?: string; generation?: string; yearStart: number | null; yearEnd: number | null },
): string {
  const name = g.name ?? g.generation ?? ''
  const years = generationYears(g)
  return name === years || name === 'Toutes années' || name === '' ? years : `${name} (${years})`
}

export function badgeFor(model: string): string {
  const compact = model.replace(/[^A-Za-z0-9]/g, '')
  return (compact.length <= 3 ? compact : compact.slice(0, 2)).toUpperCase()
}

/* ---------- funnel reads ---------- */

export async function getMakes(): Promise<MakeRow[]> {
  const { data, error } = await supabase
    .from('makes')
    .select('id, name, slug, logo_url, is_active, models(count)')
    .eq('is_active', true)
    .order('display_order')
    .order('name')
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    slug: m.slug as string,
    logoUrl: (m.logo_url as string | null) ?? null,
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
    yearStart: g.year_start === null ? null : Number(g.year_start),
    yearEnd: g.year_end === null ? null : Number(g.year_end),
    isActive: Boolean(g.is_active),
  }))
}

export async function getBodyStyles(): Promise<BodyStyleRow[]> {
  const { data, error } = await supabase
    .from('body_styles')
    .select('code, label_fr, size_class, display_order, default_labor_minutes')
    .order('display_order')
  if (error) throw error
  return (data ?? []).map((b) => ({
    code: b.code as BodyStyleCode,
    labelFr: b.label_fr as string,
    sizeClass: b.size_class as BodyStyleRow['sizeClass'],
    displayOrder: Number(b.display_order),
    defaultLaborMinutes: Number(b.default_labor_minutes),
  }))
}

/* ---------- search-first resolution ---------- */

interface SearchRpcRow {
  generation_id: string
  make_id: string
  make_name: string
  make_slug: string
  logo_url: string | null
  model_id: string
  model_name: string
  generation_name: string
  year_start: number | null
  year_end: number | null
  variants: { id: string; body_style: string; label_fr: string; base_labor_minutes: number; notes: string | null }[]
  score: number
}

export async function searchVehicles(q: string, limit = 24): Promise<VehicleSearchHit[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const { data, error } = await supabase.rpc('search_vehicles', { p_q: query, p_limit: limit })
  if (error) throw error
  return ((data ?? []) as SearchRpcRow[]).map((r) => ({
    generationId: r.generation_id,
    makeId: r.make_id,
    make: r.make_name,
    makeSlug: r.make_slug,
    logoUrl: r.logo_url,
    modelId: r.model_id,
    model: r.model_name,
    generation: r.generation_name,
    yearStart: r.year_start,
    yearEnd: r.year_end,
    variants: (r.variants ?? []).map((v) => ({
      id: v.id,
      bodyStyle: v.body_style as BodyStyleCode,
      labelFr: v.label_fr,
      baseLaborMinutes: Number(v.base_labor_minutes),
      notes: v.notes,
    })),
    score: Number(r.score),
  }))
}

/** Resolve (generation, body style) → variant, creating it with the body style's default surcoût if needed. */
export async function ensureVariant(
  generationId: string,
  bodyStyle: BodyStyleCode,
): Promise<{ id: string; baseLaborMinutes: number; labelFr: string; notes: string | null }> {
  const { data, error } = await supabase.rpc('ensure_variant', { p_generation_id: generationId, p_body_style: bodyStyle })
  if (error) throw error
  const v = data as { id: string; base_labor_minutes: number; label_fr: string; notes: string | null }
  return { id: v.id, baseLaborMinutes: Number(v.base_labor_minutes), labelFr: v.label_fr, notes: v.notes }
}

/** Build the funnel result from a search hit + a resolved variant. */
export function resolvedFromHit(
  hit: Pick<VehicleSearchHit, 'make' | 'model' | 'generation' | 'yearStart' | 'yearEnd'>,
  variant: { id: string; baseLaborMinutes: number; labelFr: string },
  bodyStyle: BodyStyleCode,
): ResolvedVehicle {
  return {
    variantId: variant.id,
    baseLaborMinutes: variant.baseLaborMinutes,
    make: hit.make,
    model: hit.model,
    generation: hit.generation,
    bodyStyle,
    bodyLabel: variant.labelFr,
    years: generationYears(hit),
    badge: badgeFor(hit.model),
  }
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
      ? generationYears({ yearStart: gen.year_start == null ? null : Number(gen.year_start), yearEnd: gen.year_end == null ? null : Number(gen.year_end) })
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
      ? generationYears({ yearStart: gen.year_start == null ? null : Number(gen.year_start), yearEnd: gen.year_end == null ? null : Number(gen.year_end) })
      : '',
    badge: badgeFor(model),
  }
}

/* ---------- vehicle requests (taxonomy gaps) ---------- */

/** Works with or without a session: a session attaches the request to the client (profile
    contact reused), otherwise name/e-mail/phone are mandatory (server enforces). */
export async function submitVehicleRequest(input: {
  rawText: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_vehicle_request', {
    p_raw_text: input.rawText,
    p_contact_name: input.contactName ?? null,
    p_contact_email: input.contactEmail ?? null,
    p_contact_phone: input.contactPhone ?? null,
  })
  if (error) throw error
  return data as string
}

/* ---------- admin CRUD ---------- */

export async function createMake(name: string) {
  const { error } = await supabase.from('makes').insert({ name, slug: slugify(name) })
  if (error) throw error
}

export async function createModel(makeId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('models')
    .insert({ make_id: makeId, name, slug: slugify(name) })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function createGeneration(modelId: string, name: string, yearStart: number | null, yearEnd: number | null) {
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

/** Bulk "Enregistrer" of the admin surcoût editor. */
export async function saveLaborMinutes(input: {
  bodyDefaults: { code: BodyStyleCode; minutes: number }[]
  variants: { id: string; minutes: number; notes?: string | null }[]
}): Promise<void> {
  const { error } = await supabase.rpc('admin_save_labor_minutes', {
    p_body_defaults: input.bodyDefaults,
    p_variants: input.variants,
  })
  if (error) throw error
}

export async function setVariantActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('vehicle_variants').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
