/* Step 1 — vehicle resolution. Search-first ("golf 7", "tesla model 3", "clio 4"), with the
   classic funnel Make → Model → Generation → Body style as a fallback when the search box
   is empty. Any generation can be booked with ANY body style: unknown pairs are created on
   demand (ensure_variant) with the body style's default surcoût.
   The "Je ne trouve pas mon véhicule" block sits on top of the list: a signed-in / anonymous
   session attaches the request to the client, otherwise name + e-mail + phone are required.
   Reusable: also mounted in the Garage "add vehicle" modal and the admin manual-booking modal. */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import {
  badgeFor,
  ensureVariant,
  generationLabel,
  generationYears,
  getBodyStyles,
  getGenerations,
  getMakes,
  getModels,
  getVariants,
  resolvedFromHit,
  searchVehicles,
  submitVehicleRequest,
} from '../../api/taxonomy'
import { getMyProfile } from '../../api/profile'
import { isValidEmail } from '../../api/auth'
import { errorMessage } from '../../lib/supabase'
import PhoneInput from '../../components/ui/PhoneInput'
import type { GenerationRow, MakeRow, ModelRow, ResolvedVehicle, VehicleSearchHit } from '../../types/api'
import type { BodyStyleCode } from '../../types/domain'
import styles from './vehicle.module.css'

interface VehicleFunnelProps {
  onResolved: (vehicle: ResolvedVehicle) => void
  /** denser layout for modals */
  compact?: boolean
  /** hide the "je ne trouve pas mon véhicule" block (admin) */
  hideRequest?: boolean
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export default function VehicleFunnel({ onResolved, compact, hideRequest }: VehicleFunnelProps) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 220)
  const [make, setMake] = useState<MakeRow | null>(null)
  const [model, setModel] = useState<ModelRow | null>(null)
  const [generation, setGeneration] = useState<GenerationRow | null>(null)
  const [resolving, setResolving] = useState<string | null>(null) // `${generationId}:${body}`
  const [error, setError] = useState('')

  const bodyStyles = useQuery({ queryKey: ['taxonomy', 'body-styles'], queryFn: getBodyStyles, staleTime: 5 * 60_000 })
  const search = useQuery({
    queryKey: ['taxonomy', 'search', dq],
    queryFn: () => searchVehicles(dq),
    enabled: dq.length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const makes = useQuery({ queryKey: ['taxonomy', 'makes'], queryFn: getMakes, enabled: dq.length < 2 })
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

  // auto-skip a single-generation model
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

  /** Common resolution path (search hit or funnel): known variant → direct; else ensure_variant. */
  const pick = async (
    hit: { make: string; model: string; generation: string; yearStart: number | null; yearEnd: number | null; generationId: string },
    body: BodyStyleCode,
    known?: { id: string; baseLaborMinutes: number; labelFr: string },
  ) => {
    const key = `${hit.generationId}:${body}`
    setResolving(key)
    setError('')
    try {
      const variant = known ?? (await ensureVariant(hit.generationId, body))
      onResolved(resolvedFromHit(hit, variant, body))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setResolving(null)
    }
  }

  const skeletons = (n: number) => (
    <div className={styles.grid}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  )

  const allBodies = bodyStyles.data ?? []
  const searching = dq.length >= 2

  return (
    <div className={styles.wrap}>
      {!hideRequest && <RequestBlock compact={compact} />}

      {/* ---------- search ---------- */}
      <div className={styles.searchBox}>
        <span className={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className={`field ${styles.searchInput}`}
          placeholder="Rechercher : « golf 7 », « tesla model 3 », « clio 4 »…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (e.target.value.trim().length >= 2) reset('make')
          }}
          autoComplete="off"
          aria-label="Rechercher un véhicule"
        />
        {q && (
          <button type="button" className={styles.searchClear} aria-label="Effacer" onClick={() => setQ('')}>
            ✕
          </button>
        )}
      </div>

      {error && (
        <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">
          {error}
        </span>
      )}

      {searching ? (
        <>
          {search.isPending ? (
            skeletons(4)
          ) : (search.data ?? []).length === 0 ? (
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              Aucun résultat pour « {dq} » — essayez la marque seule, ou utilisez le bloc « Je ne trouve pas mon
              véhicule » ci-dessus.
            </span>
          ) : (
            <div className={styles.hits}>
              {(search.data ?? []).map((hit) => (
                <HitCard
                  key={hit.generationId}
                  hit={hit}
                  bodies={allBodies}
                  resolving={resolving}
                  onPick={(body, known) => pick(hit, body, known)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
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
                    {generationLabel(generation)} <span aria-hidden>✕</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* step 1: make */}
          {!make && (
            <>
              <div className={`sat ${styles.stepTitle}`}>Ou parcourez par marque</div>
              {makes.isPending ? (
                skeletons(8)
              ) : (
                <div className={styles.grid}>
                  {(makes.data ?? []).map((m) => (
                    <button key={m.id} type="button" className={styles.card} onClick={() => setMake(m)}>
                      <span className={styles.cardHead}>
                        <MakeLogo name={m.name} url={m.logoUrl} />
                        <span className={styles.cardName}>{m.name}</span>
                      </span>
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
                <ModelList models={models.data ?? []} onPick={setModel} />
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
          {model && !generation && !generations.isPending && genList.length === 0 && (
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              Aucune génération référencée — utilisez « Je ne trouve pas mon véhicule ».
            </span>
          )}

          {/* step 4: body style → resolve */}
          {generation && make && model && (
            <>
              <div className={`sat ${styles.stepTitle}`}>Carrosserie</div>
              {variants.isPending || bodyStyles.isPending ? (
                skeletons(3)
              ) : (
                <BodyPicker
                  known={(variants.data ?? []).map((v) => ({
                    id: v.id,
                    bodyStyle: v.bodyStyle,
                    labelFr: v.bodyLabelFr,
                    baseLaborMinutes: v.baseLaborMinutes,
                    notes: v.notes,
                  }))}
                  bodies={allBodies}
                  resolvingKey={resolving}
                  generationId={generation.id}
                  onPick={(body, known) =>
                    pick(
                      {
                        make: make.name,
                        model: model.name,
                        generation: generation.name,
                        yearStart: generation.yearStart,
                        yearEnd: generation.yearEnd,
                        generationId: generation.id,
                      },
                      body,
                      known,
                    )
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ---------- pieces ---------- */

export function MakeLogo({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={styles.logo}
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className={`mono ${styles.logoFallback}`} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {badgeFor(name)}
    </span>
  )
}

function ModelList({ models, onPick }: { models: ModelRow[]; onPick: (m: ModelRow) => void }) {
  const [filter, setFilter] = useState('')
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? models.filter((m) => m.name.toLowerCase().includes(f)) : models
  }, [models, filter])
  return (
    <>
      {models.length > 12 && (
        <input
          className="field"
          placeholder={`Filtrer ${models.length} modèles…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 320 }}
          aria-label="Filtrer les modèles"
        />
      )}
      <div className={styles.grid}>
        {shown.map((m) => (
          <button key={m.id} type="button" className={styles.card} onClick={() => onPick(m)}>
            <span className={styles.cardName}>{m.name}</span>
          </button>
        ))}
        {shown.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Aucun modèle.</span>}
      </div>
    </>
  )
}

type KnownVariant = { id: string; bodyStyle: BodyStyleCode; labelFr: string; baseLaborMinutes: number; notes: string | null }

function BodyPicker({
  known,
  bodies,
  resolvingKey,
  generationId,
  onPick,
}: {
  known: KnownVariant[]
  bodies: { code: BodyStyleCode; labelFr: string }[]
  resolvingKey: string | null
  generationId: string
  onPick: (body: BodyStyleCode, known?: KnownVariant) => void
}) {
  const knownCodes = new Set(known.map((k) => k.bodyStyle))
  const others = bodies.filter((b) => !knownCodes.has(b.code))
  const [showOthers, setShowOthers] = useState(known.length === 0)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {known.length > 0 && (
        <div className={styles.grid}>
          {known.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.card}
              disabled={resolvingKey !== null}
              onClick={() => onPick(v.bodyStyle, v)}
            >
              <span className={styles.cardName}>{v.labelFr}</span>
              {v.notes && <span className={styles.cardMeta}>{v.notes}</span>}
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <>
          {!showOthers ? (
            <button type="button" className={`navlink ${styles.otherLink}`} onClick={() => setShowOthers(true)}>
              Autre carrosserie →
            </button>
          ) : (
            <>
              {known.length > 0 && <div className={`mono ${styles.subTitle}`}>Autre carrosserie</div>}
              <div className={styles.chipRow}>
                {others.map((b) => {
                  const key = `${generationId}:${b.code}`
                  return (
                    <button
                      key={b.code}
                      type="button"
                      className="chip"
                      disabled={resolvingKey !== null}
                      aria-busy={resolvingKey === key}
                      onClick={() => onPick(b.code)}
                    >
                      {resolvingKey === key ? '…' : b.labelFr}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function HitCard({
  hit,
  bodies,
  resolving,
  onPick,
}: {
  hit: VehicleSearchHit
  bodies: { code: BodyStyleCode; labelFr: string }[]
  resolving: string | null
  onPick: (body: BodyStyleCode, known?: KnownVariant) => void
}) {
  return (
    <article className={styles.hit}>
      <div className={styles.hitHead}>
        <MakeLogo name={hit.make} url={hit.logoUrl} size={34} />
        <div style={{ minWidth: 0 }}>
          <div className={`sat ${styles.hitTitle}`}>
            {hit.make} {hit.model}
          </div>
          <div className={`mono ${styles.hitMeta}`}>{generationLabel(hit)}</div>
        </div>
      </div>
      <BodyPicker known={hit.variants} bodies={bodies} resolvingKey={resolving} generationId={hit.generationId} onPick={onPick} />
    </article>
  )
}

/* ---------- "Je ne trouve pas mon véhicule" ---------- */

function RequestBlock({ compact }: { compact?: boolean }) {
  const { session, isAnonymous } = useAuth()
  const userId = session?.user.id
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(userId!),
    enabled: Boolean(userId),
  })
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  // a session whose profile already carries e-mail + phone → contact fields not needed
  const profileEmail = profile.data?.email ?? ''
  const profilePhone = profile.data?.phone ?? ''
  const hasContact = Boolean(session) && isValidEmail(profileEmail) && profilePhone.length >= 8
  const needContact = !hasContact

  const canSend =
    text.trim().length >= 3 &&
    (!needContact || (name.trim().length > 0 && isValidEmail(email.trim()) && phone.length >= 8))

  const send = async () => {
    if (!canSend) return
    setState('sending')
    setError('')
    try {
      await submitVehicleRequest({
        rawText: text.trim(),
        contactName: needContact ? name.trim() : null,
        contactEmail: needContact ? email.trim() : null,
        contactPhone: needContact ? phone : null,
      })
      setState('sent')
    } catch (e) {
      setError(errorMessage(e))
      setState('error')
    }
  }

  return (
    <div className={`${styles.fallback} ${compact ? styles.fallbackCompact : ''}`}>
      <button type="button" className={styles.fallbackToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sat" style={{ fontSize: 14, color: 'var(--text-soft)' }}>
          Je ne trouve pas mon véhicule
        </span>
        <span className={`mono ${styles.fallbackHint}`}>
          {state === 'sent' ? '✓ envoyé' : open ? 'réduire' : 'signaler →'}
        </span>
      </button>
      {open &&
        (state === 'sent' ? (
          <span style={{ color: 'var(--status-success)', fontSize: 14 }}>
            ✓ Merci — on ajoute votre véhicule et on vous recontacte
            {session && !isAnonymous ? ' sur votre compte' : ''}.
          </span>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              className="field"
              placeholder="Marque, modèle, année, carrosserie — ex : Alpine A110 2022, coupé *"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {needContact ? (
              <div className={styles.fallbackRow}>
                <input
                  className="field"
                  placeholder="Nom complet *"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="field"
                  placeholder="E-mail *"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <PhoneInput value={phone} onChange={setPhone} style={{ flex: 1, minWidth: 240 }} />
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Demande rattachée à votre compte · {profileEmail} · {profilePhone}
              </span>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ghost"
                style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11 }}
                disabled={state === 'sending' || !canSend}
                onClick={send}
              >
                {state === 'sending' ? 'Envoi…' : 'Envoyer la demande'}
              </button>
              {state === 'error' && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
            </div>
          </div>
        ))}
    </div>
  )
}
