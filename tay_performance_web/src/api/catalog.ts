/* Catalog reads: tint zones + TLV levels + published pack prices per body style +
   per-model overrides + settings. Public data (RLS: readable without a session). */
import { supabase } from '../lib/supabase'
import type {
  AppSettings,
  Catalog,
  CatalogZone,
  ModelPriceOverride,
  PricingRuleInfo,
  WorkshopHoursRow,
} from '../types/api'
import type { BodyStyleCode, TintZoneCode, ZoneGroup } from '../types/domain'

function settingsFromRows(rows: { key: string; value: unknown }[]): AppSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const num = (k: string, d: number) => {
    const v = map.get(k)
    const n = typeof v === 'string' ? Number(v) : Number(v ?? d)
    return Number.isFinite(n) ? n : d
  }
  const str = (k: string, d: string) => {
    const v = map.get(k)
    return typeof v === 'string' ? v : d
  }
  return {
    timezone: str('timezone', 'Europe/Paris'),
    slotGranularityMin: num('slot_granularity_min', 30),
    bayCount: num('bay_count', 1),
    cancellationCutoffHours: num('cancellation_cutoff_hours', 24),
    holdTtlMinutes: num('hold_ttl_minutes', 10),
    minLeadTimeHours: num('min_lead_time_hours', 2),
    bookingHorizonDays: num('booking_horizon_days', 90),
    contactPhone: str('contact_phone', '06 05 50 50 28'),
    workshopAddress: str('workshop_address', "19 Rue de l'industrie, 67400 Illkirch-Graffenstaden"),
  }
}

interface OverrideRpcRow {
  model_id: string
  make_name: string
  model_name: string
  rear_price: number | null
  front_price: number | null
  windshield_price: number | null
}

export function mapOverride(r: OverrideRpcRow): ModelPriceOverride {
  return {
    modelId: r.model_id,
    makeName: r.make_name,
    modelName: r.model_name,
    rearPrice: r.rear_price == null ? null : Number(r.rear_price),
    frontPrice: r.front_price == null ? null : Number(r.front_price),
    windshieldPrice: r.windshield_price == null ? null : Number(r.windshield_price),
  }
}

export async function listModelOverrides(): Promise<ModelPriceOverride[]> {
  const { data, error } = await supabase.rpc('list_model_price_overrides')
  if (error) throw error
  return ((data ?? []) as OverrideRpcRow[]).map(mapOverride)
}

type StyleRow = {
  code: string
  label_fr: string
  size_class: string
  display_order: number
  default_labor_minutes: number
  quote_on_request: boolean
}

export function rulesFromRows(
  ruleRows: { body_style_code: string; rear_price: number; front_price: number; windshield_price: number }[],
  styleRows: StyleRow[],
): PricingRuleInfo[] {
  const order = new Map(styleRows.map((s) => [s.code, Number(s.display_order)]))
  const meta = new Map(styleRows.map((s) => [s.code, s]))
  return ruleRows
    .map((r) => {
      const m = meta.get(r.body_style_code)
      return {
        bodyStyle: r.body_style_code as BodyStyleCode,
        labelFr: m?.label_fr ?? r.body_style_code,
        sizeClass: (m?.size_class ?? 'M') as PricingRuleInfo['sizeClass'],
        quoteOnRequest: Boolean(m?.quote_on_request),
        defaultLaborMinutes: Number(m?.default_labor_minutes ?? 0),
        rearPrice: Number(r.rear_price),
        frontPrice: Number(r.front_price),
        windshieldPrice: Number(r.windshield_price),
      }
    })
    .sort((a, b) => (order.get(a.bodyStyle) ?? 99) - (order.get(b.bodyStyle) ?? 99))
}

export async function getCatalog(): Promise<Catalog> {
  const [zonesRes, vltRes, rulesRes, settingsRes, stylesRes, overrides] = await Promise.all([
    supabase.from('tint_zones').select('*').eq('is_active', true).order('display_order'),
    supabase.from('vlt_levels').select('*').eq('is_active', true).order('vlt_percent'),
    supabase.from('pricing_rules').select('*'), // RLS: published version only
    supabase.from('app_settings').select('key, value'),
    supabase.from('body_styles').select('*').order('display_order'),
    listModelOverrides(),
  ])
  const firstError = zonesRes.error ?? vltRes.error ?? rulesRes.error ?? settingsRes.error ?? stylesRes.error
  if (firstError) throw firstError

  const vltStops = (vltRes.data ?? []).map((v) => v.vlt_percent as number)

  const zones: CatalogZone[] = (zonesRes.data ?? []).map((z) => ({
    code: z.code as TintZoneCode,
    labelFr: z.label_fr as string,
    detailFr: (z.detail_fr as string | null) ?? undefined,
    group: z.zone_group as ZoneGroup,
    isFront: Boolean(z.is_front),
    legallyRestricted: Boolean(z.legally_restricted),
    minutes: Number(z.base_minutes),
    timeSharePct: Number(z.time_share_pct ?? 0),
    displayOrder: Number(z.display_order),
  }))

  const rules: Partial<Record<BodyStyleCode, PricingRuleInfo>> = {}
  for (const r of rulesFromRows(
    (rulesRes.data ?? []) as { body_style_code: string; rear_price: number; front_price: number; windshield_price: number }[],
    (stylesRes.data ?? []) as StyleRow[],
  )) {
    rules[r.bodyStyle] = r
  }

  const modelOverrides: Record<string, ModelPriceOverride> = {}
  for (const o of overrides) modelOverrides[o.modelId] = o

  return { zones, vltStops, rules, modelOverrides, settings: settingsFromRows(settingsRes.data ?? []) }
}

/* ---------- opening hours ----------
   Public read: workshop_hours carries the `catalog read` RLS policy (anon +
   authenticated), so the public /adresse page renders exactly the rows the admin
   edits in Config → Horaires d'ouverture. weekday is ISO: 1 = lundi … 7 = dimanche.
   Missing rows are treated as closed by the callers. */
export async function getWorkshopHours(): Promise<WorkshopHoursRow[]> {
  const { data, error } = await supabase.from('workshop_hours').select('*').order('weekday')
  if (error) throw error
  return (data ?? []).map((h) => ({
    weekday: Number(h.weekday),
    isOpen: Boolean(h.is_open),
    openTime: (h.open_time as string | null)?.slice(0, 5) ?? null,
    closeTime: (h.close_time as string | null)?.slice(0, 5) ?? null,
  }))
}
