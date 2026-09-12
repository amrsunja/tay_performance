import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import logo from '../../assets/logo.svg'
import { useReveal } from '../../hooks/useReveal'
import { useSeo } from '../../lib/seo'
import { getCatalog } from '../../api/catalog'
import { getMyBooking } from '../../api/bookings'
import { getMyVehicles } from '../../api/garage'
import { resolveVariant } from '../../api/taxonomy'
import { releaseHold } from '../../api/availability'
import type { TintZoneCode } from '../../types/domain'
import { nearestTlv, normalizeSelection, useBookingDraft, useLocalQuote, zonePrice, type BookingStep } from './useBookingDraft'
import VehicleFunnel from './VehicleStep'
import ConfigStep from './ConfigStep'
import CalendarStep from './CalendarStep'
import ConfirmStep from './ConfirmStep'
import styles from './booking.module.css'

const STEP_ORDER: BookingStep[] = ['vehicle', 'config', 'calendar', 'confirm']
const STEP_LABELS: Record<BookingStep, string> = {
  vehicle: 'Véhicule',
  config: 'Configuration',
  calendar: 'Créneau',
  confirm: 'Confirmé',
}

const FRONT_ZONES: TintZoneCode[] = ['pare_brise', 'front_sides']

export default function BookingPage() {
  const { state, dispatch, quote } = useBookingPageState()
  useSeo({
    title: 'Réserver une pose de vitres teintées en ligne — Strasbourg / Illkirch',
    description:
      'Configurez votre véhicule, vos zones et votre teinte : prix et durée en direct, créneaux réels à l’atelier Tay Performance d’Illkirch-Graffenstaden. Réservation en ligne sans compte.',
    path: '/reserver',
  })
  useReveal([state.step])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [state.step])

  const stepIndex = STEP_ORDER.indexOf(state.step)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label="Retour à l'accueil">
          <img src={logo} alt="Tay Performance" className={styles.logo} />
        </Link>
        <div className={styles.headerRight}>
          <div className={styles.stepper} aria-label="Progression de la réservation">
            {STEP_ORDER.map((step, i) => (
              <span key={step} className={styles.stepperItem}>
                <span
                  className={[
                    styles.stepDot,
                    i === stepIndex ? styles.stepDotActive : '',
                    i < stepIndex ? styles.stepDotDone : '',
                  ].join(' ')}
                />
                <span
                  className={`mono ${styles.stepLabel}`}
                  style={i === stepIndex ? { color: 'var(--text-dim)' } : undefined}
                >
                  {STEP_LABELS[step]}
                </span>
                {i < STEP_ORDER.length - 1 && <span className={styles.stepLink} />}
              </span>
            ))}
          </div>
          <a href="tel:0605505028" className={`navlink ${styles.headerPhone}`}>
            06 05 50 50 28
          </a>
        </div>
      </header>

      {state.step === 'vehicle' && (
        <section className={styles.step}>
          <div className={styles.stepInnerNarrow}>
            <div data-reveal>
              <div className={styles.kickerRow}>
                <span className={styles.kickerLine} />
                <span className={`mono ${styles.kicker}`}>Étape 1 · Votre véhicule</span>
              </div>
              <h1 className={`clash ${styles.h1}`}>
                Quel véhicule teinter<span style={{ color: 'var(--accent-500)' }}>&nbsp;?</span>
              </h1>
              <p className={styles.lede}>
                Marque, modèle, génération, carrosserie. C'est la carrosserie qui donne la surface vitrée réelle —
                donc le prix et le temps de pose. Aucun compte à créer, aucun acompte.
              </p>
            </div>
            <div data-reveal style={{ marginTop: 26 }}>
              <VehicleFunnel onResolved={(vehicle) => dispatch({ type: 'setVehicle', vehicle })} />
            </div>
          </div>
        </section>
      )}

      {state.step === 'config' && state.vehicle && (
        <ConfigStep state={state} dispatch={dispatch} quote={quote.local} zones={quote.zones} zonePrices={quote.zonePrices} vehicle={state.vehicle} />
      )}
      {state.step === 'calendar' && state.vehicle && (
        <CalendarStep state={state} dispatch={dispatch} quote={quote.local} vehicle={state.vehicle} />
      )}
      {state.step === 'confirm' && state.vehicle && (
        <ConfirmStep state={state} dispatch={dispatch} vehicle={state.vehicle} />
      )}

      <footer className={styles.footer}>
        <span className="mono">© {new Date().getFullYear()} Tay Performance · 19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden</span>
        <span className="mono">
          <Link to="/mentions-legales" className="navlink">Mentions légales</Link>
          {' · '}
          <Link to="/confidentialite" className="navlink">Confidentialité</Link>
          {' · '}
          <Link to="/cgv" className="navlink">CGV</Link>
        </span>
      </footer>
    </div>
  )
}

/** Draft + catalog + URL hydration (garage vehicle / variant / reschedule). */
function useBookingPageState() {
  const { state, dispatch } = useBookingDraft()
  const [params] = useSearchParams()
  const hydratedRef = useRef(false)

  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  const local = useLocalQuote(catalog.data, state)

  // release any dangling hold when leaving the funnel entirely
  useEffect(() => {
    return () => {
      releaseHold()
    }
  }, [])

  useEffect(() => {
    if (hydratedRef.current) return
    const vehicleId = params.get('vehicle')
    const variantId = params.get('variant')
    const rescheduleId = params.get('reschedule')
    if (!vehicleId && !variantId && !rescheduleId) {
      hydratedRef.current = true
      return
    }
    hydratedRef.current = true
    ;(async () => {
      try {
        if (rescheduleId) {
          const booking = await getMyBooking(rescheduleId)
          if (!booking) return
          const resolved = await resolveVariant(booking.variantId)
          if (!resolved) return
          // legacy bookings may carry rear_window / panoramic_roof / 85 % — fold onto the v2 packs
          const selected = normalizeSelection(booking.specs.map((s) => s.zone))
          const front = booking.specs.find((s) => FRONT_ZONES.includes(s.zone))
          const rear = booking.specs.find((s) => !FRONT_ZONES.includes(s.zone))
          dispatch({ type: 'setReschedule', bookingId: rescheduleId })
          if (booking.forOther) {
            dispatch({ type: 'setForOther', value: true })
            dispatch({ type: 'setContact', field: 'contactName', value: booking.contactName })
          }
          dispatch({
            type: 'hydrateSpecs',
            selected,
            frontVlt: nearestTlv(front?.vltPercent ?? 70),
            rearVlt: nearestTlv(rear?.vltPercent ?? 20),
          })
          dispatch({ type: 'setVehicle', vehicle: resolved })
        } else if (vehicleId) {
          const vehicles = await getMyVehicles()
          const v = vehicles.find((x) => x.vehicleId === vehicleId)
          if (v) dispatch({ type: 'setVehicle', vehicle: v })
        } else if (variantId) {
          const resolved = await resolveVariant(variantId)
          if (resolved) dispatch({ type: 'setVehicle', vehicle: resolved })
        }
      } catch {
        // hydration is best-effort; the funnel remains usable
      }
    })()
  }, [params, dispatch])

  const zonePrices = useMemo(() => {
    const out: Partial<Record<TintZoneCode, number>> = {}
    if (!catalog.data || !state.vehicle) return out
    const rule = catalog.data.rules[state.vehicle.bodyStyle]
    const override = state.vehicle.modelId ? catalog.data.modelOverrides[state.vehicle.modelId] : undefined
    for (const z of catalog.data.zones) out[z.code] = zonePrice(z, rule, override).price
    return out
  }, [catalog.data, state.vehicle])

  return { state, dispatch, quote: { local, zones: catalog.data?.zones ?? [], zonePrices } }
}
