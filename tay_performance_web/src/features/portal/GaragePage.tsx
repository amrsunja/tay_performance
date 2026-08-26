import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import Modal from '../../components/ui/Modal'
import { useReveal } from '../../hooks/useReveal'
import { useAuth } from '../../auth/AuthProvider'
import { addVehicle, deleteVehicle, getMyVehicles, updateVehicle } from '../../api/garage'
import VehicleFunnel from '../booking/VehicleStep'
import type { GarageVehicle, ResolvedVehicle } from '../../types/api'
import { errorMessage } from '../../lib/supabase'
import styles from './portal.module.css'

export default function GaragePage() {
  useReveal()
  const { session, ensureSession } = useAuth()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [pendingVariant, setPendingVariant] = useState<ResolvedVehicle | null>(null)
  const [editing, setEditing] = useState<GarageVehicle | null>(null)
  const [error, setError] = useState('')

  const vehicles = useQuery({
    queryKey: ['garage'],
    queryFn: getMyVehicles,
    enabled: Boolean(session),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['garage'] })

  const addMutation = useMutation({
    mutationFn: async (input: { vehicle: ResolvedVehicle; nickname: string; plate: string; year: string; color: string }) => {
      const s = await ensureSession()
      await addVehicle(s.user.id, {
        variantId: input.vehicle.variantId,
        nickname: input.nickname || null,
        plate: input.plate || null,
        year: input.year ? Number(input.year) : null,
        color: input.color || null,
      })
    },
    onSuccess: () => {
      setAdding(false)
      setPendingVariant(null)
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; nickname: string; plate: string; year: string; color: string }) => {
      await updateVehicle(input.id, {
        nickname: input.nickname || null,
        plate: input.plate || null,
        year: input.year ? Number(input.year) : null,
        color: input.color || null,
      })
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const list = vehicles.data ?? []

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head} data-reveal>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Espace client · Mon Garage</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Vos véhicules<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
            <p className={styles.lede}>Vos variantes sont déjà résolues — réservez une nouvelle pose en un geste.</p>
          </div>
          <div className={styles.tabs}>
            <Link to="/garage" className={`${styles.tab} ${styles.tabActive}`} aria-current="page">
              Mon Garage
            </Link>
            <Link to="/reservations" className={styles.tab}>
              Mes réservations
            </Link>
          </div>
        </div>

        <div className={styles.vehicleGrid}>
          {list.map((vehicle, i) => (
            <article key={vehicle.vehicleId} className={styles.vehicleCard} data-reveal data-delay={i * 90}>
              <div className={styles.vehicleTop}>
                <span className={`mono ${styles.vehicleBadge}`}>{vehicle.badge}</span>
                {vehicle.nickname && <span className={`chip`}>{vehicle.nickname}</span>}
              </div>
              <h2 className={`sat ${styles.vehicleTitle}`}>
                {vehicle.make} {vehicle.generation} {vehicle.model}
              </h2>
              <div className={`mono ${styles.vehicleSub}`}>
                {vehicle.bodyLabel} · {vehicle.years}
              </div>
              <dl className={styles.vehicleSpecs}>
                <div>
                  <dt>Année</dt>
                  <dd className="mono">{vehicle.year ?? '—'}</dd>
                </div>
                <div>
                  <dt>Immat.</dt>
                  <dd className="mono">{vehicle.plate ?? '—'}</dd>
                </div>
                <div>
                  <dt>Teinte</dt>
                  <dd>{vehicle.color ?? '—'}</dd>
                </div>
              </dl>
              <div className={styles.vehicleActions}>
                <Link
                  to={`/reserver?vehicle=${vehicle.vehicleId}`}
                  className="cta"
                  style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12 }}
                >
                  Réserver une pose →
                </Link>
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 14, padding: '12px 18px', borderRadius: 12 }}
                  onClick={() => setEditing(vehicle)}
                >
                  Modifier
                </button>
              </div>
            </article>
          ))}

          {/* ghosted add-vehicle card (quiet, premium empty-state) */}
          <button
            type="button"
            className={styles.addCard}
            data-reveal
            data-delay={list.length * 90}
            onClick={() => setAdding(true)}
          >
            <span className={styles.addGhostCar} aria-hidden>
              <svg viewBox="0 0 380 180" width="150">
                <path
                  d="M28 122 Q24 96 52 92 L96 92 L120 56 Q128 44 146 44 L246 44 Q266 44 276 60 L300 92 L340 96 Q360 100 356 122 L356 134 L28 134 Z"
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="2"
                  strokeDasharray="6 7"
                />
                <circle cx="92" cy="132" r="17" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 5" />
                <circle cx="300" cy="132" r="17" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 5" />
              </svg>
            </span>
            <span className={`sat ${styles.addTitle}`}>Ajouter un véhicule</span>
            <span className={styles.addSub}>Marque → modèle → génération → carrosserie</span>
          </button>
        </div>
      </main>
      <SiteFooter />

      {adding && (
        <Modal
          title={pendingVariant ? 'Détails du véhicule' : 'Ajouter un véhicule'}
          wide={!pendingVariant}
          onClose={() => {
            setAdding(false)
            setPendingVariant(null)
          }}
        >
          {!pendingVariant ? (
            <VehicleFunnel compact onResolved={(v) => setPendingVariant(v)} />
          ) : (
            <VehicleDetailsForm
              title={`${pendingVariant.make} ${pendingVariant.generation} ${pendingVariant.model}`}
              pending={addMutation.isPending}
              error={error}
              onSubmit={(fields) => addMutation.mutate({ vehicle: pendingVariant, ...fields })}
            />
          )}
        </Modal>
      )}

      {editing && (
        <Modal title={`${editing.make} ${editing.generation} ${editing.model}`} onClose={() => setEditing(null)}>
          <VehicleDetailsForm
            initial={{
              nickname: editing.nickname ?? '',
              plate: editing.plate ?? '',
              year: editing.year ? String(editing.year) : '',
              color: editing.color ?? '',
            }}
            pending={updateMutation.isPending}
            error={error}
            onSubmit={(fields) => updateMutation.mutate({ id: editing.vehicleId, ...fields })}
            onDelete={() => deleteMutation.mutate(editing.vehicleId)}
          />
        </Modal>
      )}
    </div>
  )
}

interface DetailsFields {
  nickname: string
  plate: string
  year: string
  color: string
}

function VehicleDetailsForm({
  title,
  initial,
  pending,
  error,
  onSubmit,
  onDelete,
}: {
  title?: string
  initial?: DetailsFields
  pending: boolean
  error: string
  onSubmit: (fields: DetailsFields) => void
  onDelete?: () => void
}) {
  const [fields, setFields] = useState<DetailsFields>(initial ?? { nickname: '', plate: '', year: '', color: '' })
  const set = (k: keyof DetailsFields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {title && (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          {title}
        </div>
      )}
      <input className="field" placeholder="Surnom (ex : Daily M3)" value={fields.nickname} onChange={set('nickname')} />
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <input className="field" placeholder="Immatriculation" value={fields.plate} onChange={set('plate')} />
        <input className="field" placeholder="Année" inputMode="numeric" value={fields.year} onChange={set('year')} />
      </div>
      <input className="field" placeholder="Couleur" value={fields.color} onChange={set('color')} />
      {error && (
        <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 6 }}>
        {onDelete ? (
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 13, padding: '11px 16px', borderRadius: 11, color: 'var(--status-danger)' }}
            onClick={onDelete}
          >
            Supprimer
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }}
          disabled={pending}
          onClick={() => onSubmit(fields)}
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
