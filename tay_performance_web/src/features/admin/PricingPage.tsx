/* Admin — Tarifs (pricing v2, migration 0016):
   • pack prices per body style (arrière 3 vitres / avant 2 vitres / pare-brise) on a draft → publish
   • « sur devis » switch per body style (utilitaire, pick-up)
   • per-model special prices (Tesla Model 3 …), live immediately (outside the versions)
   • simulator: what the client will see for any body style / pack / model */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCatalog, listModelOverrides } from '../../api/catalog'
import {
  getDraftPricing,
  getPublishedInfo,
  publishPricing,
  saveBodyStyleFlags,
  saveModelPrices,
  updateDraftRule,
} from '../../api/pricingAdmin'
import { searchVehicles } from '../../api/taxonomy'
import { errorMessage } from '../../lib/supabase'
import type { ModelPriceOverride, PricingRuleInfo } from '../../types/api'
import type { BodyStyleCode, TintZoneCode } from '../../types/domain'
import { formatDuration, formatEuro, zoneMinutes, zonePrice } from '../booking/useBookingDraft'
import Icon from '../../components/ui/Icon'
import styles from './admin.module.css'

type PriceKey = 'rearPrice' | 'frontPrice' | 'windshieldPrice'
const PRICE_COLS: { key: PriceKey; label: string; hint: string }[] = [
  { key: 'rearPrice', label: 'Arrière (3 vitres)', hint: 'latérales + lunette' },
  { key: 'frontPrice', label: 'Avant (2 vitres)', hint: 'latérales avant' },
  { key: 'windshieldPrice', label: 'Pare-brise', hint: 'dès 180 € selon taille' },
]

const parseNum = (v: string) => Number(v.replace(',', '.').trim())
const parseNullable = (v: string): number | null => (v.trim() === '' ? null : parseNum(v))

export default function PricingPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const draft = useQuery({ queryKey: ['pricing', 'draft'], queryFn: getDraftPricing })
  const published = useQuery({ queryKey: ['pricing', 'published-info'], queryFn: getPublishedInfo })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 60_000 })
  const overrides = useQuery({ queryKey: ['pricing', 'model-overrides'], queryFn: listModelOverrides })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing'] })
    queryClient.invalidateQueries({ queryKey: ['catalog'] })
    queryClient.invalidateQueries({ queryKey: ['taxonomy'] })
  }

  const publishMutation = useMutation({
    mutationFn: () => publishPricing(draft.data!.versionId),
    onSuccess: () => {
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const saveRule = async (rule: PricingRuleInfo, key: PriceKey, raw: string) => {
    if (!draft.data) return
    const value = parseNum(raw)
    if (!Number.isFinite(value) || value < 0) {
      setError('Prix invalide.')
      return
    }
    try {
      await updateDraftRule(draft.data.versionId, rule.bodyStyle, {
        rearPrice: rule.rearPrice,
        frontPrice: rule.frontPrice,
        windshieldPrice: rule.windshieldPrice,
        [key]: value,
      })
      setError('')
      queryClient.invalidateQueries({ queryKey: ['pricing', 'draft'] })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const toggleOnRequest = async (code: BodyStyleCode, value: boolean) => {
    try {
      await saveBodyStyleFlags(code, { quoteOnRequest: value })
      setError('')
      invalidate()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Tarifs</h1>
        <p className={styles.pageSub}>
          <span className="mono">prix = arrière (3 vitres) + avant (2 vitres) + pare-brise, selon la carrosserie</span> — le
          niveau de teinte (TLV) ne change pas le prix. Les tarifs par carrosserie s'éditent sur un brouillon puis se publient ;
          les tarifs spéciaux par modèle et le mode « sur devis » sont appliqués immédiatement.
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      {/* ---------- per body style ---------- */}
      <div className={styles.blockHead}>
        <h2 className={`sat ${styles.blockTitle}`}>Base par carrosserie</h2>
        <span className={`mono ${styles.blockHint}`}>EUR TTC · brouillon (enregistré à la sortie du champ)</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Carrosserie</th>
              <th>Classe</th>
              <th className={styles.thNum}>Pose (min)</th>
              {PRICE_COLS.map((c) => (
                <th key={c.key} className={styles.thNum}>
                  <span className={styles.cellStack}>
                    <span>{c.label}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>{c.hint}</span>
                  </span>
                </th>
              ))}
              <th>Sur devis</th>
            </tr>
          </thead>
          <tbody>
            {(draft.data?.rules ?? []).map((rule) => (
              <tr key={rule.bodyStyle} style={rule.quoteOnRequest ? { opacity: 0.75 } : undefined}>
                <td className={styles.cellStrong}>{rule.labelFr}</td>
                <td>
                  <span className="chip">{rule.sizeClass}</span>
                </td>
                <td className={`mono ${styles.tdNum}`}>{rule.defaultLaborMinutes}</td>
                {PRICE_COLS.map((c) => (
                  <td key={c.key} className={styles.tdNum}>
                    <input
                      key={`${rule.bodyStyle}-${c.key}-${rule[c.key]}`}
                      className={`field mono ${styles.priceField}`}
                      defaultValue={rule[c.key]}
                      disabled={rule.quoteOnRequest}
                      aria-label={`${c.label} ${rule.labelFr}`}
                      onBlur={(e) => {
                        if (parseNum(e.target.value) !== rule[c.key]) saveRule(rule, c.key, e.target.value)
                      }}
                    />
                  </td>
                ))}
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} title="Le client réserve sans prix ; vous l'analysez, le rappelez et fixez le prix dans la réservation.">
                    <input
                      type="checkbox"
                      checked={rule.quoteOnRequest}
                      onChange={(e) => toggleOnRequest(rule.bodyStyle, e.target.checked)}
                      aria-label={`Sur devis ${rule.labelFr}`}
                    />
                    <span className="mono" style={{ fontSize: 11, color: rule.quoteOnRequest ? 'var(--octane-300)' : 'var(--text-dim)' }}>
                      {rule.quoteOnRequest ? 'prix après analyse' : '—'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
        Durée de pose : éditable dans <b>Catalogue véhicules</b> (par carrosserie et par variante). Le devis la répartit 60 %
        arrière / 40 % avant, + 40 min pour le pare-brise, arrondie au créneau de{' '}
        {catalog.data?.settings.slotGranularityMin ?? 30} min.
      </p>

      <div className={styles.saveRow}>
        <span className={`mono ${styles.blockHint}`}>
          Grille publiée :{' '}
          {published.data?.publishedAt
            ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
                new Date(published.data.publishedAt),
              )
            : '—'}
        </span>
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }}
          disabled={publishMutation.isPending || !draft.data}
          onClick={() => publishMutation.mutate()}
        >
          {publishMutation.isPending ? 'Publication…' : 'Publier la nouvelle grille'}
        </button>
      </div>

      {/* ---------- per-model overrides ---------- */}
      <ModelOverridesBlock
        overrides={overrides.data ?? []}
        onSaved={() => {
          setError('')
          invalidate()
        }}
        onError={(e) => setError(errorMessage(e))}
      />

      {/* ---------- simulator ---------- */}
      <SimulatorBlock rules={draft.data?.rules ?? []} overrides={overrides.data ?? []} />
    </div>
  )
}

/* ================================================================ */

function ModelOverridesBlock({
  overrides,
  onSaved,
  onError,
}: {
  overrides: ModelPriceOverride[]
  onSaved: () => void
  onError: (e: unknown) => void
}) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [pending, setPending] = useState<ModelPriceOverride | null>(null)
  const search = useQuery({
    queryKey: ['taxonomy', 'search', 'pricing', dq],
    queryFn: () => searchVehicles(dq, 20),
    enabled: dq.length >= 2,
  })
  // distinct models from the search hits
  const models = useMemo(() => {
    const seen = new Map<string, { modelId: string; makeName: string; modelName: string }>()
    for (const h of search.data ?? []) {
      if (!seen.has(h.modelId)) seen.set(h.modelId, { modelId: h.modelId, makeName: h.make, modelName: h.model })
    }
    return Array.from(seen.values()).filter((m) => !overrides.some((o) => o.modelId === m.modelId) && m.modelId !== pending?.modelId)
  }, [search.data, overrides, pending])

  const save = async (modelId: string, prices: { rearPrice: number | null; frontPrice: number | null; windshieldPrice: number | null }) => {
    try {
      await saveModelPrices(modelId, prices)
      setPending(null)
      onSaved()
    } catch (e) {
      onError(e)
    }
  }

  return (
    <>
      <div className={styles.blockHead} style={{ marginTop: 36 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Tarifs spéciaux par modèle</h2>
        <span className={`mono ${styles.blockHint}`}>ex : Tesla Model 3 · vide = tarif de la carrosserie · appliqué immédiatement</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Modèle</th>
              {PRICE_COLS.map((c) => (
                <th key={c.key} className={styles.thNum}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <OverrideRow key={o.modelId} value={o} onSave={(p) => save(o.modelId, p)} onRemove={() => save(o.modelId, { rearPrice: null, frontPrice: null, windshieldPrice: null })} />
            ))}
            {pending && (
              <OverrideRow key={pending.modelId} value={pending} onSave={(p) => save(pending.modelId, p)} onRemove={() => setPending(null)} />
            )}
            {overrides.length === 0 && !pending && (
              <tr>
                <td colSpan={5} className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Aucun tarif spécial — recherchez un modèle ci-dessous pour en ajouter un.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setDq(q.trim())
        }}
        style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}
      >
        <input
          className="field"
          placeholder="Ajouter un modèle : « tesla model y », « classe g »…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (e.target.value.trim().length === 0) setDq('')
          }}
          style={{ maxWidth: 360 }}
          aria-label="Rechercher un modèle"
        />
        <button type="submit" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 10 }}>
          Rechercher
        </button>
      </form>
      {dq.length >= 2 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {models.map((m) => (
            <button
              key={m.modelId}
              type="button"
              className="chip"
              onClick={() => {
                // new editable row; the first price typed saves the override
                setPending({ ...m, rearPrice: null, frontPrice: null, windshieldPrice: null })
                setDq('')
                setQ('')
              }}
            >
              + {m.makeName} {m.modelName}
            </button>
          ))}
          {!search.isPending && models.length === 0 && (
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucun modèle pour « {dq} ».</span>
          )}
        </div>
      )}
    </>
  )
}

function OverrideRow({
  value,
  onSave,
  onRemove,
}: {
  value: ModelPriceOverride
  onSave: (p: { rearPrice: number | null; frontPrice: number | null; windshieldPrice: number | null }) => void
  onRemove: () => void
}) {
  const commit = (key: PriceKey, raw: string) => {
    const next = parseNullable(raw)
    if (next !== null && (!Number.isFinite(next) || next < 0)) return
    if (next === value[key]) return
    onSave({ rearPrice: value.rearPrice, frontPrice: value.frontPrice, windshieldPrice: value.windshieldPrice, [key]: next })
  }
  return (
    <tr>
      <td className={styles.cellStrong}>
        {value.makeName} {value.modelName}
      </td>
      {PRICE_COLS.map((c) => (
        <td key={c.key} className={styles.tdNum}>
          <input
            key={`${value.modelId}-${c.key}-${value[c.key] ?? ''}`}
            className={`field mono ${styles.priceField}`}
            defaultValue={value[c.key] ?? ''}
            placeholder="—"
            aria-label={`${c.label} ${value.makeName} ${value.modelName}`}
            onBlur={(e) => commit(c.key, e.target.value)}
          />
        </td>
      ))}
      <td>
        <button type="button" className="navlink mono" style={{ fontSize: 12 }} onClick={onRemove}>
          retirer
        </button>
      </td>
    </tr>
  )
}

/* ================================================================ */

function SimulatorBlock({ rules, overrides }: { rules: PricingRuleInfo[]; overrides: ModelPriceOverride[] }) {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 60_000 })
  const [body, setBody] = useState<BodyStyleCode | ''>('')
  const [modelId, setModelId] = useState('')
  const [selected, setSelected] = useState<TintZoneCode[]>(['rear_sides', 'front_sides'])
  const [minutesInput, setMinutesInput] = useState('')

  const rule = rules.find((r) => r.bodyStyle === (body || rules[0]?.bodyStyle))
  const override = overrides.find((o) => o.modelId === modelId) ?? null
  const zones = catalog.data?.zones ?? []
  const gran = catalog.data?.settings.slotGranularityMin ?? 30
  const poseMinutes = minutesInput.trim() === '' ? (rule?.defaultLaborMinutes ?? 0) : Number(minutesInput) || 0

  const lines = zones
    .filter((z) => selected.includes(z.code))
    .map((z) => ({ zone: z, ...zonePrice(z, rule, override), minutes: zoneMinutes(z, poseMinutes) }))
  const raw = lines.reduce((s, l) => s + l.minutes, 0)
  const duration = lines.length ? Math.max(gran, Math.ceil(raw / gran) * gran) : 0
  const total = lines.reduce((s, l) => s + l.price, 0)

  const toggle = (code: TintZoneCode) => setSelected((s) => (s.includes(code) ? s.filter((z) => z !== code) : [...s, code]))

  return (
    <>
      <div className={styles.blockHead} style={{ marginTop: 36 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Simulateur — ce que verra le client</h2>
        <span className={`mono ${styles.blockHint}`}>calculé sur le brouillon ci-dessus (avant publication)</span>
      </div>
      <div className={styles.tableCard} style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Carrosserie
            <select className="field mono" value={body || rules[0]?.bodyStyle || ''} onChange={(e) => setBody(e.target.value as BodyStyleCode)} style={{ padding: '8px 10px' }}>
              {rules.map((r) => (
                <option key={r.bodyStyle} value={r.bodyStyle}>
                  {r.labelFr}
                  {r.quoteOnRequest ? ' (sur devis)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Modèle
            <select className="field mono" value={modelId} onChange={(e) => setModelId(e.target.value)} style={{ padding: '8px 10px' }}>
              <option value="">— tarif carrosserie —</option>
              {overrides.map((o) => (
                <option key={o.modelId} value={o.modelId}>
                  {o.makeName} {o.modelName}
                </option>
              ))}
            </select>
          </label>
          <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Pose (min)
            <input
              className={`field mono ${styles.priceField}`}
              inputMode="numeric"
              placeholder={String(rule?.defaultLaborMinutes ?? '')}
              value={minutesInput}
              onChange={(e) => setMinutesInput(e.target.value.replace(/\D/g, ''))}
              aria-label="Durée de pose simulée"
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {zones.map((z) => (
            <button key={z.code} type="button" className="chip" aria-pressed={selected.includes(z.code)} onClick={() => toggle(z.code)}>
              {z.labelFr}
            </button>
          ))}
        </div>
        <table className={styles.table} style={{ maxWidth: 560 }}>
          <tbody>
            {lines.map((l) => (
              <tr key={l.zone.code}>
                <td>{l.zone.labelFr}</td>
                <td className={`mono ${styles.tdNum}`}>{l.minutes} min</td>
                <td className={`mono ${styles.tdNum}`}>
                  {rule?.quoteOnRequest ? 'sur devis' : formatEuro(l.price)}
                  {l.overridden && (
                    <Icon name="star" size={11} style={{ display: 'inline-block', color: 'var(--octane-300)', marginLeft: 6 }} />
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td className={styles.cellStrong}>Total client</td>
              <td className={`mono ${styles.tdNum}`}>{formatDuration(duration)}</td>
              <td className={`mono ${styles.tdNum}`} style={{ fontSize: 16, color: 'var(--text-hi)' }}>
                {lines.length === 0 ? '—' : rule?.quoteOnRequest ? 'Sur devis' : formatEuro(total)}
              </td>
            </tr>
          </tbody>
        </table>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Étoile = tarif spécial du modèle · durée arrondie au créneau de {gran} min · 60 % arrière / 40 % avant (+ 40 min pare-brise)
        </span>
      </div>
    </>
  )
}
