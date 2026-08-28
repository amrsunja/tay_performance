import { useEffect, useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { getDaySlots, getMonthAvailability, holdSlot, releaseHold } from '../../api/availability'
import { createBooking } from '../../api/bookings'
import { getMyProfile } from '../../api/profile'
import { isValidEmail } from '../../api/auth'
import { normalizePhone } from '../../lib/phone'
import { errorMessage } from '../../lib/supabase'
import PhoneInput from '../../components/ui/PhoneInput'
import type { ResolvedVehicle, SlotInfo } from '../../types/api'
import { dayLabel, getMonth } from './calendar'
import { formatDuration, formatEuro, type DraftAction, type DraftState, type LocalQuote } from './useBookingDraft'
import styles from './booking.module.css'

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  quote: LocalQuote
  vehicle: ResolvedVehicle
}

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const MAX_MONTH_OFFSET = 2

const slotTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export default function CalendarStep({ state, dispatch, quote, vehicle }: StepProps) {
  const { ensureSession, session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(userId!),
    enabled: Boolean(userId),
  })
  const profileName = profile.data?.fullName ?? ''
  const profilePhone = normalizePhone(profile.data?.phone ?? '') ?? ''
  const profileEmail = profile.data?.email ?? ''
  const profileComplete = profileName.length > 0 && profilePhone.length > 0 && isValidEmail(profileEmail)

  // "pour moi" → prefill the contact from the profile once (fields stay editable)
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (prefilled || !profile.data || state.forOther) return
    if (!state.contactName && profileName) dispatch({ type: 'setContact', field: 'contactName', value: profileName })
    if (!state.contactPhone && profilePhone) dispatch({ type: 'setContact', field: 'contactPhone', value: profilePhone })
    if (!state.contactEmail && profileEmail) dispatch({ type: 'setContact', field: 'contactEmail', value: profileEmail })
    setPrefilled(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data])

  const setForOther = (value: boolean) => {
    if (value === state.forOther) return
    dispatch({ type: 'setForOther', value })
    if (value) {
      // the contact block now describes the OTHER person: clear the profile's values
      for (const f of ['contactName', 'contactPhone', 'contactEmail'] as const) dispatch({ type: 'setContact', field: f, value: '' })
      dispatch({ type: 'setContact', field: 'bookerName', value: profileName })
      dispatch({ type: 'setContact', field: 'bookerPhone', value: profilePhone })
      dispatch({ type: 'setContact', field: 'bookerEmail', value: profileEmail })
    } else {
      dispatch({ type: 'setContact', field: 'contactName', value: profileName })
      dispatch({ type: 'setContact', field: 'contactPhone', value: profilePhone })
      dispatch({ type: 'setContact', field: 'contactEmail', value: profileEmail })
    }
  }
  const month = getMonth(state.monthOffset)
  const today = new Date()
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)

  const duration = quote.minutes

  const monthAvail = useQuery({
    queryKey: ['availability', 'month', month.year, month.month + 1, duration],
    queryFn: () => getMonthAvailability(month.year, month.month + 1, duration),
    enabled: duration > 0,
    staleTime: 15_000,
  })

  const availByDay = useMemo(() => {
    const map = new Map<number, { state: string; freeCount: number }>()
    for (const d of monthAvail.data ?? []) {
      map.set(Number(d.day.slice(8, 10)), { state: d.state, freeCount: d.freeCount })
    }
    return map
  }, [monthAvail.data])

  const selectedDay =
    state.selectedDate && state.selectedDate.month === month.month && state.selectedDate.year === month.year
      ? state.selectedDate.day
      : null
  const dayISO = selectedDay ? `${month.year}-${pad(month.month + 1)}-${pad(selectedDay)}` : null

  const daySlots = useQuery({
    queryKey: ['availability', 'day', dayISO, duration],
    queryFn: () => getDaySlots(dayISO!, duration),
    enabled: Boolean(dayISO) && duration > 0,
    staleTime: 0,
    refetchInterval: 30_000,
  })

  const refreshAvailability = () => {
    queryClient.invalidateQueries({ queryKey: ['availability'] })
  }

  const holdMutation = useMutation({
    mutationFn: async (slot: SlotInfo) => {
      await ensureSession()
      return holdSlot(slot.slotStart, duration, slot.bay)
    },
    onSuccess: (hold) => {
      setError('')
      dispatch({ type: 'setHold', hold })
    },
    onError: (e) => {
      setError(errorMessage(e))
      dispatch({ type: 'clearHold' })
      refreshAvailability()
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!state.hold) throw new Error('HOLD_EXPIRED')
      return createBooking({
        holdId: state.hold.holdId,
        variantId: vehicle.variantId,
        vehicleId: vehicle.vehicleId ?? null,
        specs: quote.specs,
        contactName: state.contactName,
        contactPhone: state.contactPhone,
        contactEmail: state.contactEmail || null,
        clientNotes: state.clientNotes || null,
        ack: state.ack,
        rescheduleOf: state.rescheduleOf,
        forOther: state.forOther,
        bookerName: state.forOther ? state.bookerName || null : null,
        bookerPhone: state.forOther ? state.bookerPhone || null : null,
        bookerEmail: state.forOther ? state.bookerEmail || null : null,
      })
    },
    onSuccess: (result) => {
      setError('')
      // the booking also auto-saves the vehicle and syncs the profile server-side —
      // drop every affected cache so /garage, /reservations and /profil are fresh
      // immediately (fixes "data only appears after switching tabs")
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['garage'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      dispatch({ type: 'setResult', result })
    },
    onError: (e) => {
      setError(errorMessage(e))
      const msg = String((e as { message?: string })?.message ?? '')
      if (msg.includes('SLOT_TAKEN') || msg.includes('HOLD_EXPIRED') || msg.includes('DURATION_CHANGED')) {
        dispatch({ type: 'clearHold' })
        refreshAvailability()
      }
    },
  })

  // hold countdown
  useEffect(() => {
    if (!state.hold) {
      setRemaining(null)
      return
    }
    const expires = new Date(state.hold.expiresAt).getTime()
    const tick = () => {
      const left = Math.max(0, Math.floor((expires - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        dispatch({ type: 'clearHold' })
        setError('Créneau expiré — choisissez à nouveau.')
        refreshAvailability()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hold?.holdId])

  const backToConfig = () => {
    releaseHold()
    dispatch({ type: 'clearHold' })
    dispatch({ type: 'goStep', step: 'config' })
  }

  const heldStart = state.hold?.slotStart ?? null
  // name, phone AND email are required (server enforces the same rule)
  const contactOk =
    state.contactName.trim().length > 0 &&
    /^\+\d{8,15}$/.test(state.contactPhone) &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.contactEmail.trim())
  // booking for someone else → the booker's own contact must be complete too
  const bookerOk =
    !state.forOther ||
    (state.bookerName.trim().length > 0 && /^\+\d{8,15}$/.test(state.bookerPhone) && isValidEmail(state.bookerEmail.trim()))
  const showBookerFields = state.forOther && !profileComplete

  return (
    <section className={styles.step}>
      <div className={styles.stepInnerNarrow}>
        <div className={styles.calendarHead}>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Étape 3 · Choisir un créneau</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Disponibilités atelier<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
          </div>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 14, fontWeight: 500, padding: '13px 20px', borderRadius: 12 }}
            onClick={backToConfig}
          >
            ← Modifier la configuration
          </button>
        </div>

        <div className={styles.calendarGridWrap}>
          {/* ---------- recap ---------- */}
          <aside className={styles.recapCard}>
            <div className={styles.recapVehicle}>
              <span className={`mono ${styles.vehicleBadge}`}>{vehicle.badge}</span>
              <span>
                <span className={`sat ${styles.vehicleName}`}>
                  {vehicle.make} {vehicle.generation} {vehicle.model}
                </span>
                <span className={`mono ${styles.vehicleMeta}`}>
                  {vehicle.bodyLabel} · {vehicle.years}
                </span>
              </span>
            </div>
            <div className={styles.recapTitle}>Votre pose</div>
            <div className={styles.recapLines}>
              {quote.lines.map((line) => (
                <div key={line.zone.code} className={styles.summaryLine}>
                  <span>{line.zone.labelFr}</span>
                  <span className={`mono ${styles.summaryVlt}`}>
                    {line.vlt}% · {formatEuro(line.price)}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.summaryDivider} />
            <div className={styles.summaryMeta}>
              <span>Durée</span>
              <span className="mono">{formatDuration(quote.minutes)}</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span className={`sat ${styles.summaryTotalLabel}`}>Total</span>
              <span className={`mono ${styles.summaryTotal}`} style={{ fontSize: 26 }}>
                {formatEuro(quote.total)}
              </span>
            </div>
          </aside>

          {/* ---------- calendar ---------- */}
          <div className={styles.calendarCol}>
            <div className={styles.calCard}>
              <div className={styles.calNav}>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="Mois précédent"
                  disabled={state.monthOffset === 0}
                  onClick={() => dispatch({ type: 'setMonthOffset', value: state.monthOffset - 1 })}
                >
                  ‹
                </button>
                <div className={`sat ${styles.calLabel}`}>{month.label}</div>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="Mois suivant"
                  disabled={state.monthOffset >= MAX_MONTH_OFFSET}
                  onClick={() => dispatch({ type: 'setMonthOffset', value: state.monthOffset + 1 })}
                >
                  ›
                </button>
              </div>
              <div className={styles.calWeekRow}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className={`mono ${styles.calWeekDay}`}>
                    {d}
                  </div>
                ))}
              </div>
              <div className={styles.calGrid}>
                {Array.from({ length: month.firstWeekday }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: month.days }).map((_, i) => {
                  const day = i + 1
                  const avail = availByDay.get(day) ?? { state: monthAvail.isPending ? 'loading' : 'closed', freeCount: 0 }
                  const isToday =
                    today.getFullYear() === month.year && today.getMonth() === month.month && today.getDate() === day
                  const isSelected = selectedDay === day
                  const clickable = avail.state === 'available'
                  const cls = [
                    styles.calDay,
                    avail.state === 'past' || avail.state === 'closed' || avail.state === 'loading' ? styles.calDayMuted : '',
                    avail.state === 'full' ? styles.calDayFull : '',
                    isToday ? styles.calDayToday : '',
                    isSelected ? styles.calDaySelected : '',
                  ].join(' ')
                  return (
                    <button
                      key={day}
                      type="button"
                      className={cls}
                      disabled={!clickable}
                      onClick={() =>
                        dispatch({ type: 'selectDate', date: { year: month.year, month: month.month, day } })
                      }
                    >
                      <span className={`mono ${styles.calDayNum}`}>{day}</span>
                      {avail.state === 'available' && (
                        <>
                          <span className={`mono ${styles.calDaySub}`}>
                            {avail.freeCount} libre{avail.freeCount > 1 ? 's' : ''}
                          </span>
                          <span className={styles.calDot} aria-hidden />
                        </>
                      )}
                      {avail.state === 'full' && <span className={`mono ${styles.calDaySubFull}`}>complet</span>}
                      {avail.state === 'closed' && <span className={`mono ${styles.calDaySubClosed}`}>fermé</span>}
                    </button>
                  )
                })}
              </div>
              <div className={styles.calLegend}>
                <span className={styles.bpLegendItem}>
                  <span className={styles.calDotStatic} />
                  <span className={`mono ${styles.bpLegendText}`}>Créneaux libres</span>
                </span>
                <span className={styles.bpLegendItem}>
                  <span className={styles.calSquareDashed} />
                  <span className={`mono ${styles.bpLegendText}`}>Complet</span>
                </span>
                <span className={styles.bpLegendItem}>
                  <span className={styles.calSquareToday} />
                  <span className={`mono ${styles.bpLegendText}`}>Aujourd'hui</span>
                </span>
              </div>
            </div>

            {selectedDay !== null && (
              <div className={styles.slotsCard}>
                <div className={styles.panelCardHead}>
                  <span className={`sat ${styles.panelCardTitle}`}>
                    Horaires —{' '}
                    <span style={{ color: 'var(--accent-500)' }}>{dayLabel(month, selectedDay)}</span>
                  </span>
                  <span className={`mono ${styles.panelCardHint}`}>Illkirch · 67400</span>
                </div>
                <div className={styles.slotsGrid}>
                  {(daySlots.data ?? []).map((slot) => {
                    const label = slotTimeFmt.format(new Date(slot.slotStart))
                    const isHeld = heldStart === slot.slotStart
                    const open = slot.state === 'available' || slot.state === 'held_by_me'
                    return (
                      <button
                        key={slot.slotStart + slot.bay}
                        type="button"
                        className={[
                          'mono',
                          styles.slot,
                          !open ? styles.slotOff : '',
                          isHeld ? styles.slotSelected : '',
                        ].join(' ')}
                        disabled={!open || holdMutation.isPending}
                        onClick={() => holdMutation.mutate(slot)}
                      >
                        {label}
                      </button>
                    )
                  })}
                  {daySlots.isPending && (
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      Chargement des créneaux…
                    </span>
                  )}
                  {!daySlots.isPending && (daySlots.data ?? []).length === 0 && (
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      Aucun créneau ce jour.
                    </span>
                  )}
                </div>

                {state.hold && remaining !== null && (
                  <div
                    className="mono"
                    style={{ marginTop: 14, fontSize: 13, color: 'var(--octane-300)' }}
                    aria-live="polite"
                  >
                    Créneau réservé — {Math.floor(remaining / 60)}:{pad(remaining % 60)} pour confirmer
                  </div>
                )}

                {/* ---------- who is the RDV for ---------- */}
                <div className={styles.forWho} role="radiogroup" aria-label="Ce rendez-vous est pour">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!state.forOther}
                    className={`${styles.forWhoBtn} ${!state.forOther ? styles.forWhoActive : ''}`}
                    onClick={() => setForOther(false)}
                  >
                    Pour moi{profileName ? ` · ${profileName.split(' ')[0]}` : ''}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={state.forOther}
                    className={`${styles.forWhoBtn} ${state.forOther ? styles.forWhoActive : ''}`}
                    onClick={() => setForOther(true)}
                  >
                    Pour une autre personne
                  </button>
                </div>

                {/* ---------- contact (required to confirm — docs/06 §1.4) ---------- */}
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  {state.forOther && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      Coordonnées de la personne qui viendra à l'atelier — la réservation reste rattachée à votre
                      compte.
                    </span>
                  )}
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                    <input
                      className="field"
                      placeholder="Nom complet *"
                      autoComplete="name"
                      value={state.contactName}
                      onChange={(e) => dispatch({ type: 'setContact', field: 'contactName', value: e.target.value })}
                    />
                    <PhoneInput
                      value={state.contactPhone}
                      onChange={(v) => dispatch({ type: 'setContact', field: 'contactPhone', value: v })}
                      aria-label="Téléphone *"
                    />
                  </div>
                  <input
                    className="field"
                    placeholder="E-mail * (confirmation du rendez-vous)"
                    type="email"
                    autoComplete="email"
                    value={state.contactEmail}
                    onChange={(e) => dispatch({ type: 'setContact', field: 'contactEmail', value: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="Une précision pour l'atelier ? (optionnel)"
                    value={state.clientNotes}
                    onChange={(e) => dispatch({ type: 'setContact', field: 'clientNotes', value: e.target.value })}
                  />

                  {showBookerFields && (
                    <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                      <span className="sat" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                        Vos coordonnées (personne qui réserve) *
                      </span>
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                        <input
                          className="field"
                          placeholder="Votre nom complet *"
                          autoComplete="name"
                          value={state.bookerName}
                          onChange={(e) => dispatch({ type: 'setContact', field: 'bookerName', value: e.target.value })}
                        />
                        <PhoneInput
                          value={state.bookerPhone}
                          onChange={(v) => dispatch({ type: 'setContact', field: 'bookerPhone', value: v })}
                          aria-label="Votre téléphone *"
                        />
                      </div>
                      <input
                        className="field"
                        placeholder="Votre e-mail * (copie de la confirmation)"
                        type="email"
                        autoComplete="email"
                        value={state.bookerEmail}
                        onChange={(e) => dispatch({ type: 'setContact', field: 'bookerEmail', value: e.target.value })}
                      />
                    </div>
                  )}
                  {state.forOther && profileComplete && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      Réservé par {profileName} · {profileEmail} — vous recevrez une copie de la confirmation.
                    </span>
                  )}
                </div>

                {error && (
                  <div style={{ marginTop: 12, color: 'var(--status-warning)', fontSize: 13 }} role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="cta"
                  style={{ width: '100%', marginTop: 18, fontSize: 16, padding: 16, borderRadius: 13 }}
                  disabled={!state.hold || !contactOk || !bookerOk || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                >
                  {confirmMutation.isPending ? 'Confirmation…' : 'Confirmer le rendez-vous'}{' '}
                  <span style={{ fontSize: 18 }}>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
