/* Versioned pricing administration: clone published → draft, edit cells, publish. */
import { supabase } from '../lib/supabase'
import type { DraftPricing, PricingRuleInfo } from '../types/api'
import type { BodyStyleCode, TintZoneCode } from '../types/domain'

export async function getDraftPricing(): Promise<DraftPricing> {
  const { data: versionId, error: cloneErr } = await supabase.rpc('clone_pricing_version')
  if (cloneErr) throw cloneErr

  const [rulesRes, gridRes, stylesRes] = await Promise.all([
    supabase.from('pricing_rules').select('*').eq('version_id', versionId as string),
    supabase.from('zone_pricing').select('*').eq('version_id', versionId as string),
    supabase.from('body_styles').select('*').order('display_order'),
  ])
  if (rulesRes.error) throw rulesRes.error
  if (gridRes.error) throw gridRes.error
  if (stylesRes.error) throw stylesRes.error

  const styleMeta = new Map(
    (stylesRes.data ?? []).map((s) => [
      s.code as string,
      { labelFr: s.label_fr as string, sizeClass: s.size_class as PricingRuleInfo['sizeClass'], glassFactor: Number(s.glass_surface_factor), order: Number(s.display_order) },
    ]),
  )

  const rules: PricingRuleInfo[] = (rulesRes.data ?? [])
    .map((r) => {
      const meta = styleMeta.get(r.body_style_code as string)
      return {
        bodyStyle: r.body_style_code as BodyStyleCode,
        labelFr: meta?.labelFr ?? (r.body_style_code as string),
        sizeClass: meta?.sizeClass ?? 'M',
        glassFactor: meta?.glassFactor ?? 1,
        basePrice: Number(r.base_price),
        laborRatePerMin: Number(r.labor_rate_per_min),
        order: meta?.order ?? 99,
      }
    })
    .sort((a, b) => (a as { order: number }).order - (b as { order: number }).order)

  const grid: DraftPricing['grid'] = {}
  for (const row of gridRes.data ?? []) {
    const zone = row.zone_code as string
    if (!grid[zone]) grid[zone] = {}
    grid[zone][row.vlt_percent as number] = Number(row.price_delta)
  }

  return { versionId: versionId as string, rules, grid }
}

export async function updateDraftRule(versionId: string, bodyStyle: BodyStyleCode, basePrice: number, laborRatePerMin: number): Promise<void> {
  const { error } = await supabase
    .from('pricing_rules')
    .update({ base_price: basePrice, labor_rate_per_min: laborRatePerMin })
    .eq('version_id', versionId)
    .eq('body_style_code', bodyStyle)
  if (error) throw error
}

export async function updateDraftCell(versionId: string, zone: TintZoneCode, vlt: number, delta: number): Promise<void> {
  const { error } = await supabase
    .from('zone_pricing')
    .update({ price_delta: delta })
    .eq('version_id', versionId)
    .eq('zone_code', zone)
    .eq('vlt_percent', vlt)
  if (error) throw error
}

export async function publishPricing(versionId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_pricing', { p_version_id: versionId })
  if (error) throw error
}

export async function getPublishedInfo(): Promise<{ publishedAt: string | null; label: string | null }> {
  const { data, error } = await supabase
    .from('pricing_versions')
    .select('published_at, label')
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return { publishedAt: (data?.published_at as string | null) ?? null, label: (data?.label as string | null) ?? null }
}
