import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../../components/ui/Modal'
import {
  createGeneration,
  createMake,
  createModel,
  createVariant,
  getGenerations,
  getMakes,
  getModels,
  getRecentVariants,
  setVariantActive,
} from '../../api/taxonomy'
import { listVehicleRequests, rejectVehicleRequest, resolveVehicleRequest } from '../../api/admin'
import { getCatalog } from '../../api/catalog'
import { errorMessage } from '../../lib/supabase'
import type { VehicleRequestRow } from '../../types/api'
import type { BodyStyleCode } from '../../types/domain'
import styles from './admin.module.css'

export default function VehiclesPage() {
  const queryClient = useQueryClient()
  const [addingVariant, setAddingVariant] = useState(false)
  const [resolving, setResolving] = useState<VehicleRequestRow | null>(null)
  const [error, setError] = useState('')

  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes })
  const variants = useQuery({ queryKey: ['taxonomy', 'recent-variants'], queryFn: getRecentVariants })
  const requests = useQuery({ queryKey: ['admin', 'vehicle-requests'], queryFn: listVehicleRequests })

  const invalidateTaxonomy = () => queryClient.invalidateQueries({ queryKey: ['taxonomy'] })

  const addMake = async () => {
    const name = window.prompt('Nom de la marque :')
    if (!name?.trim()) return
    try {
      await createMake(name.trim())
      invalidateTaxonomy()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setVariantActive(id, active),
    onSuccess: invalidateTaxonomy,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Taxonomie véhicules</h1>
        <p className={styles.pageSub}>
          Marque → modèle → génération → carrosserie. La feuille <span className="mono">variant</span> pilote prix et
          durée.
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      <div className={styles.twoCol}>
        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Marques</h2>
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }} onClick={addMake}>
              + Marque
            </button>
          </div>
          <div className={styles.makeGrid}>
            {(makes.data ?? []).map((make) => (
              <div key={make.id} className={styles.makeCard}>
                <span className={`sat ${styles.makeName}`}>{make.name}</span>
                <span className={`mono ${styles.makeCount}`}>
                  {make.modelCount ?? 0} modèle{(make.modelCount ?? 0) > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Demandes « je ne trouve pas mon véhicule »</h2>
          </div>
          <div className={styles.leadList}>
            {(requests.data ?? []).map((lead) => (
              <div key={lead.id} className={styles.leadCard}>
                <div>
                  <div className={styles.cellStrong}>{lead.rawText}</div>
                  <div className={`mono ${styles.leadMeta}`}>
                    {lead.contactEmail ?? 'sans e-mail'} ·{' '}
                    {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
                      new Date(lead.createdAt),
                    )}
                  </div>
                </div>
                {lead.status === 'new' ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9 }}
                      onClick={() => setResolving(lead)}
                    >
                      Résoudre
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Rejeter"
                      onClick={() =>
                        rejectVehicleRequest(lead.id)
                          .then(() => queryClient.invalidateQueries({ queryKey: ['admin', 'vehicle-requests'] }))
                          .catch((e) => setError(errorMessage(e)))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ) : lead.status === 'resolved' ? (
                  <span className="pill pill--success">
                    <span aria-hidden>✓</span> Résolu
                  </span>
                ) : (
                  <span className="pill pill--muted">
                    <span aria-hidden>—</span> Rejeté
                  </span>
                )}
              </div>
            ))}
            {!requests.isPending && (requests.data ?? []).length === 0 && (
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucune demande.</span>
            )}
          </div>
        </div>

        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Variantes récentes</h2>
            <button
              type="button"
              className="ghost"
              style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }}
              onClick={() => setAddingVariant(true)}
            >
              + Variante
            </button>
          </div>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Génération</th>
                  <th>Carrosserie</th>
                  <th className={styles.thNum}>Surcoût (min)</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {(variants.data ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className={styles.cellStrong}>{v.chainLabel}</td>
                    <td>
                      <span className="chip">{v.bodyLabelFr}</span>
                    </td>
                    <td className={`mono ${styles.tdNum}`}>{v.baseLaborMinutes}</td>
                    <td>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        title={v.isActive ? 'Cliquer pour masquer' : 'Cliquer pour activer'}
                        onClick={() => toggleMutation.mutate({ id: v.id, active: !v.isActive })}
                      >
                        {v.isActive ? (
                          <span className="pill pill--success">
                            <span aria-hidden>✓</span> Actif
                          </span>
                        ) : (
                          <span className="pill pill--muted">
                            <span aria-hidden>—</span> Masqué
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {addingVariant && (
        <AddVariantModal
          onClose={() => setAddingVariant(false)}
          onCreated={() => {
            setAddingVariant(false)
            invalidateTaxonomy()
          }}
        />
      )}

      {resolving && (
        <ResolveRequestModal
          lead={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            queryClient.invalidateQueries({ queryKey: ['admin', 'vehicle-requests'] })
          }}
        />
      )}
    </div>
  )
}

/** Chained selectors make → model → generation (+ inline creation at each level). */
function ChainSelector({
  onGeneration,
}: {
  onGeneration: (generationId: string | null) => void
}) {
  const queryClient = useQueryClient()
  const [makeId, setMakeId] = useState('')
  const [modelId, setModelId] = useState('')
  const [generationId, setGenerationId] = useState('')

  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes })
  const models = useQuery({
    queryKey: ['taxonomy', 'models', makeId],
    queryFn: () => getModels(makeId),
    enabled: Boolean(makeId),
  })
  const generations = useQuery({
    queryKey: ['taxonomy', 'generations', modelId],
    queryFn: () => getGenerations(modelId),
    enabled: Boolean(modelId),
  })

  const pick = (gen: string) => {
    setGenerationId(gen)
    onGeneration(gen || null)
  }

  const addModel = async () => {
    const name = window.prompt('Nom du modèle :')
    if (!name?.trim() || !makeId) return
    await createModel(makeId, name.trim())
    queryClient.invalidateQueries({ queryKey: ['taxonomy', 'models', makeId] })
  }

  const addGeneration = async () => {
    const name = window.prompt('Nom de la génération (ex : G20) :')
    if (!name?.trim() || !modelId) return
    const ys = Number(window.prompt('Année de début :') ?? '')
    if (!Number.isFinite(ys) || ys < 1950) return
    const yeRaw = window.prompt('Année de fin (vide = en cours) :') ?? ''
    const ye = yeRaw.trim() === '' ? null : Number(yeRaw)
    await createGeneration(modelId, name.trim(), ys, ye)
    queryClient.invalidateQueries({ queryKey: ['taxonomy', 'generations', modelId] })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <select
        className="field"
        value={makeId}
        onChange={(e) => {
          setMakeId(e.target.value)
          setModelId('')
          pick('')
        }}
        aria-label="Marque"
      >
        <option value="">Marque…</option>
        {(makes.data ?? []).map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      {makeId && (
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="field"
            style={{ flex: 1 }}
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value)
              pick('')
            }}
            aria-label="Modèle"
          >
            <option value="">Modèle…</option>
            {(models.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10 }} onClick={addModel}>
            + Modèle
          </button>
        </div>
      )}
      {modelId && (
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="field"
            style={{ flex: 1 }}
            value={generationId}
            onChange={(e) => pick(e.target.value)}
            aria-label="Génération"
          >
            <option value="">Génération…</option>
            {(generations.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.yearStart}–{g.yearEnd ?? 'présent'})
              </option>
            ))}
          </select>
          <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10 }} onClick={addGeneration}>
            + Génération
          </button>
        </div>
      )}
    </div>
  )
}

function AddVariantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [bodyStyle, setBodyStyle] = useState<BodyStyleCode>('berline_4p')
  const [minutes, setMinutes] = useState('15')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const catalog = useQuery({ queryKey: ['catalog-body-styles'], queryFn: getCatalog, staleTime: 5 * 60_000 })

  const submit = async () => {
    if (!generationId) return
    try {
      await createVariant(generationId, bodyStyle, Number(minutes) || 0, notes.trim() || null)
      onCreated()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal title="Nouvelle variante" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <ChainSelector onGeneration={setGenerationId} />
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <select className="field" value={bodyStyle} onChange={(e) => setBodyStyle(e.target.value as BodyStyleCode)} aria-label="Carrosserie">
            {Object.values(catalog.data?.rules ?? {}).map((r) => (
              <option key={r.bodyStyle} value={r.bodyStyle}>{r.labelFr}</option>
            ))}
          </select>
          <input
            className="field mono"
            placeholder="Surcoût pose (min)"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Surcoût pose en minutes"
          />
        </div>
        <input className="field" placeholder="Note (ex : vitres sans cadre +10min)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }}
          disabled={!generationId}
          onClick={submit}
        >
          Créer la variante
        </button>
      </div>
    </Modal>
  )
}

function ResolveRequestModal({
  lead,
  onClose,
  onResolved,
}: {
  lead: VehicleRequestRow
  onClose: () => void
  onResolved: () => void
}) {
  const [variantId, setVariantId] = useState('')
  const [error, setError] = useState('')
  const variants = useQuery({ queryKey: ['taxonomy', 'recent-variants'], queryFn: getRecentVariants })

  return (
    <Modal title="Résoudre la demande" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-soft)' }}>« {lead.rawText} »</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
          Créez d'abord la variante manquante (« + Variante »), puis rattachez-la ici.
        </p>
        <select className="field" value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-label="Variante">
          <option value="">Choisir la variante…</option>
          {(variants.data ?? [])
            .filter((v) => v.isActive)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.chainLabel} · {v.bodyLabelFr}
              </option>
            ))}
        </select>
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }}
          disabled={!variantId}
          onClick={() =>
            resolveVehicleRequest(lead.id, variantId)
              .then(onResolved)
              .catch((e) => setError(errorMessage(e)))
          }
        >
          Marquer résolu
        </button>
      </div>
    </Modal>
  )
}
