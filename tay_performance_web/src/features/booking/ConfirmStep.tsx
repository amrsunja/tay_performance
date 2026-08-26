import { useState } from 'react'
import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { linkEmail } from '../../api/bookings'
import { addVehicle } from '../../api/garage'
import { errorMessage } from '../../lib/supabase'
import type { ResolvedVehicle } from '../../types/api'
import { formatDuration, formatEuro, type DraftAction, type DraftState } from './useBookingDraft'
import styles from './booking.module.css'

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  vehicle: ResolvedVehicle
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
})
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ConfirmStep({ state, dispatch, vehicle }: StepProps) {
  const { session, isAnonymous } = useAuth()
  const booking = state.result
  const [linkEmailValue, setLinkEmailValue] = useState(state.contactEmail)
  const [garageSaved, setGarageSaved] = useState(false)

  const linkMutation = useMutation({ mutationFn: (email: string) => linkEmail(email) })
  const garageMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('FORBIDDEN')
      await addVehicle(session.user.id, { variantId: vehicle.variantId })
    },
    onSuccess: () => setGarageSaved(true),
  })

  if (!booking) return null

  const start = new Date(booking.slot_start)
  const rows: [string, string, boolean?][] = [
    ['Date', capitalize(dateFmt.format(start))],
    ['Heure', timeFmt.format(start)],
    ['Prestation', booking.specs.map((s) => s.label_fr).join(', ')],
    ['Durée estimée', formatDuration(booking.duration_min)],
    ['Total à régler', formatEuro(Number(booking.price_total)), true],
  ]

  return (
    <section className={styles.stepConfirm}>
      <div className={styles.confirmInner}>
        <div className={styles.confirmBadge} aria-hidden>
          <span style={{ fontSize: 38 }}>✓</span>
        </div>
        <div className={`mono ${styles.confirmKicker}`}>
          {booking.old_reference ? 'Rendez-vous reprogrammé' : 'Demande envoyée'}
        </div>
        <h1 className={`clash ${styles.h1}`}>Votre créneau est réservé.</h1>
        <p className={styles.confirmLede}>
          L'atelier confirme votre rendez-vous rapidement — vous recevrez un e-mail dès validation.
          {booking.old_reference ? ` Votre ancienne réservation ${booking.old_reference} est annulée.` : ''}
        </p>

        <div className={styles.confirmCard}>
          <div className={styles.confirmCardHead}>
            <span>
              <span className={`mono ${styles.confirmFieldLabel}`}>RÉFÉRENCE</span>
              <span className={`mono ${styles.confirmRef}`}>{booking.reference}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className={`mono ${styles.confirmFieldLabel}`}>VÉHICULE</span>
              <span className={`sat ${styles.confirmVehicle}`}>
                {vehicle.make} {vehicle.generation} {vehicle.model}
              </span>
            </span>
          </div>
          <div className={styles.confirmRows}>
            {rows.map(([label, value, highlight]) => (
              <div key={label} className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{label}</span>
                <span className={highlight ? `mono ${styles.confirmRowTotal}` : styles.confirmRowValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* email linking offer — history recoverable on any device (docs/06 §1.5) */}
        {isAnonymous && (
          <div className={styles.confirmCard} style={{ marginTop: 16 }}>
            {linkMutation.isSuccess ? (
              <p style={{ fontSize: 14, color: 'var(--status-success)', margin: 0 }}>
                ✓ Vérifiez votre boîte mail pour confirmer le lien — vos réservations vous suivront partout.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 0 }}>
                  <b>Retrouvez vos réservations sur tous vos appareils.</b> Liez un e-mail à cette session — aucun mot
                  de passe, juste un lien magique.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    className="field"
                    type="email"
                    placeholder="votre@email.fr"
                    value={linkEmailValue}
                    onChange={(e) => setLinkEmailValue(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="ghost"
                    style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11 }}
                    disabled={!linkEmailValue.includes('@') || linkMutation.isPending}
                    onClick={() => linkMutation.mutate(linkEmailValue)}
                  >
                    {linkMutation.isPending ? 'Envoi…' : 'Lier cet e-mail'}
                  </button>
                </div>
                {linkMutation.isError && (
                  <p style={{ fontSize: 13, color: 'var(--status-warning)', marginBottom: 0 }}>
                    {errorMessage(linkMutation.error)} Cet e-mail a peut-être déjà un compte — utilisez le lien magique
                    depuis « Mes réservations ».
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* garage save offer for funnel-resolved vehicles */}
        {!vehicle.vehicleId && (
          <div style={{ marginTop: 14 }}>
            {garageSaved ? (
              <span style={{ fontSize: 14, color: 'var(--status-success)' }}>✓ Ajouté à Mon Garage</span>
            ) : (
              <button
                type="button"
                className="navlink"
                style={{ fontSize: 14 }}
                disabled={garageMutation.isPending}
                onClick={() => garageMutation.mutate()}
              >
                + Ajouter {vehicle.make} {vehicle.model} à Mon Garage
              </button>
            )}
          </div>
        )}

        <div className={styles.confirmActions}>
          <Link
            to="/reservations"
            className="cta"
            style={{ fontSize: 15, padding: '15px 26px', borderRadius: 13 }}
          >
            Voir mes réservations
          </Link>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 15, fontWeight: 500, padding: '15px 26px', borderRadius: 13 }}
            onClick={() => dispatch({ type: 'restart' })}
          >
            Nouvelle réservation
          </button>
          <Link to="/" className="ghost" style={{ fontSize: 15, fontWeight: 500, padding: '15px 26px', borderRadius: 13 }}>
            Retour au site
          </Link>
        </div>
      </div>
    </section>
  )
}
