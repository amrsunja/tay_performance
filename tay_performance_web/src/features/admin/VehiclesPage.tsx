/* Admin — vehicle catalog: search any vehicle, edit the "surcoût pose" (minutes) per body
   style (defaults applied to every new variant) and per variant, save in one click. */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../../components/ui/Modal'
import VehicleFunnel, { MakeLogo } from '../booking/VehicleStep'
import {
  createGeneration,
  createMake,
  createModel,
  generationLabel,
  getBodyStyles,
  getMakes,
  getRecentVariants,
  saveLaborMinutes,
  searchVehicles,
  setVariantActive,
} from '../../api/taxonomy'
import { listVehicleRequests, rejectVehicleRequest, resolveVehicleRequest } from '../../api/admin'
import { errorMessage } from '../../lib/supabase'
import { formatPhoneDisplay } from '../../lib/phone'
import type { ResolvedVehicle, VehicleRequestRow } from '../../types/api'
import type { BodyStyleCode } from '../../types/domain'
import styles from './admin.module.css'

type VariantEdit = { minutes: string; notes: string }

export default function VehiclesPage() {
  const queryClient = useQueryClient()
  const [resolving, setResolving] = useState<VehicleRequestRow | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [showMakes, setShowMakes] = useState(false)
  const [addingModel, setAddingModel] = useState(false)

  // dirty edits, keyed by body-style code / variant id
  const [bodyEdits, setBodyEdits] = useState<Record<string, string>>({})
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEdit>>({})
  const [saved, setSaved] = useState(false)

  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes })
  const bodyStyles = useQuery({ queryKey: ['taxonomy', 'body-styles'], queryFn: getBodyStyles })
  const recent = useQuery({ queryKey: ['taxonomy', 'recent-variants'], queryFn: getRecentVariants })
  const requests = useQuery({ queryKey: ['admin', 'vehicle-requests'], queryFn: listVehicleRequests })
  const search = useQuery({
    queryKey: ['taxonomy', 'search', dq],
    queryFn: () => searchVehicles(dq, 40),
    enabled: dq.length >= 2,
    placeholderData: (prev) => prev,
  })

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

  const dirtyCount = Object.keys(bodyEdits).length + Object.keys(variantEdits).length

  const saveMutation = useMutation({
    mutationFn: () =>
      saveLaborMinutes({
        bodyDefaults: Object.entries(bodyEdits).map(([code, m]) => ({ code: code as BodyStyleCode, minutes: Number(m) || 0 })),
        variants: Object.entries(variantEdits).map(([id, e]) => ({ id, minutes: Number(e.minutes) || 0, notes: e.notes })),
      }),
    onSuccess: () => {
      setBodyEdits({})
      setVariantEdits({})
      setSaved(true)
      setError('')
      invalidateTaxonomy()
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (e) => setError(errorMessage(e)),
  })

  // flatten search hits → editable variant rows
  const searchRows = useMemo(
    () =>
      (search.data ?? []).flatMap((hit) =>
        hit.variants.map((v) => ({
          id: v.id,
          chain: `${hit.make} ${hit.model} · ${generationLabel(hit)}`,
          logoUrl: hit.logoUrl,
          make: hit.make,
          body: v.labelFr,
          minutes: v.baseLaborMinutes,
          notes: v.notes,
          isActive: true,
          generationId: hit.generationId,
          noVariants: false,
        })),
      ),
    [search.data],
  )
  const hitsWithoutVariants = (search.data ?? []).filter((h) => h.variants.length === 0)

  const editVariant = (id: string, base: { minutes: number; notes: string | null }, patch: Partial<VariantEdit>) =>
    setVariantEdits((m) => ({
      ...m,
      [id]: Object.assign({ minutes: String(base.minutes), notes: base.notes ?? '' }, m[id], patch),
    }))

  const rowEditor = (row: { id: string; minutes: number; notes: string | null }) => {
    const e = variantEdits[row.id]
    return (
      <>
        <td className={styles.tdNum}>
          <input
            className="field mono"
            inputMode="numeric"
            value={e?.minutes ?? String(row.minutes)}
            onChange={(ev) => editVariant(row.id, row, { minutes: ev.target.value.replace(/\D/g, '') })}
            style={{ width: 76, padding: '6px 8px', textAlign: 'right', borderColor: e ? 'var(--octane-500)' : undefined }}
            aria-label="Surcoût pose en minutes"
          />
        </td>
        <td>
          <input
            className="field"
            placeholder="note (ex : vitres sans cadre +10min)"
            value={e?.notes ?? row.notes ?? ''}
            onChange={(ev) => editVariant(row.id, row, { notes: ev.target.value })}
            style={{ padding: '6px 8px', fontSize: 12, minWidth: 180 }}
            aria-label="Note"
          />
        </td>
      </>
    )
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Catalogue véhicules</h1>
        <p className={styles.pageSub}>
          {makes.data?.length ?? '…'} marques · recherchez n'importe quel véhicule, ajustez le{' '}
          <span className="mono">surcoût (min)</span> par carrosserie ou par variante, puis <strong>Enregistrer</strong>.
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      {/* ---------- body-style defaults ---------- */}
      <div className={styles.blockHead}>
        <h2 className={`sat ${styles.blockTitle}`}>Surcoût par défaut par carrosserie</h2>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          appliqué à chaque nouvelle variante (recherche client / import)
        </span>
      </div>
      <div className={styles.makeGrid} style={{ marginBottom: 28 }}>
        {(bodyStyles.data ?? []).map((b) => {
          const edited = bodyEdits[b.code]
          return (
            <label key={b.code} className={styles.makeCard} style={{ gap: 8 }}>
              <span className={`sat ${styles.makeName}`}>{b.labelFr}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="field mono"
                  inputMode="numeric"
                  value={edited ?? String(b.defaultLaborMinutes)}
                  onChange={(e) => setBodyEdits((m) => ({ ...m, [b.code]: e.target.value.replace(/\D/g, '') }))}
                  style={{ width: 72, padding: '6px 8px', textAlign: 'right', borderColor: edited !== undefined ? 'var(--octane-500)' : undefined }}
                  aria-label={`Surcoût ${b.labelFr}`}
                />
                <span className={`mono ${styles.makeCount}`}>min</span>
              </span>
            </label>
          )
        })}
      </div>

      {/* ---------- search + variants ---------- */}
      <div className={styles.blockHead}>
        <h2 className={`sat ${styles.blockTitle}`}>Variantes</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }} onClick={() => setAddingModel(true)}>
            + Modèle / génération
          </button>
          <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }} onClick={() => setShowMakes((s) => !s)}>
            {showMakes ? 'Masquer les marques' : 'Marques'}
          </button>
        </div>
      </div>
      {showMakes && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button type="button" className="ghost" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10 }} onClick={addMake}>
              + Marque
            </button>
          </div>
          <div className={styles.makeGrid}>
            {(makes.data ?? []).map((make) => (
              <button key={make.id} type="button" className={styles.makeCard} style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => { setQ(make.name); setDq(make.name) }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MakeLogo name={make.name} url={make.logoUrl} size={22} />
                  <span className={`sat ${styles.makeName}`}>{make.name}</span>
                </span>
                <span className={`mono ${styles.makeCount}`}>
                  {make.modelCount ?? 0} modèle{(make.modelCount ?? 0) > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setDq(q.trim())
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          className="field"
          placeholder="Rechercher un véhicule : « golf 7 », « classe c 2019 », « tesla »…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (e.target.value.trim().length === 0) setDq('')
          }}
          aria-label="Rechercher"
        />
        <button type="submit" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 10, whiteSpace: 'nowrap' }}>
          Rechercher
        </button>
      </form>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Carrosserie</th>
              <th className={styles.thNum}>Surcoût (min)</th>
              <th>Note</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {dq.length >= 2
              ? searchRows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.cellStrong}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <MakeLogo name={row.make} url={row.logoUrl} size={20} />
                        {row.chain}
                      </span>
                    </td>
                    <td>
                      <span className="chip">{row.body}</span>
                    </td>
                    {rowEditor(row)}
                    <td>
                      <span className="pill pill--success">
                        <span aria-hidden>✓</span> Actif
                      </span>
                    </td>
                  </tr>
                ))
              : (recent.data ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className={styles.cellStrong}>{v.chainLabel}</td>
                    <td>
                      <span className="chip">{v.bodyLabelFr}</span>
                    </td>
                    {rowEditor({ id: v.id, minutes: v.baseLaborMinutes, notes: v.notes })}
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
            {dq.length >= 2 && hitsWithoutVariants.map((h) => (
              <tr key={h.generationId}>
                <td className={styles.cellStrong}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MakeLogo name={h.make} url={h.logoUrl} size={20} />
                    {h.make} {h.model} · {generationLabel(h)}
                  </span>
                </td>
                <td colSpan={4} className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  aucune carrosserie référencée — créée au premier choix client (surcoût par défaut)
                </td>
              </tr>
            ))}
            {dq.length >= 2 && !search.isPending && searchRows.length === 0 && hitsWithoutVariants.length === 0 && (
              <tr>
                <td colSpan={5} className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Aucun véhicule pour « {dq} ».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- requests ---------- */}
      <div className={styles.blockHead} style={{ marginTop: 28 }}>
        <h2 className={`sat ${styles.blockTitle}`}>Demandes « je ne trouve pas mon véhicule »</h2>
      </div>
      <div className={styles.leadList}>
        {(requests.data ?? []).map((lead) => (
          <div key={lead.id} className={styles.leadCard}>
            <div>
              <div className={styles.cellStrong}>{lead.rawText}</div>
              <div className={`mono ${styles.leadMeta}`}>
                {lead.contactName ?? (lead.userId ? 'client rattaché' : 'anonyme')} · {lead.contactEmail ?? 'sans e-mail'} ·{' '}
                {lead.contactPhone ? (
                  <a className="navlink" href={`tel:${lead.contactPhone}`}>{formatPhoneDisplay(lead.contactPhone)}</a>
                ) : (
                  'sans téléphone'
                )}{' '}
                · {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(lead.createdAt))}
              </div>
            </div>
            {lead.status === 'new' ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9 }} onClick={() => setResolving(lead)}>
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

      {/* ---------- sticky save bar ---------- */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 24,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderRadius: 14,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface-2)',
          boxShadow: 'var(--shadow-glow)',
          zIndex: 5,
        }}
      >
        <span className="mono" style={{ fontSize: 13, color: dirtyCount ? 'var(--octane-300)' : 'var(--text-dim)' }}>
          {saved ? '✓ Enregistré' : dirtyCount ? `${dirtyCount} modification${dirtyCount > 1 ? 's' : ''} en attente` : 'Aucune modification'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirtyCount > 0 && (
            <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => { setBodyEdits({}); setVariantEdits({}) }}>
              Annuler
            </button>
          )}
          <button
            type="button"
            className="cta"
            style={{ fontSize: 14, padding: '11px 22px', borderRadius: 12 }}
            disabled={dirtyCount === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {addingModel && (
        <AddModelModal
          onClose={() => setAddingModel(false)}
          onCreated={(label) => {
            setAddingModel(false)
            invalidateTaxonomy()
            setQ(label)
            setDq(label)
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

function ResolveRequestModal({
  lead,
  onClose,
  onResolved,
}: {
  lead: VehicleRequestRow
  onClose: () => void
  onResolved: () => void
}) {
  const [picked, setPicked] = useState<ResolvedVehicle | null>(null)
  const [error, setError] = useState('')

  return (
    <Modal title="Résoudre la demande" wide onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-soft)' }}>« {lead.rawText} »</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
          Recherchez la variante correspondante (créez d'abord marque/modèle si besoin), puis rattachez-la.
        </p>
        {!picked ? (
          <VehicleFunnel compact hideRequest onResolved={setPicked} />
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="chip">
              {picked.make} {picked.generation} {picked.model} · {picked.bodyLabel}
            </span>
            <button type="button" className="navlink mono" style={{ fontSize: 12 }} onClick={() => setPicked(null)}>
              changer →
            </button>
          </div>
        )}
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }}
          disabled={!picked}
          onClick={() =>
            resolveVehicleRequest(lead.id, picked!.variantId)
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

/** Add a model (and its first generation) under an existing make — variants are then created
    lazily from the funnel, or here via the search table. */
function AddModelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (searchLabel: string) => void }) {
  const [makeId, setMakeId] = useState('')
  const [modelName, setModelName] = useState('')
  const [genName, setGenName] = useState('I')
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes })

  const submit = async () => {
    const make = (makes.data ?? []).find((m) => m.id === makeId)
    if (!make || !modelName.trim()) return
    setPending(true)
    setError('')
    try {
      const modelId = await createModel(makeId, modelName.trim())
      const ys = yearStart.trim() === '' ? null : Number(yearStart)
      const ye = yearEnd.trim() === '' ? null : Number(yearEnd)
      await createGeneration(modelId, genName.trim() || 'I', ys, ye)
      onCreated(`${make.name} ${modelName.trim()}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="Nouveau modèle" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <select className="field" value={makeId} onChange={(e) => setMakeId(e.target.value)} aria-label="Marque">
          <option value="">Marque…</option>
          {(makes.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input className="field" placeholder="Nom du modèle (ex : A110) *" value={modelName} onChange={(e) => setModelName(e.target.value)} />
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <input className="field" placeholder="Génération (ex : II)" value={genName} onChange={(e) => setGenName(e.target.value)} />
          <input className="field mono" placeholder="Année début" inputMode="numeric" value={yearStart} onChange={(e) => setYearStart(e.target.value.replace(/\D/g, ''))} />
          <input className="field mono" placeholder="Année fin (vide = en cours)" inputMode="numeric" value={yearEnd} onChange={(e) => setYearEnd(e.target.value.replace(/\D/g, ''))} />
        </div>
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }}
          disabled={!makeId || !modelName.trim() || pending}
          onClick={submit}
        >
          {pending ? 'Création…' : 'Créer'}
        </button>
      </div>
    </Modal>
  )
}
