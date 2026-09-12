/* Versioned pricing administration: clone published → draft, edit pack prices, publish.
   Per-model overrides live outside the versions (models.*_price_override). */
import { supabase } from '../lib/supabase'
import { rulesFromRows } from './catalog'
import type { DraftPricing } from '../types/api'
import type { BodyStyleCode } from '../types/domain'

export async function getDraftPricing(): Promise<DraftPricing> {
  const { data: versionId, error: cloneErr } = await supabase.rpc('clone_pricing_version')
  if (cloneErr) throw cloneErr

  const [rulesRes, stylesRes] = await Promise.all([
    supabase.from('pricing_rules').select('*').eq('version_id', versionId as string),
    supabase.from('body_styles').select('*').order('display_order'),
  ])
  if (rulesRes.error) throw rulesRes.error
  if (stylesRes.error) throw stylesRes.error

  return {
    versionId: versionId as string,
    rules: rulesFromRows(rulesRes.data as never, stylesRes.data as never),
  }
}

export async function updateDraftRule(
  versionId: string,
  bodyStyle: BodyStyleCode,
  prices: { rearPrice: number; frontPrice: number; windshieldPrice: number },
): Promise<void> {
  const { error } = await supabase
    .from('pricing_rules')
    .update({ rear_price: prices.rearPrice, front_price: prices.frontPrice, windshield_price: prices.windshieldPrice })
    .eq('version_id', versionId)
    .eq('body_style_code', bodyStyle)
  if (error) throw error
}

export async function saveBodyStyleFlags(code: BodyStyleCode, patch: { quoteOnRequest?: boolean }): Promise<void> {
  const { error } = await supabase
    .from('body_styles')
    .update({ ...(patch.quoteOnRequest !== undefined ? { quote_on_request: patch.quoteOnRequest } : {}) })
    .eq('code', code)
  if (error) throw error
}

export async function saveModelPrices(
  modelId: string,
  prices: { rearPrice: number | null; frontPrice: number | null; windshieldPrice: number | null },
): Promise<void> {
  const { error } = await supabase.rpc('admin_save_model_prices', {
    p_model_id: modelId,
    p_rear: prices.rearPrice,
    p_front: prices.frontPrice,
    p_windshield: prices.windshieldPrice,
  })
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
