/* Admin manual booking (walk-in / phone) — same engines as the client funnel,
   status lands directly as `confirmed` via admin_create_booking. */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../../components/ui/Modal'
import VehicleFunnel from '../booking/VehicleStep'
import { getCatalog } from '../../api/catalog'
import { getDaySlots } from '../../api/availability'
import { adminCreateBooking } from '../../api/admin'
import { errorMessage } from '../../lib/supabase'
import { computeLocalQuote, formatDuration, formatEuro, INITIAL_DRAFT } from '../booking/useBookingDraft'
import type { ResolvedVehicle } from '../../types/api'
import type { TintZoneCode } from '../../types/domain'

const slotTimeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export default function NewBookingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [vehicle, setVehicle] = useState<ResolvedVehicle | null>(null)
  const [selected, setSelected] = useState<TintZoneCode[]>(['rear_sides', 'rear_window'])
  const [frontVlt, setFrontVlt] = useState(70)
  const [rearVlt, setRearVlt] = useState(20)
  const [day, setDay] = useState('')
  const [slotStart, setSlotStart] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')

  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })

  const quote = useMemo(
    () =>
      computeLocalQuote(catalog.data, {
        ...INITIAL_DRAFT,
        vehicle,
        selected,
        frontVlt,
        rearVlt,
      }),
    [catalog.data, vehicle, selected, frontVlt, rearVlt],
  )

  const slots = useQuery({
    queryKey: ['availability', 'day', day, quote.minutes],
    queryFn: () => getDaySlots(day, quote.minutes),
    enabled: Boolean(day) && quote.minutes > 0,
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateBooking({
        variantId: vehicle!.variantId,
        specs: quote.specs,
        slotStartISO: slotStart,
        contactName,
        contactPhone,
        contactEmail: contactEmail || null,
        clientNotes: notes || null,
      }),
    onSuccess: (r) => {
      setReference(r.reference)
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const toggleZone = (zone: TintZoneCode) =>
    setSelected((s) => (s.includes(zone) ? s.filter((z) => z !== zone) : [...s, zone]))

  if (reference) {
    return (
      <Modal title="Réservation créée" onClose={onClose}>
        <div style={{ display: 'grid', gap: 12 }}>
          <span style={{ color: 'var(--status-success)', fontSize: 15 }}>
            ✓ <span className="mono">{reference}</span> — confirmée pour {contactName}.
          </span>
          <button type="button" className="cta" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }} onClick={onClose}>
            Fermer
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Nouvelle réservation (atelier)" wide onClose={onClose}>
      <div style={{ display: 'grid', gap: 18 }}>
        {!vehicle ? (
          <VehicleFunnel compact onResolved={setVehicle} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="chip">{vehicle.make} {vehicle.generation} {vehicle.model} · {vehicle.bodyLabel}</span>
              <button type="button" className="navlink mono" style={{ fontSize: 12 }} onClick={() => setVehicle(null)}>
                changer →
              </button>
            </div>

            {/* zones + VLT */}
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>Zones</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(catalog.data?.zones ?? []).map((z) => (
                  <button
                    key={z.code}
                    type="button"
                    className="chip"
                    aria-pressed={selected.includes(z.code)}
                    style={selected.includes(z.code) ? { borderColor: 'var(--octane-500)', color: 'var(--octane-300)' } : undefined}
                    onClick={() => toggleZone(z.code)}
                  >
                    {z.labelFr}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  VLT avant
                  <select className="field mono" value={frontVlt} onChange={(e) => setFrontVlt(Number(e.target.value))} style={{ padding: '8px 10px' }}>
                    {(catalog.data?.vltStops ?? [5, 20, 35, 50, 70, 85]).map((v) => (
                      <option key={v} value={v}>{v}%{v < 70 ? ' ⚠' : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  VLT arrière
                  <select className="field mono" value={rearVlt} onChange={(e) => setRearVlt(Number(e.target.value))} style={{ padding: '8px 10px' }}>
                    {(catalog.data?.vltStops ?? [5, 20, 35, 50, 70, 85]).map((v) => (
                      <option key={v} value={v}>{v}%</option>
                    ))}
                  </select>
                </label>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text-soft)', alignSelf: 'center' }}>
                  {formatDuration(quote.minutes)} · {formatEuro(quote.total)}
                  {quote.nonCompliant ? ' · ⚠ hors conformité' : ''}
                </span>
              </div>
            </div>

            {/* slot */}
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>Créneau</span>
              <input
                className="field mono"
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value)
                  setSlotStart('')
                }}
                style={{ maxWidth: 200 }}
                aria-label="Date"
              />
              {day && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(slots.data ?? [])
                    .filter((s) => s.state !== 'taken')
                    .map((s) => (
                      <button
                        key={s.slotStart}
                        type="button"
                        className="chip mono"
                        aria-pressed={slotStart === s.slotStart}
                        style={slotStart === s.slotStart ? { borderColor: 'var(--octane-500)', color: 'var(--octane-300)' } : undefined}
                        onClick={() => setSlotStart(s.slotStart)}
                      >
                        {slotTimeFmt.format(new Date(s.slotStart))}
                      </button>
                    ))}
                  {!slots.isPending && (slots.data ?? []).filter((s) => s.state !== 'taken').length === 0 && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucun créneau libre ce jour.</span>
                  )}
                </div>
              )}
            </div>

            {/* contact */}
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <input className="field" placeholder="Nom du client *" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <input className="field" placeholder="Téléphone *" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              <input className="field" placeholder="E-mail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              <input className="field" placeholder="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</span>}

            <button
              type="button"
              className="cta"
              style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12, justifySelf: 'start' }}
              disabled={
                createMutation.isPending ||
                !slotStart ||
                quote.lines.length === 0 ||
                contactName.trim().length === 0 ||
                contactPhone.trim().length < 5
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Création…' : 'Créer la réservation (confirmée)'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
