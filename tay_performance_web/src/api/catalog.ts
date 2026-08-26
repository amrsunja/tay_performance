/* Catalog reads: tint zones + published pricing grid + rules + settings.
   Public data (RLS: readable without a session). */
import { supabase } from '../lib/supabase'
import type { AppSettings, Catalog, CatalogZone, PricingRuleInfo } from '../types/api'
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
    limoVltThreshold: num('limo_vlt_threshold', 20),
    limoSupplement: num('limo_supplement', 30),
    minLeadTimeHours: num('min_lead_time_hours', 2),
    bookingHorizonDays: num('booking_horizon_days', 90),
    contactPhone: str('contact_phone', '06 05 50 50 28'),
    workshopAddress: str('workshop_address', "19 Rue de l'industrie, 67400 Illkirch-Graffenstaden"),
  }
}

export async function getCatalog(): Promise<Catalog> {
  const [zonesRes, vltRes, gridRes, versionRes, settingsRes, stylesRes] = await Promise.all([
    supabase.from('tint_zones').select('*').eq('is_active', true).order('display_order'),
    supabase.from('vlt_levels').select('*').eq('is_active', true).order('vlt_percent'),
    supabase.from('zone_pricing').select('zone_code, vlt_percent, price_delta'),
    supabase.from('pricing_rules').select('*'),
    supabase.from('app_settings').select('key, value'),
    supabase.from('body_styles').select('*').order('display_order'),
  ])
  const firstError =
    zonesRes.error ?? vltRes.error ?? gridRes.error ?? versionRes.error ?? settingsRes.error ?? stylesRes.error
  if (firstError) throw firstError

  const vltStops = (vltRes.data ?? []).map((v) => v.vlt_percent as number)

  const deltasByZone = new Map<string, Record<number, number>>()
  for (const row of gridRes.data ?? []) {
    const zone = row.zone_code as string
    if (!deltasByZone.has(zone)) deltasByZone.set(zone, {})
    deltasByZone.get(zone)![row.vlt_percent as number] = Number(row.price_delta)
  }

  const zones: CatalogZone[] = (zonesRes.data ?? []).map((z) => {
    const deltas = deltasByZone.get(z.code as string) ?? {}
    const displayVlt = vltStops.find((v) => v >= 35) ?? vltStops[0]
    return {
      code: z.code as TintZoneCode,
      labelFr: z.label_fr as string,
      detailFr: (z.detail_fr as string | null) ?? undefined,
      group: z.zone_group as ZoneGroup,
      isFront: Boolean(z.is_front),
      legallyRestricted: Boolean(z.legally_restricted),
      minutes: Number(z.base_minutes),
      displayOrder: Number(z.display_order),
      deltas,
      price: deltas[displayVlt] ?? Object.values(deltas)[0] ?? 0,
    }
  })

  const styleMeta = new Map(
    (stylesRes.data ?? []).map((s) => [
      s.code as string,
      { labelFr: s.label_fr as string, sizeClass: s.size_class as PricingRuleInfo['sizeClass'], glassFactor: Number(s.glass_surface_factor) },
    ]),
  )

  const rules: Partial<Record<BodyStyleCode, PricingRuleInfo>> = {}
  for (const r of versionRes.data ?? []) {
    const code = r.body_style_code as BodyStyleCode
    const meta = styleMeta.get(code)
    rules[code] = {
      bodyStyle: code,
      labelFr: meta?.labelFr ?? code,
      sizeClass: meta?.sizeClass ?? 'M',
      glassFactor: meta?.glassFactor ?? 1,
      basePrice: Number(r.base_price),
      laborRatePerMin: Number(r.labor_rate_per_min),
    }
  }

  return { zones, vltStops, rules, settings: settingsFromRows(settingsRes.data ?? []) }
}
