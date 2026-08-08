import type { Dispatch } from 'react'
import { DEMO_VEHICLE } from '../../data/mock'
import { dayAvailability, dayLabel, daySlots, getMonth } from './calendar'
import { formatDuration, type DraftAction, type DraftState, type useBookingDraft } from './useBookingDraft'
import styles from './booking.module.css'

type Quote = ReturnType<typeof useBookingDraft>['quote']

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  quote: Quote
}

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const MAX_MONTH_OFFSET = 2

export default function CalendarStep({ state, dispatch, quote }: StepProps) {
  const month = getMonth(state.monthOffset)
  const today = new Date()
  const selectedDay =
    state.selectedDate && state.selectedDate.month === month.month && state.selectedDate.year === month.year
      ? state.selectedDate.day
      : null

  return (
    <section className={styles.step}>
      <div className={styles.stepInnerNarrow}>
        <div className={styles.calendarHead}>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Étape 2 · Choisir un créneau</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Disponibilités atelier<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
          </div>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 14, fontWeight: 500, padding: '13px 20px', borderRadius: 12 }}
            onClick={() => dispatch({ type: 'goStep', step: 'config' })}
          >
            ← Modifier la configuration
          </button>
        </div>

        <div className={styles.calendarGridWrap}>
          {/* ---------- recap ---------- */}
          <aside className={styles.recapCard}>
            <div className={styles.recapVehicle}>
              <span className={`mono ${styles.vehicleBadge}`}>{DEMO_VEHICLE.badge}</span>
              <span>
                <span className={`sat ${styles.vehicleName}`}>
                  {DEMO_VEHICLE.make} {DEMO_VEHICLE.generation} {DEMO_VEHICLE.model}
                </span>
                <span className={`mono ${styles.vehicleMeta}`}>
                  {DEMO_VEHICLE.bodyLabel} · {DEMO_VEHICLE.years}
                </span>
              </span>
            </div>
            <div className={styles.recapTitle}>Votre pose</div>
            <div className={styles.recapLines}>
              {quote.lines.map((line) => (
                <div key={line.zone.code} className={styles.summaryLine}>
                  <span>{line.zone.labelFr}</span>
                  <span className={`mono ${styles.summaryVlt}`}>
                    {line.vlt}% · {line.price}€
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
                {quote.total}€
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
                  const avail = dayAvailability(month, day, today)
                  const isToday =
                    today.getFullYear() === month.year && today.getMonth() === month.month && today.getDate() === day
                  const isSelected = selectedDay === day
                  const clickable = avail.state === 'available'
                  const cls = [
                    styles.calDay,
                    avail.state === 'past' || avail.state === 'closed' ? styles.calDayMuted : '',
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
                            {avail.freeSlots} libre{avail.freeSlots > 1 ? 's' : ''}
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
                  {daySlots(selectedDay, month.month).map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={[
                        'mono',
                        styles.slot,
                        !slot.open ? styles.slotOff : '',
                        state.selectedSlot === slot.time ? styles.slotSelected : '',
                      ].join(' ')}
                      disabled={!slot.open}
                      onClick={() => dispatch({ type: 'selectSlot', slot: slot.time })}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="cta"
                  style={{ width: '100%', marginTop: 18, fontSize: 16, padding: 16, borderRadius: 13 }}
                  disabled={!state.selectedSlot}
                  onClick={() => dispatch({ type: 'goStep', step: 'confirm' })}
                >
                  Confirmer le rendez-vous <span style={{ fontSize: 18 }}>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
