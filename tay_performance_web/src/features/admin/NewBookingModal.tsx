/* Admin manual booking (walk-in / phone) — same flow as the client funnel, step by step:
   prestation → tint: véhicule + plan de pose | personnalisée: description → créneau + client.
   Lands directly as `confirmed` (admin_create_booking / admin_create_custom_booking). */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import baseFront from '../../assets/bmw_original_front.png'
import visuelCustom from '../../assets/visuel1.jpg'
import Modal from '../../components/ui/Modal'
import PhoneInput from '../../components/ui/PhoneInput'
import { isValidEmail } from '../../api/auth'
import VehicleFunnel from '../booking/VehicleStep'
import TintBlueprint from '../booking/TintBlueprint'
import { TlvPicker } from '../booking/ConfigStep'
import { getCatalog } from '../../api/catalog'
import { adminCreateBooking } from '../../api/admin'
import { adminCreateCustomBooking } from '../../api/serviceRequests'
import { errorMessage } from '../../lib/supabase'
import { computeLocalQuote, formatDuration, formatEuro, formatPrice, INITIAL_DRAFT, zonePrice } from '../booking/useBookingDraft'
import type { ResolvedVehicle } from '../../types/api'
import Icon from '../../components/ui/Icon'
import { CUSTOM_SERVICES, TLV_STOPS, type TintZoneCode } from '../../types/domain'
import SlotPicker, { type SlotConflictState } from './SlotPicker'
import ClientPicker, { type PickedClient } from './ClientPicker'
import { CUSTOM_DURATIONS, parsePriceInput } from './customBooking'
import booking from '../booking/booking.module.css'
import styles from './admin.module.css'

type Step = 'service' | 'vehicle' | 'config' | 'custom' | 'final'

const STEP_TEXT: Record<Step, string> = {
  service: 'Prestation',
  vehicle: 'Véhicule',
  config: 'Plan de pose',
  custom: 'Description',
  final: 'Créneau et client',
}

export default function NewBookingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('service')
  const [kind, setKind] = useState<'tint' | 'custom'>('tint')
  // tint
  const [vehicle, setVehicle] = useState<ResolvedVehicle | null>(null)
  const [selected, setSelected] = useState<TintZoneCode[]>(['rear_sides'])
  const [frontVlt, setFrontVlt] = useState(70)
  const [rearVlt, setRearVlt] = useState(20)
  // personalized
  const [title, setTitle] = useState('')
  const [customVehicle, setCustomVehicle] = useState('')
  const [duration, setDuration] = useState(120)
  const [adminMessage, setAdminMessage] = useState('')
  // both
  const [slotStart, setSlotStart] = useState('')
  const [conflict, setConflict] = useState<SlotConflictState>('none')
  const [client, setClient] = useState<PickedClient | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  // price: '' = auto (quote) or to set later (personalized), otherwise the admin's own total
  const [priceInput, setPriceInput] = useState('')
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

  const price = parsePriceInput(priceInput)
  const priceOverride = kind === 'tint' && price.value !== null && price.valid && price.value !== quote.total ? price.value : null
  const onRequest = quote.onRequest && quote.lines.length > 0
  const emailOk = contactEmail.trim() === '' || isValidEmail(contactEmail.trim())

  const createMutation = useMutation({
    mutationFn: () =>
      kind === 'tint'
        ? adminCreateBooking({
            variantId: vehicle!.variantId,
            specs: quote.specs,
            slotStartISO: slotStart,
            contactName,
            contactPhone,
            contactEmail: contactEmail.trim() || null,
            clientNotes: notes || null,
            priceOverride,
            userId: client?.id ?? null,
            allowOverlap: conflict === 'accepted',
          })
        : adminCreateCustomBooking({
            title: title.trim(),
            slotStartISO: slotStart,
            durationMin: duration,
            contactName,
            contactPhone,
            contactEmail: contactEmail.trim() || null,
            clientNotes: notes,
            vehicle: customVehicle,
            price: price.value,
            adminMessage,
            userId: client?.id ?? null,
            allowOverlap: conflict === 'accepted',
          }),
    onSuccess: (r) => {
      setReference(r.reference)
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const applyClient = (c: PickedClient | null) => {
    setClient(c)
    setContactName(c?.name ?? '')
    setContactPhone(c?.phone ?? '')
    setContactEmail(c?.email ?? '')
  }

  const toggleZone = (zone: TintZoneCode) =>
    setSelected((s) => (s.includes(zone) ? s.filter((z) => z !== zone) : [...s, zone]))

  if (reference) {
    return (
      <Modal title="Réservation créée" onClose={onClose}>
        <div style={{ display: 'grid', gap: 12 }}>
          <span style={{ color: 'var(--status-success)', fontSize: 15 }}>
            <Icon name="check" size={15} /> <span className="mono">{reference}</span> — confirmée{contactName.trim() ? ` pour ${contactName.trim()}` : ''}
            {priceOverride !== null ? ` · ${formatEuro(priceOverride)}${onRequest ? '' : ' (prix modifié)'}` : ''}.
          </span>
          <button type="button" className="cta" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }} onClick={onClose}>
            Fermer
          </button>
        </div>
      </Modal>
    )
  }

  const stepPath: Step[] = kind === 'tint' ? ['service', 'vehicle', 'config', 'final'] : ['service', 'custom', 'final']
  const stepIndex = stepPath.indexOf(step)
  const back = () => setStep(stepPath[stepIndex - 1])
  const zones = catalog.data?.zones ?? []
  const stops = catalog.data?.vltStops ?? [...TLV_STOPS]
  const durationMin = kind === 'tint' ? quote.minutes : duration

  return (
    <Modal title="Nouvelle réservation" wide onClose={onClose}>
      <div className={styles.formStack}>
        <div className={`mono ${styles.wizardSteps}`}>
          Étape {stepIndex + 1}/{stepPath.length} · {STEP_TEXT[step]}
        </div>

        {step === 'service' && (
          <div className={booking.serviceGrid} style={{ marginTop: 0 }}>
            <button
              type="button"
              className={booking.serviceCard}
              onClick={() => {
                setKind('tint')
                setStep('vehicle')
              }}
            >
              <span className={booking.serviceArt}>
                <img src={baseFront} alt="" />
              </span>
              <span className={`sat ${booking.serviceTitle}`}>Vitres teintées</span>
              <span className={booking.serviceBody}>Véhicule, plan de pose, prix calculé automatiquement.</span>
            </button>
            <button
              type="button"
              className={booking.serviceCard}
              onClick={() => {
                setKind('custom')
                setStep('custom')
              }}
            >
              <span className={booking.serviceArt}>
                <img src={visuelCustom} alt="" />
              </span>
              <span className={`sat ${booking.serviceTitle}`}>Prestation personnalisée</span>
              <span className={booking.serviceBody}>Covering, sellerie, detailing… avec votre durée et votre prix.</span>
            </button>
          </div>
        )}

        {step === 'vehicle' && (
          <VehicleFunnel
            compact
            hideRequest
            onResolved={(v) => {
              setVehicle(v)
              setStep('config')
            }}
          />
        )}

        {step === 'config' && vehicle && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="chip">{vehicle.make} {vehicle.generation} {vehicle.model} · {vehicle.bodyLabel}</span>
            </div>
            <div className={styles.wizardConfig}>
              <TintBlueprint
                inline
                selected={selected}
                frontVlt={frontVlt}
                rearVlt={rearVlt}
                vehicleLabel={`${vehicle.make} ${vehicle.model}`}
              />
              <div className={styles.formStack}>
                <div className={styles.formGroup}>
                  <span className={styles.formLabel}>Vitres à teinter</span>
                  <div className={booking.zoneList}>
                    {zones.map((zone) => {
                      const on = selected.includes(zone.code)
                      const rule = catalog.data?.rules[vehicle.bodyStyle]
                      const override = vehicle.modelId ? catalog.data?.modelOverrides[vehicle.modelId] : undefined
                      return (
                        <button
                          key={zone.code}
                          type="button"
                          className={`${booking.zoneRow} ${on ? booking.zoneRowOn : ''}`}
                          aria-pressed={on}
                          onClick={() => toggleZone(zone.code)}
                        >
                          <span className={`${booking.zoneBox} ${on ? booking.zoneBoxOn : ''}`} aria-hidden>
                            <Icon name="check" size={14} strokeWidth={2.6} />
                          </span>
                          <span className={booking.zoneBody}>
                            <span className={booking.zoneName}>{zone.labelFr}</span>
                          </span>
                          <span className={`mono ${booking.zonePrice}`}>
                            {quote.onRequest ? 'sur devis' : formatEuro(zonePrice(zone, rule, override).price)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <span className={styles.formLabel}>TLV avant · {frontVlt}%{frontVlt < 70 ? ' (non conforme)' : ''}</span>
                  <TlvPicker value={frontVlt} onChange={setFrontVlt} front stops={stops} />
                </div>
                <div className={styles.formGroup}>
                  <span className={styles.formLabel}>TLV arrière · {rearVlt}%</span>
                  <TlvPicker value={rearVlt} onChange={setRearVlt} front={false} stops={stops} />
                </div>
                <div className={styles.wizardTotal}>
                  <span>{formatDuration(quote.minutes)}{quote.nonCompliant ? ' · hors conformité' : ''}</span>
                  <b className="mono">{formatPrice(quote.total)}</b>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'custom' && (
          <>
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Prestation *</span>
              <div className={styles.chipRow}>
                {CUSTOM_SERVICES.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={title === s} onClick={() => setTitle(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <input className="field" maxLength={200} placeholder="Ou un titre libre : covering toit noir brillant…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titre de la prestation" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="nb-vehicle">Véhicule</label>
              <input id="nb-vehicle" className="field" maxLength={200} placeholder="Marque, modèle (facultatif)" value={customVehicle} onChange={(e) => setCustomVehicle(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="nb-duration">Durée</label>
              <select id="nb-duration" className="field mono" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {CUSTOM_DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>{d.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 'final' && (
          <>
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Créneau · {formatDuration(durationMin)}</span>
              <SlotPicker durationMin={durationMin} value={slotStart} onChange={setSlotStart} onConflictChange={setConflict} />
            </div>

            {/* one field per line, full width, phone and desktop alike */}
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Client</span>
              <ClientPicker value={client} onChange={applyClient} />
              <input className="field" placeholder="Nom du client (facultatif)" autoComplete="off" value={contactName} onChange={(e) => setContactName(e.target.value)} aria-label="Nom du client" />
              {/* remounted on a pick: the input keeps its own typed text otherwise */}
              <PhoneInput key={client?.id ?? 'new'} value={contactPhone} onChange={setContactPhone} aria-label="Téléphone *" />
              <input className="field" placeholder="E-mail (facultatif)" type="email" autoComplete="off" aria-invalid={!emailOk || undefined} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} aria-label="E-mail" />
              <input className="field" placeholder="Note" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Note" />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="nb-price">Prix (€)</label>
              <input
                id="nb-price"
                className="field mono"
                inputMode="decimal"
                placeholder={kind === 'custom' ? 'Vide = à fixer plus tard' : quote.total == null ? 'sur devis' : quote.total.toFixed(2)}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value.replace(/[^\d.,]/g, ''))}
                aria-invalid={!price.valid || undefined}
                style={{ borderColor: !price.valid ? 'var(--status-warning)' : priceOverride !== null ? 'var(--octane-500)' : undefined }}
              />
              {kind === 'tint' && (
                onRequest ? (
                  <span className={`mono ${styles.formHint}`} style={{ color: 'var(--octane-300)' }}>
                    {price.value === null ? 'sur devis — laissez vide pour fixer le prix plus tard' : 'prix fixé (visible par le client)'}
                  </span>
                ) : priceOverride !== null ? (
                  <span className={`mono ${styles.formHint}`} style={{ color: 'var(--octane-300)' }}>
                    prix modifié · calculé {formatPrice(quote.total)}{' '}
                    <button type="button" className="navlink mono" style={{ fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => setPriceInput('')}>
                      remettre le prix auto
                    </button>
                  </span>
                ) : (
                  <span className={`mono ${styles.formHint}`}>calculé automatiquement — modifiez pour appliquer une remise / majoration</span>
                )
              )}
            </div>

            {kind === 'custom' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="nb-message">Message au client</label>
                <textarea
                  id="nb-message"
                  className="field"
                  rows={2}
                  maxLength={1000}
                  placeholder="Inclus dans sa confirmation (facultatif)"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            )}

            {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</span>}
          </>
        )}

        {step !== 'service' && (
          <div className={styles.formActions}>
            <button type="button" className="ghost" style={{ fontSize: 14, padding: '13px 20px', borderRadius: 12 }} onClick={back}>
              <Icon name="arrow-left" size={15} /> Retour
            </button>
            {step === 'config' && (
              <button type="button" className="cta" style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12 }} disabled={quote.lines.length === 0} onClick={() => setStep('final')}>
                Continuer <Icon name="arrow-right" size={15} />
              </button>
            )}
            {step === 'custom' && (
              <button type="button" className="cta" style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12 }} disabled={title.trim().length < 2} onClick={() => setStep('final')}>
                Continuer <Icon name="arrow-right" size={15} />
              </button>
            )}
            {step === 'final' && (
              <button
                type="button"
                className="cta"
                style={{ fontSize: 14, padding: '13px 24px', borderRadius: 12 }}
                disabled={createMutation.isPending || !slotStart || conflict === 'unresolved' || !contactPhone || !emailOk || !price.valid}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Création…' : 'Créer la réservation (confirmée)'}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
