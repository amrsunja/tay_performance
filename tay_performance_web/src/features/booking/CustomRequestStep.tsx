/* Personalized reservation request (0023): what + who, never a date —
   the workshop calls the client back and confirms with its own date, price and message. */
import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { isValidEmail } from '../../api/auth'
import { getMyProfile } from '../../api/profile'
import { createServiceRequest } from '../../api/serviceRequests'
import { e164FromStored } from '../../lib/phone'
import { errorMessage } from '../../lib/supabase'
import PhoneInput from '../../components/ui/PhoneInput'
import Icon from '../../components/ui/Icon'
import { CUSTOM_SERVICES } from '../../types/domain'
import type { DraftAction } from './useBookingDraft'
import styles from './booking.module.css'

const MIN_MESSAGE = 10

export default function CustomRequestStep({ dispatch }: { dispatch: Dispatch<DraftAction> }) {
  const { ensureSession, session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(userId!),
    enabled: Boolean(userId),
  })

  const [service, setService] = useState<string>(CUSTOM_SERVICES[0])
  const [vehicle, setVehicle] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')

  // known client: nothing to retype (fields stay editable)
  useEffect(() => {
    if (!profile.data) return
    setName((v) => v || profile.data?.fullName || '')
    setPhone((v) => v || e164FromStored(profile.data?.phone) || e164FromStored(session?.user.phone))
    setEmail((v) => v || profile.data?.email || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data])

  const submit = useMutation({
    mutationFn: async () => {
      await ensureSession()
      return createServiceRequest({
        serviceLabel: service,
        message,
        contactPhone: phone,
        contactEmail: email.trim(),
        contactName: name,
        vehicle,
      })
    },
    onSuccess: (r) => {
      setError('')
      setReference(r.reference)
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (reference) {
    return (
      <section className={styles.stepConfirm}>
        <div className={styles.confirmInner}>
          <div className={styles.confirmBadge} aria-hidden>
            <Icon name="check" size={40} strokeWidth={2.2} />
          </div>
          <div className={`mono ${styles.confirmKicker}`}>Demande envoyée</div>
          <h1 className={`clash ${styles.h1}`}>L'atelier vous rappelle.</h1>
          <p className={styles.confirmLede}>
            Nous fixons ensemble la date, l'heure et le prix par téléphone. Vous recevez ensuite la confirmation par e-mail et
            SMS, et votre rendez-vous apparaît dans vos réservations.
          </p>
          <div className={styles.confirmCard}>
            <div className={styles.confirmRows}>
              <div className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>Référence</span>
                <span className={`mono ${styles.confirmRowTotal}`}>{reference}</span>
              </div>
              <div className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>Prestation</span>
                <span className={styles.confirmRowValue}>{service}</span>
              </div>
            </div>
          </div>
          <div className={styles.confirmActions}>
            <Link to="/reservations" className="cta" style={{ fontSize: 15, padding: '15px 26px', borderRadius: 13 }}>
              Voir mes réservations
            </Link>
            <Link to="/" className="ghost" style={{ fontSize: 15, fontWeight: 500, padding: '15px 26px', borderRadius: 13 }}>
              Retour au site
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const emailOk = isValidEmail(email.trim())
  const messageOk = message.trim().length >= MIN_MESSAGE

  return (
    <section className={styles.step}>
      <div className={styles.stepInnerNarrow}>
        <button type="button" className={`navlink mono ${styles.stepBack}`} onClick={() => dispatch({ type: 'restart' })}>
          <Icon name="arrow-left" size={13} /> Changer de prestation
        </button>
        <div className={styles.kickerRow}>
          <span className={styles.kickerLine} />
          <span className={`mono ${styles.kicker}`}>Demande personnalisée</span>
        </div>
        <h1 className={`clash ${styles.h1}`}>
          Parlez-nous de votre projet<span style={{ color: 'var(--accent-500)' }}>.</span>
        </h1>
        <p className={styles.lede}>Pas de date à choisir : l'atelier vous appelle pour l'organiser avec vous.</p>

        <div className={styles.requestCard}>
          <div>
            <span className={styles.requestLabel}>Prestation</span>
            <div className={styles.requestChips} role="group" aria-label="Prestation">
              {CUSTOM_SERVICES.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={service === s} onClick={() => setService(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={styles.requestLabel} htmlFor="req-message">Votre demande *</label>
            <textarea
              id="req-message"
              className="field"
              rows={5}
              maxLength={2000}
              placeholder="Ex : covering noir mat complet sur ma Golf 8, livraison souhaitée avant juin…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label className={styles.requestLabel} htmlFor="req-vehicle">Véhicule (facultatif)</label>
            <input id="req-vehicle" className="field" maxLength={200} placeholder="Marque, modèle, année" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </div>

          <div>
            <label className={styles.requestLabel} htmlFor="req-name">Nom (facultatif)</label>
            <input id="req-name" className="field" autoComplete="name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <span className={styles.requestLabel}>Téléphone *</span>
            <PhoneInput value={phone} onChange={setPhone} aria-label="Téléphone *" />
          </div>

          <div>
            <label className={styles.requestLabel} htmlFor="req-email">E-mail *</label>
            <input
              id="req-email"
              className="field"
              type="email"
              autoComplete="email"
              aria-invalid={(email.trim() !== '' && !emailOk) || undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <div style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">{error}</div>}

          <button
            type="button"
            className="cta"
            style={{ width: '100%', fontSize: 16, padding: 16, borderRadius: 13 }}
            disabled={!messageOk || !phone || !emailOk || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? 'Envoi…' : 'Envoyer ma demande'} <Icon name="arrow-right" size={18} />
          </button>
          <span className={styles.requestHint}>Sans engagement. Vous pouvez annuler votre demande depuis « Mes réservations ».</span>
        </div>
      </div>
    </section>
  )
}
