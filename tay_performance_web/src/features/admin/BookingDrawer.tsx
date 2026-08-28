/* Right-side booking drawer — everything about one booking (docs/05 §7):
   contact, specs, price breakdown, status timeline + transitions, admin notes
   (client-invisible), before/after photos, warranty. */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusPill, { describeTransition } from '../../components/ui/StatusPill'
import { useAuth } from '../../auth/AuthProvider'
import {
  advanceStatus,
  deleteBookingPhoto,
  getAdminBooking,
  getAdminNotes,
  getBookingPhotos,
  getStatusHistory,
  issueWarranty,
  setBookingPrice,
  saveAdminNotes,
  uploadBookingPhoto,
} from '../../api/admin'
import { photoUrl } from '../../api/bookings'
import { errorMessage } from '../../lib/supabase'
import { formatPhoneDisplay } from '../../lib/phone'
import type { BookingStatus } from '../../types/domain'
import { formatDuration, formatEuro } from '../booking/useBookingDraft'

const NEXT_STATUSES: Record<string, BookingStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}
/** one step back / re-open (mirrors _transition_allowed in 0014) */
const BACK_STATUSES: Record<string, BookingStatus[]> = {
  requested: [],
  confirmed: ['requested'],
  in_progress: ['confirmed'],
  completed: ['in_progress'],
  cancelled: ['requested', 'confirmed'],
  no_show: ['confirmed'],
}
const BACK_LABELS: Record<string, string> = {
  requested: '← Remettre en attente',
  confirmed: '← Revenir à confirmé',
  in_progress: '← Rouvrir la pose',
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Demandé',
  confirmed: 'Confirmer',
  in_progress: 'Démarrer la pose',
  completed: 'Terminer',
  cancelled: 'Annuler',
  no_show: 'Client absent',
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
})

function zoneShort(code: string) {
  const map: Record<string, string> = {
    pare_brise: 'PB', front_sides: 'AV', rear_sides: 'AR', rear_window: 'LUN', panoramic_roof: 'TOIT',
  }
  return map[code] ?? code
}

function PhotoThumb({ path, onDelete }: { path: string; onDelete: () => void }) {
  const url = useQuery({ queryKey: ['photo-url', path], queryFn: () => photoUrl(path), staleTime: 45 * 60_000 })
  return (
    <div style={{ position: 'relative', width: 110 }}>
      {url.data ? (
        <img src={url.data} alt="" style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10 }} />
      ) : (
        <div style={{ width: 110, height: 80, borderRadius: 10, background: 'var(--surface-inset)' }} />
      )}
      <button
        type="button"
        aria-label="Supprimer la photo"
        onClick={onDelete}
        style={{
          position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6,
          border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 11,
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default function BookingDrawer({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [warrantyYears, setWarrantyYears] = useState(5)
  const [error, setError] = useState('')

  const booking = useQuery({ queryKey: ['admin', 'booking', bookingId], queryFn: () => getAdminBooking(bookingId) })
  const history = useQuery({ queryKey: ['admin', 'history', bookingId], queryFn: () => getStatusHistory(bookingId) })
  const photos = useQuery({ queryKey: ['admin', 'photos', bookingId], queryFn: () => getBookingPhotos(bookingId) })
  const notesQuery = useQuery({ queryKey: ['admin', 'notes', bookingId], queryFn: () => getAdminNotes(bookingId) })

  useEffect(() => {
    if (notesQuery.data !== undefined && !notesDirty) setNotes(notesQuery.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesQuery.data])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ to, note }: { to: BookingStatus; note?: string }) => advanceStatus(bookingId, to, note),
    onSuccess: invalidateAll,
    onError: (e) => setError(errorMessage(e)),
  })

  // price editor
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [priceReason, setPriceReason] = useState('')
  const priceMutation = useMutation({
    mutationFn: () => setBookingPrice(bookingId, Number(priceInput.replace(',', '.')), priceReason.trim() || null),
    onSuccess: () => {
      setEditingPrice(false)
      setPriceReason('')
      invalidateAll()
    },
    onError: (e) => setError(errorMessage(e)),
  })
  const parsedPrice = Number(priceInput.replace(',', '.'))
  const priceOk = priceInput.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice >= 0

  const notesMutation = useMutation({
    mutationFn: () => saveAdminNotes(bookingId, notes, session!.user.id),
    onSuccess: () => {
      setNotesDirty(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'notes', bookingId] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ kind, file }: { kind: 'before' | 'after'; file: File }) =>
      uploadBookingPhoto(bookingId, kind, file, session!.user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'photos', bookingId] }),
    onError: (e) => setError(errorMessage(e)),
  })

  const warrantyMutation = useMutation({
    mutationFn: () => issueWarranty(bookingId, warrantyYears, session!.user.id),
    onSuccess: invalidateAll,
    onError: (e) => setError(errorMessage(e)),
  })

  const b = booking.data

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end', background: 'rgba(6,8,11,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside
        style={{
          width: 'min(480px, 100%)', height: '100%', overflowY: 'auto',
          background: 'var(--surface-1)', borderLeft: '1px solid var(--border-strong)', padding: 24,
          display: 'grid', gap: 18, alignContent: 'start',
        }}
        aria-label="Fiche réservation"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 13, color: 'var(--octane-300)' }}>
            {b?.reference ?? '…'}
          </span>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {b && (
          <>
            <div>
              <h2 className="sat" style={{ margin: '0 0 4px', fontSize: 20, color: 'var(--text-hi)' }}>
                {b.vehicleLabel}
              </h2>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {b.bodyLabel} · {dateFmt.format(new Date(b.slotStart))} · {formatDuration(b.durationMin)}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <StatusPill status={b.status} />
                {b.legalFlag === 'non_compliant_ack' && (
                  <span className="pill pill--warning">
                    <span aria-hidden>⚠</span> Hors conformité (ack client)
                  </span>
                )}
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 17, color: 'var(--text-hi)' }}>
                  {formatEuro(b.priceTotal)}
                </span>
                {b.priceOverridden && (
                  <span className="mono" style={{ display: 'block', fontSize: 11, color: 'var(--octane-300)' }}>prix modifié par l'atelier</span>
                )}
              </div>
            </div>

            {/* contact */}
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', gap: 4 }}>
              {b.forOther && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--octane-300)', letterSpacing: '0.06em' }}>
                  RDV POUR UNE AUTRE PERSONNE
                </span>
              )}
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{b.contactName}</span>
              <a className="mono navlink" href={`tel:${b.contactPhone.replace(/\s/g, '')}`} style={{ fontSize: 13 }}>
                {formatPhoneDisplay(b.contactPhone) || b.contactPhone}
              </a>
              {b.contactEmail && (
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{b.contactEmail}</span>
              )}
              {b.clientNotes && (
                <span style={{ fontSize: 13, color: 'var(--text-soft)', fontStyle: 'italic' }}>« {b.clientNotes} »</span>
              )}
              {b.forOther && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
                    RÉSERVÉ PAR (PROFIL)
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{b.bookerName ?? 'Profil sans nom'}</span>
                  {b.bookerPhone && (
                    <a className="mono navlink" href={`tel:${b.bookerPhone}`} style={{ fontSize: 12 }}>
                      {formatPhoneDisplay(b.bookerPhone)}
                    </a>
                  )}
                  {b.bookerEmail && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{b.bookerEmail}</span>
                  )}
                </div>
              )}
            </div>

            {/* specs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {b.specs.map((s) => (
                <span
                  key={s.zone}
                  className="chip"
                  style={!s.isLegal ? { borderColor: 'rgba(248,113,113,.5)', color: 'var(--status-warning)' } : undefined}
                >
                  {zoneShort(s.zone)} {s.vltPercent}%{!s.isLegal && ' ⚠'}
                </span>
              ))}
            </div>

            {/* price — editable by the admin, every change lands in the history */}
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', gap: 8 }}>
              {!editingPrice ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>PRIX </span>
                    <span className="mono" style={{ fontSize: 16, color: 'var(--text)' }}>{formatEuro(b.priceTotal)}</span>
                    {b.priceOverridden && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--octane-300)', marginLeft: 8 }}>modifié</span>
                    )}
                  </span>
                  {b.status !== 'cancelled' && b.status !== 'no_show' && (
                    <button
                      type="button"
                      className="ghost"
                      style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9 }}
                      onClick={() => {
                        setPriceInput(b.priceTotal.toFixed(2))
                        setEditingPrice(true)
                      }}
                    >
                      Modifier le prix
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="field mono"
                        inputMode="decimal"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value.replace(/[^\d.,]/g, ''))}
                        aria-label="Nouveau prix (€)"
                        autoFocus
                        style={{ width: 140, paddingRight: 30 }}
                      />
                      <span className="mono" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-dim)' }}>€</span>
                    </div>
                    <input
                      className="field"
                      placeholder="Motif (visible par le client) — ex : geste commercial"
                      value={priceReason}
                      onChange={(e) => setPriceReason(e.target.value)}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="cta"
                      style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }}
                      disabled={!priceOk || priceMutation.isPending || parsedPrice === b.priceTotal}
                      onClick={() => priceMutation.mutate()}
                    >
                      {priceMutation.isPending ? 'Enregistrement…' : 'Appliquer le nouveau prix'}
                    </button>
                    <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setEditingPrice(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* transitions */}
            {(NEXT_STATUSES[b.status].length > 0 || BACK_STATUSES[b.status].length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {NEXT_STATUSES[b.status].map((to) => (
                  <button
                    key={to}
                    type="button"
                    className={to === 'cancelled' || to === 'no_show' ? 'ghost' : 'cta'}
                    style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11, ...(to === 'cancelled' ? { color: 'var(--status-danger)' } : {}) }}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ to })}
                  >
                    {STATUS_LABELS[to]}
                  </button>
                ))}
                {BACK_STATUSES[b.status].map((to) => (
                  <button
                    key={`back-${to}`}
                    type="button"
                    className="navlink mono"
                    style={{ fontSize: 12, marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
                    disabled={statusMutation.isPending}
                    title="Retour en arrière — le créneau est re-vérifié"
                    onClick={() => statusMutation.mutate({ to, note: 'retour en arrière' })}
                  >
                    {BACK_LABELS[to] ?? `← ${STATUS_LABELS[to]}`}
                  </button>
                ))}
              </div>
            )}

            {/* timeline */}
            <div style={{ display: 'grid', gap: 6 }}>
              <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>Historique</span>
              {(history.data ?? []).map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(h.changedAt))}
                  </span>
                  <span style={{ color: 'var(--text-soft)' }}>
                    {describeTransition(h.fromStatus, h.toStatus, h.note)}
                  </span>
                </div>
              ))}
            </div>

            {/* admin notes — separate table, never visible to the client */}
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                Notes internes <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>(invisibles client)</span>
              </span>
              <textarea
                className="field"
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNotesDirty(true)
                }}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
              {notesDirty && (
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10, justifySelf: 'start' }}
                  disabled={notesMutation.isPending}
                  onClick={() => notesMutation.mutate()}
                >
                  {notesMutation.isPending ? 'Enregistrement…' : 'Enregistrer les notes'}
                </button>
              )}
            </div>

            {/* photos */}
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>Photos avant / après</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(photos.data ?? []).map((p) => (
                  <PhotoThumb
                    key={p.id}
                    path={p.path}
                    onDelete={() => {
                      deleteBookingPhoto(p).then(() =>
                        queryClient.invalidateQueries({ queryKey: ['admin', 'photos', bookingId] }),
                      )
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['before', 'after'] as const).map((kind) => (
                  <label key={kind} className="ghost" style={{ fontSize: 12, padding: '9px 14px', borderRadius: 10, cursor: 'pointer' }}>
                    + {kind === 'before' ? 'Avant' : 'Après'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadMutation.mutate({ kind, file })
                        e.target.value = ''
                      }}
                    />
                  </label>
                ))}
                {uploadMutation.isPending && (
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>Envoi…</span>
                )}
              </div>
            </div>

            {/* warranty */}
            {b.status === 'completed' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>Garantie</span>
                <select
                  className="field mono"
                  value={warrantyYears}
                  onChange={(e) => setWarrantyYears(Number(e.target.value))}
                  style={{ width: 90, padding: '8px 10px' }}
                  aria-label="Années de garantie"
                >
                  {[2, 3, 5, 7, 10].map((y) => (
                    <option key={y} value={y}>{y} ans</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 12, padding: '9px 14px', borderRadius: 10 }}
                  disabled={warrantyMutation.isPending}
                  onClick={() => warrantyMutation.mutate()}
                >
                  {warrantyMutation.isSuccess ? '✓ Émise' : 'Émettre'}
                </button>
              </div>
            )}

            {error && (
              <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</span>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
