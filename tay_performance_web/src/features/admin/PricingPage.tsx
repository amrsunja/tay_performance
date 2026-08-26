import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { getCatalog } from '../../api/catalog'
import {
  getDraftPricing,
  getPublishedInfo,
  publishPricing,
  updateDraftCell,
  updateDraftRule,
} from '../../api/pricingAdmin'
import { saveSetting } from '../../api/configAdmin'
import { errorMessage } from '../../lib/supabase'
import type { TintZoneCode } from '../../types/domain'
import styles from './admin.module.css'

export default function PricingPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const draft = useQuery({ queryKey: ['pricing', 'draft'], queryFn: getDraftPricing })
  const published = useQuery({ queryKey: ['pricing', 'published-info'], queryFn: getPublishedInfo })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing'] })
    queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }

  const publishMutation = useMutation({
    mutationFn: () => publishPricing(draft.data!.versionId),
    onSuccess: () => {
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const saveRule = async (bodyStyle: string, basePrice: string, laborRate: string) => {
    if (!draft.data) return
    try {
      await updateDraftRule(
        draft.data.versionId,
        bodyStyle as never,
        Number(basePrice.replace(',', '.')),
        Number(laborRate.replace(',', '.')),
      )
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const saveCell = async (zone: TintZoneCode, vlt: number, value: string) => {
    if (!draft.data) return
    try {
      await updateDraftCell(draft.data.versionId, zone, vlt, Number(value.replace(',', '.')))
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const saveLimo = async (key: 'limo_supplement' | 'limo_vlt_threshold', value: string) => {
    if (!session) return
    try {
      await saveSetting(key, Number(value.replace(',', '.')), session.user.id)
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const vltStops = catalog.data?.vltStops ?? [5, 20, 35, 50, 70, 85]
  const zones = catalog.data?.zones ?? []

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Matrice tarifaire</h1>
        <p className={styles.pageSub}>
          <span className="mono">total = base(carrosserie) + Σ delta(zone, VLT) + minutes × taux + film limousine</span>{' '}
          — édition sur brouillon, clients servis par la grille publiée.
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      <div className={styles.blockHead}>
        <h2 className={`sat ${styles.blockTitle}`}>Base par carrosserie</h2>
        <span className={`mono ${styles.blockHint}`}>EUR · brouillon (enregistré à la sortie du champ)</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Carrosserie</th>
              <th>Classe</th>
              <th className={styles.thNum}>Facteur vitrage</th>
              <th className={styles.thNum}>Base (€)</th>
              <th className={styles.thNum}>Taux main d'œuvre (€/min)</th>
            </tr>
          </thead>
          <tbody>
            {(draft.data?.rules ?? []).map((rule) => (
              <tr key={rule.bodyStyle}>
                <td className={styles.cellStrong}>{rule.labelFr}</td>
                <td>
                  <span className="chip">{rule.sizeClass}</span>
                </td>
                <td className={`mono ${styles.tdNum}`}>×{rule.glassFactor.toFixed(2)}</td>
                <td className={styles.tdNum}>
                  <input
                    className={`field mono ${styles.priceField}`}
                    defaultValue={rule.basePrice}
                    aria-label={`Base ${rule.labelFr}`}
                    onBlur={(e) => saveRule(rule.bodyStyle, e.target.value, String(rule.laborRatePerMin))}
                  />
                </td>
                <td className={styles.tdNum}>
                  <input
                    className={`field mono ${styles.priceField}`}
                    defaultValue={rule.laborRatePerMin.toFixed(2)}
                    aria-label={`Taux ${rule.labelFr}`}
                    onBlur={(e) => saveRule(rule.bodyStyle, String(rule.basePrice), e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.blockHead} style={{ marginTop: 32 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Delta par zone × VLT</h2>
        <span className={`mono ${styles.blockHint}`}>⚠ = interdit à l'avant (&lt;70% VLT) — vendable avec accord explicite client</span>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Zone</th>
              {vltStops.map((vlt) => (
                <th key={vlt} className={styles.thNum}>
                  <span className="mono">{vlt}%</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.code}>
                <td>
                  <span className={styles.cellStack}>
                    <span className={styles.cellStrong}>{zone.labelFr}</span>
                    <span
                      className={`chip ${zone.group === 'avant' ? 'chip--front' : 'chip--rear'}`}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {zone.group === 'avant' ? 'AVANT' : zone.group === 'arriere' ? 'ARRIÈRE' : 'OPTION'}
                    </span>
                  </span>
                </td>
                {vltStops.map((vlt) => {
                  const illegal = zone.isFront && vlt < 70
                  const value = draft.data?.grid[zone.code]?.[vlt]
                  return (
                    <td key={vlt} className={`mono ${styles.tdNum}`}>
                      <span className={illegal ? styles.illegalCell : undefined} title={illegal ? "Interdit à l'avant (<70% VLT)" : undefined}>
                        <input
                          className={`field mono ${styles.priceField}`}
                          defaultValue={value ?? 0}
                          aria-label={`${zone.labelFr} ${vlt}%`}
                          onBlur={(e) => saveCell(zone.code, vlt, e.target.value)}
                          style={{ width: 72 }}
                        />
                        {illegal ? ' ⚠' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.blockHead} style={{ marginTop: 32 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Film limousine</h2>
        <span className={`mono ${styles.blockHint}`}>supplément unique par pose quand un VLT ≤ seuil</span>
      </div>
      <div className={styles.tableCard} style={{ padding: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Supplément (€)
          <input
            className={`field mono ${styles.priceField}`}
            defaultValue={catalog.data?.settings.limoSupplement ?? 30}
            onBlur={(e) => saveLimo('limo_supplement', e.target.value)}
            aria-label="Supplément film limousine"
          />
        </label>
        <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Seuil VLT (≤)
          <input
            className={`field mono ${styles.priceField}`}
            defaultValue={catalog.data?.settings.limoVltThreshold ?? 20}
            onBlur={(e) => saveLimo('limo_vlt_threshold', e.target.value)}
            aria-label="Seuil VLT film limousine"
          />
        </label>
      </div>

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
    </div>
  )
}
