/* Personalized reservation requests (0023): the admin calls the client back, then confirms with
   his own date, price and message — which creates a real booking (agenda, SMS, portal…). */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { confirmServiceRequest, declineServiceRequest, getServiceRequests } from '../../api/serviceRequests'
import { errorMessage } from '../../lib/supabase'
import { formatPhoneDisplay } from '../../lib/phone'
import type { ServiceRequestRow, ServiceRequestStatus } from '../../types/api'
import Modal from '../../components/ui/Modal'
import { NO_NAME_LABEL } from '../../api/admin'
import BookingDrawer from './BookingDrawer'
import SlotPicker, { type SlotConflictState } from './SlotPicker'
import { CUSTOM_DURATIONS, parsePriceInput } from './customBooking'
import styles from './admin.module.css'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

const STATUS_PILL: Record<ServiceRequestStatus, { tone: string; label: string }> = {
  new: { tone: 'pending', label: 'À traiter' },
  confirmed: { tone: 'success', label: 'Confirmé' },
  declined: { tone: 'danger', label: 'Refusé' },
  cancelled: { tone: 'muted', label: 'Annulé par le client' },
}

function ConfirmModal({ request, onClose }: { request: ServiceRequestRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(request.serviceLabel)
  const [vehicle, setVehicle] = useState(request.vehicleText ?? '')
  const [name, setName] = useState(request.contactName ?? '')
  const [duration, setDuration] = useState(120)
  const [slotStart, setSlotStart] = useState('')
  const [conflict, setConflict] = useState<SlotConflictState>('none')
  const [priceInput, setPriceInput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const price = parsePriceInput(priceInput)

  const mutation = useMutation({
    mutationFn: () =>
      confirmServiceRequest({
        requestId: request.id,
        title: title.trim(),
        slotStartISO: slotStart,
        durationMin: duration,
        price: price.value,
        adminMessage: message,
        contactName: name,
        vehicle,
        allowOverlap: conflict === 'accepted',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Modal title={`Confirmer ${request.reference}`} onClose={onClose}>
      <div className={styles.formStack}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-title">Prestation *</label>
          <input id="dv-title" className="field" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-vehicle">Véhicule</label>
          <input id="dv-vehicle" className="field" maxLength={200} value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        </div>
        {!request.contactName && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="dv-name">Nom du client (facultatif)</label>
            <input id="dv-name" className="field" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-duration">Durée</label>
          <select id="dv-duration" className="field mono" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {CUSTOM_DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Date et heure *</span>
          <SlotPicker durationMin={duration} value={slotStart} onChange={setSlotStart} onConflictChange={setConflict} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-price">Prix (€)</label>
          <input
            id="dv-price"
            className="field mono"
            inputMode="decimal"
            placeholder="Vide = à fixer plus tard"
            aria-invalid={!price.valid || undefined}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value.replace(/[^\d.,]/g, ''))}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-message">Votre message au client</label>
          <textarea
            id="dv-message"
            className="field"
            rows={3}
            maxLength={1000}
            placeholder="Ex : prévoir de laisser le véhicule 2 jours."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <span className={styles.formHint}>Le client reçoit la confirmation par e-mail et SMS, avec votre message. Le rendez-vous apparaît dans l'agenda et dans ses réservations.</span>
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</span>}
        <button
          type="button"
          className="cta"
          style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12 }}
          disabled={mutation.isPending || title.trim().length < 2 || !slotStart || conflict === 'unresolved' || !price.valid}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Confirmation…' : 'Confirmer le rendez-vous'}
        </button>
      </div>
    </Modal>
  )
}

function DeclineModal({ request, onClose }: { request: ServiceRequestRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => declineServiceRequest(request.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Modal title={`Refuser ${request.reference}`} onClose={onClose}>
      <div className={styles.formStack}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="dv-reason">Motif (envoyé au client, facultatif)</label>
          <textarea
            id="dv-reason"
            className="field"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</span>}
        <button type="button" className="ghost" style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12, color: 'var(--status-danger)' }} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Envoi…' : 'Refuser la demande'}
        </button>
      </div>
    </Modal>
  )
}

export default function DevisPage() {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const [confirming, setConfirming] = useState<ServiceRequestRow | null>(null)
  const [declining, setDeclining] = useState<ServiceRequestRow | null>(null)
  const [openBooking, setOpenBooking] = useState<string | null>(null)

  const requests = useQuery({ queryKey: ['admin', 'devis'], queryFn: getServiceRequests, staleTime: 10_000 })
  const all = useMemo(() => requests.data ?? [], [requests.data])
  const open = useMemo(() => all.filter((r) => r.status === 'new').reverse(), [all]) // oldest first: first asked, first called
  const done = useMemo(() => all.filter((r) => r.status !== 'new'), [all])
  const list = tab === 'open' ? open : done

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Demandes de devis</h1>
        <p className={styles.pageSub}>Rappelez le client, puis confirmez avec votre date, votre prix et votre message.</p>
      </div>

      <div className={styles.devisTabs} role="group" aria-label="Filtre des demandes">
        <button type="button" className="chip" aria-pressed={tab === 'open'} onClick={() => setTab('open')}>
          À traiter · {open.length}
        </button>
        <button type="button" className="chip" aria-pressed={tab === 'done'} onClick={() => setTab('done')}>
          Traitées · {done.length}
        </button>
      </div>

      <div className={styles.devisList}>
        {requests.isPending && <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</span>}
        {requests.isError && <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{errorMessage(requests.error)}</span>}
        {requests.isSuccess && list.length === 0 && (
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            {tab === 'open' ? 'Aucune demande en attente.' : 'Aucune demande traitée.'}
          </span>
        )}
        {list.map((r) => {
          const pill = STATUS_PILL[r.status]
          return (
            <article key={r.id} className={styles.devisCard}>
              <div className={styles.devisHead}>
                <div>
                  <span className={`mono ${styles.devisRef}`}>{r.reference}</span>
                  <h2 className={`sat ${styles.devisTitle}`}>
                    {r.serviceLabel}
                    {r.vehicleText ? ` · ${r.vehicleText}` : ''}
                  </h2>
                </div>
                <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                  <span className={`pill pill--${pill.tone}`}>
                    <span className="pill__dot" aria-hidden />
                    {pill.label}
                  </span>
                  <span className={`mono ${styles.devisDate}`}>{dateFmt.format(new Date(r.createdAt))}</span>
                </div>
              </div>

              <p className={styles.devisMessage}>{r.message}</p>

              <div className={styles.devisContact}>
                <span>{r.contactName ?? NO_NAME_LABEL}</span>
                <a className="mono navlink" href={`tel:${r.contactPhone}`}>{formatPhoneDisplay(r.contactPhone) || r.contactPhone}</a>
                <a className="mono navlink" href={`mailto:${r.contactEmail}`}>{r.contactEmail}</a>
              </div>

              {r.status === 'declined' && r.adminReply && <span className={styles.formHint}>Motif : {r.adminReply}</span>}

              {r.status === 'new' && (
                <div className={styles.devisActions}>
                  <a className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} href={`tel:${r.contactPhone}`}>Appeler</a>
                  <button type="button" className="cta" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setConfirming(r)}>
                    Confirmer
                  </button>
                  <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11, color: 'var(--status-danger)' }} onClick={() => setDeclining(r)}>
                    Refuser
                  </button>
                </div>
              )}
              {r.bookingId && (
                <div className={styles.devisActions}>
                  <button type="button" className="ghost" style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11 }} onClick={() => setOpenBooking(r.bookingId)}>
                    Voir le rendez-vous
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {confirming && <ConfirmModal request={confirming} onClose={() => setConfirming(null)} />}
      {declining && <DeclineModal request={declining} onClose={() => setDeclining(null)} />}
      {openBooking && <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />}
    </div>
  )
}
