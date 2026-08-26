/* Step 1 — vehicle resolution funnel: Make → Model → Generation → Body style.
   Emits a ResolvedVehicle (variant id + display chain). Reusable: also mounted
   in the Garage "add vehicle" modal and the admin manual-booking modal. */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import {
  badgeFor,
  generationYears,
  getGenerations,
  getMakes,
  getModels,
  getVariants,
  submitVehicleRequest,
} from '../../api/taxonomy'
import { errorMessage } from '../../lib/supabase'
import type { GenerationRow, MakeRow, ModelRow, ResolvedVehicle } from '../../types/api'
import styles from './vehicle.module.css'

interface VehicleFunnelProps {
  onResolved: (vehicle: ResolvedVehicle) => void
  compact?: boolean
}

export default function VehicleFunnel({ onResolved, compact }: VehicleFunnelProps) {
  const { ensureSession } = useAuth()
  const [make, setMake] = useState<MakeRow | null>(null)
  const [model, setModel] = useState<ModelRow | null>(null)
  const [generation, setGeneration] = useState<GenerationRow | null>(null)
  const [requestText, setRequestText] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [requestError, setRequestError] = useState('')

  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes })
  const models = useQuery({
    queryKey: ['taxonomy', 'models', make?.id],
    queryFn: () => getModels(make!.id),
    enabled: Boolean(make),
  })
  const generations = useQuery({
    queryKey: ['taxonomy', 'generations', model?.id],
    queryFn: () => getGenerations(model!.id),
    enabled: Boolean(model),
  })
  const variants = useQuery({
    queryKey: ['taxonomy', 'variants', generation?.id],
    queryFn: () => getVariants(generation!.id),
    enabled: Boolean(generation),
  })

  // auto-skip a single-generation model (docs/06 §1.1)
  const genList = generations.data ?? []
  const effectiveGeneration =
    generation ?? (model && !generations.isPending && genList.length === 1 ? genList[0] : null)
  if (model && !generation && effectiveGeneration) {
    setGeneration(effectiveGeneration)
  }

  const reset = (level: 'make' | 'model' | 'generation') => {
    if (level === 'make') {
      setMake(null)
      setModel(null)
      setGeneration(null)
    } else if (level === 'model') {
      setModel(null)
      setGeneration(null)
    } else {
      setGeneration(null)
    }
  }

  const sendRequest = async () => {
    if (requestText.trim().length < 3) return
    setRequestState('sending')
    try {
      const session = await ensureSession()
      await submitVehicleRequest(requestText.trim(), requestEmail.trim() || null, session.user.id)
      setRequestState('sent')
    } catch (e) {
      setRequestError(errorMessage(e))
      setRequestState('error')
    }
  }

  const skeletons = (n: number) => (
    <div className={styles.grid}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  )

  return (
    <div className={styles.wrap}>
      {/* breadcrumbs of selections */}
      {(make || model || generation) && (
        <div className={styles.crumbs}>
          {make && (
            <button type="button" className={styles.crumb} onClick={() => reset('make')}>
              {make.name} <span aria-hidden>✕</span>
            </button>
          )}
          {model && (
            <>
              <span className={styles.crumbSep}>›</span>
              <button type="button" className={styles.crumb} onClick={() => reset('model')}>
                {model.name} <span aria-hidden>✕</span>
              </button>
            </>
          )}
          {generation && genList.length > 1 && (
            <>
              <span className={styles.crumbSep}>›</span>
              <button type="button" className={styles.crumb} onClick={() => reset('generation')}>
                {generation.name} ({generationYears(generation)}) <span aria-hidden>✕</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* step 1: make */}
      {!make && (
        <>
          <div className={`sat ${styles.stepTitle}`}>Votre marque</div>
          {makes.isPending ? (
            skeletons(8)
          ) : (
            <div className={styles.grid}>
              {(makes.data ?? []).map((m) => (
                <button key={m.id} type="button" className={styles.card} onClick={() => setMake(m)}>
                  <span className={styles.cardName}>{m.name}</span>
                  <span className={`mono ${styles.cardMeta}`}>
                    {m.modelCount ?? 0} modèle{(m.modelCount ?? 0) > 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* step 2: model */}
      {make && !model && (
        <>
          <div className={`sat ${styles.stepTitle}`}>Votre modèle {make.name}</div>
          {models.isPending ? (
            skeletons(6)
          ) : (
            <div className={styles.grid}>
              {(models.data ?? []).map((m) => (
                <button key={m.id} type="button" className={styles.card} onClick={() => setModel(m)}>
                  <span className={styles.cardName}>{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* step 3: generation (skipped when unique) */}
      {model && !generation && genList.length > 1 && (
        <>
          <div className={`sat ${styles.stepTitle}`}>Génération / années</div>
          <div className={styles.grid}>
            {genList.map((g) => (
              <button key={g.id} type="button" className={styles.card} onClick={() => setGeneration(g)}>
                <span className={styles.cardName}>{g.name}</span>
                <span className={`mono ${styles.cardMeta}`}>{generationYears(g)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* step 4: body style → resolve */}
      {generation && make && model && (
        <>
          <div className={`sat ${styles.stepTitle}`}>Carrosserie</div>
          {variants.isPending ? (
            skeletons(3)
          ) : (
            <div className={styles.grid}>
              {(variants.data ?? []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={styles.card}
                  onClick={() =>
                    onResolved({
                      variantId: v.id,
                      baseLaborMinutes: v.baseLaborMinutes,
                      make: make.name,
                      model: model.name,
                      generation: generation.name,
                      bodyStyle: v.bodyStyle,
                      bodyLabel: v.bodyLabelFr,
                      years: generationYears(generation),
                      badge: badgeFor(model.name),
                    })
                  }
                >
                  <span className={styles.cardName}>{v.bodyLabelFr}</span>
                  {v.notes && <span className={styles.cardMeta}>{v.notes}</span>}
                </button>
              ))}
              {(variants.data ?? []).length === 0 && (
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  Aucune carrosserie référencée pour cette génération.
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* taxonomy-gap fallback */}
      {!compact && (
        <div className={styles.fallback}>
          {requestState === 'sent' ? (
            <span style={{ color: 'var(--status-success)', fontSize: 14 }}>
              ✓ Merci — on ajoute votre véhicule et on vous répond.
            </span>
          ) : (
            <>
              <span className="sat" style={{ fontSize: 14, color: 'var(--text-soft)' }}>
                Je ne trouve pas mon véhicule
              </span>
              <div className={styles.fallbackRow}>
                <input
                  className="field"
                  placeholder="Ex : Alpine A110 2022, coupé"
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
                <input
                  className="field"
                  placeholder="E-mail (optionnel)"
                  type="email"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  style={{ maxWidth: 220 }}
                />
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11 }}
                  disabled={requestState === 'sending' || requestText.trim().length < 3}
                  onClick={sendRequest}
                >
                  {requestState === 'sending' ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
              {requestState === 'error' && (
                <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{requestError}</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
