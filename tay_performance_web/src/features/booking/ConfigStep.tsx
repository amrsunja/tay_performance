import type { Dispatch } from 'react'
import { FRONT_LEGAL_MIN_VLT, TLV_STOPS, type TintZoneCode } from '../../types/domain'
import type { CatalogZone, ResolvedVehicle } from '../../types/api'
import TintBlueprint from './TintBlueprint'
import { formatDuration, formatEuro, formatPrice, type DraftAction, type DraftState, type LocalQuote } from './useBookingDraft'
import styles from './booking.module.css'

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  quote: LocalQuote
  zones: CatalogZone[]
  vehicle: ResolvedVehicle
  /** zone → pack price for this vehicle (already model-overridden), undefined when sur devis */
  zonePrices: Partial<Record<TintZoneCode, number>>
}

const PRESETS: { label: string; zones: TintZoneCode[] }[] = [
  { label: "Tout l'avant", zones: ['pare_brise', 'front_sides'] },
  { label: "Tout l'arrière", zones: ['rear_sides'] },
  { label: 'Pack intégral', zones: ['pare_brise', 'front_sides', 'rear_sides'] },
  { label: 'Effacer', zones: [] },
]

/** TLV = taux de lumière visible (ex-"VLT"). 5 % = le plus foncé. */
function TlvPicker({
  value,
  onChange,
  front,
  stops,
}: {
  value: number
  onChange: (v: number) => void
  front: boolean
  stops: readonly number[]
}) {
  return (
    <div className={styles.tlvStops} role="radiogroup" aria-label={front ? 'TLV avant' : 'TLV arrière'}>
      {stops.map((v) => {
        const on = v === value
        const illegal = front && v < FRONT_LEGAL_MIN_VLT
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            className={`${styles.tlvStop} ${on ? (front ? styles.tlvStopOnFront : styles.tlvStopOn) : ''} ${illegal ? styles.tlvStopIllegal : ''}`}
            style={{ ['--tlv-dark' as string]: (1 - v / 100).toFixed(2) }}
            title={illegal ? `Interdit à l'avant (<${FRONT_LEGAL_MIN_VLT}% TLV)` : undefined}
            onClick={() => onChange(v)}
          >
            {v}%
          </button>
        )
      })}
    </div>
  )
}

export default function ConfigStep({ state, dispatch, quote, zones, vehicle, zonePrices }: StepProps) {
  const canContinue = quote.lines.length > 0 && (!quote.nonCompliant || state.ack)
  const stops = TLV_STOPS

  return (
    <section className={styles.step}>
      <div className={styles.stepInner}>
        <div data-reveal className={styles.configHead}>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Réserver un créneau · Configurateur</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Composez votre teinte<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
            <p className={styles.lede}>
              Choisissez les vitres à teinter et le niveau de teinte (TLV), visualisez le rendu en direct.
              {quote.onRequest
                ? " Pour ce type de véhicule, l'atelier fixe le prix après analyse."
                : ' Le prix et la durée se calculent instantanément.'}
            </p>
          </div>
          <div className={styles.vehicleChip}>
            <span className={`mono ${styles.vehicleBadge}`}>{vehicle.badge}</span>
            <span>
              <span className={`sat ${styles.vehicleName}`}>
                {vehicle.make} {vehicle.generation} {vehicle.model}
              </span>
              <span className={`mono ${styles.vehicleMeta}`}>
                {vehicle.bodyLabel} · {vehicle.years}
              </span>
            </span>
            <button
              type="button"
              className={`navlink mono ${styles.vehicleChange}`}
              onClick={() => dispatch({ type: 'changeVehicle' })}
            >
              changer →
            </button>
          </div>
        </div>

        <div className={styles.configGrid}>
          <TintBlueprint
            selected={state.selected}
            frontVlt={state.frontVlt}
            rearVlt={state.rearVlt}
            vehicleLabel={`${vehicle.make} ${vehicle.generation} ${vehicle.model}`}
            vehicleYears={vehicle.years}
          />

          <div data-reveal className={styles.panel}>
            {/* ---------- TLV pickers ---------- */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHead}>
                <span className={`sat ${styles.panelCardTitle}`}>Niveau de teinte (TLV)</span>
                <span className={`mono ${styles.panelCardHint}`}>% de lumière transmise · même prix quel que soit le TLV</span>
              </div>

              <div className={styles.sliderBlock}>
                <div className={styles.sliderHead}>
                  <span className={styles.sliderName}>
                    <span className={styles.sliderDot} style={{ background: 'var(--octane-500)' }} />
                    Avant
                    <span className={styles.sliderNameSub}> · pare-brise + vitres avant</span>
                  </span>
                  <span className="mono">
                    <span className={styles.sliderValue}>{state.frontVlt}</span>
                    <span className={styles.sliderUnit}>%</span>
                  </span>
                </div>
                <TlvPicker
                  value={state.frontVlt}
                  onChange={(v) => dispatch({ type: 'setFrontVlt', value: v })}
                  front
                  stops={stops}
                />
                <div className={styles.sliderFoot}>
                  <span className={`mono ${styles.sliderScale}`}>
                    <span>5% = très foncé</span>
                    <span>70% = clair</span>
                  </span>
                  {quote.frontIllegal ? (
                    <span className={`mono ${styles.legalBadge} ${styles.legalBadgeBad}`}>
                      ✕ Illégal (&lt;{FRONT_LEGAL_MIN_VLT}%)
                    </span>
                  ) : (
                    <span className={`mono ${styles.legalBadge} ${styles.legalBadgeOk}`}>
                      ✓ Conforme (≥{FRONT_LEGAL_MIN_VLT}%)
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.panelDivider} />

              <div>
                <div className={styles.sliderHead}>
                  <span className={styles.sliderName}>
                    <span className={styles.sliderDot} style={{ background: 'var(--brand-blue)' }} />
                    Arrière
                    <span className={styles.sliderNameSub}> · latérales arrière + lunette</span>
                  </span>
                  <span className="mono">
                    <span className={styles.sliderValue}>{state.rearVlt}</span>
                    <span className={styles.sliderUnit}>%</span>
                  </span>
                </div>
                <TlvPicker
                  value={state.rearVlt}
                  onChange={(v) => dispatch({ type: 'setRearVlt', value: v })}
                  front={false}
                  stops={stops}
                />
                <div className={styles.sliderFoot}>
                  <span className={`mono ${styles.sliderScale}`}>
                    <span>5% = très foncé</span>
                    <span>70% = clair</span>
                  </span>
                  <span className={`mono ${styles.legalBadge} ${styles.legalBadgeFree}`}>Teinte libre</span>
                </div>
              </div>
            </div>

            {/* ---------- zones ---------- */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHead}>
                <span className={`sat ${styles.panelCardTitle}`}>Vitres à teinter</span>
                <span className={`mono ${styles.panelCardHint}`}>
                  {quote.lines.length} sélectionnée{quote.lines.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className={styles.presets}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={styles.preset}
                    onClick={() => dispatch({ type: 'preset', zones: preset.zones })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className={styles.zoneList}>
                {zones.map((zone) => {
                  const on = state.selected.includes(zone.code)
                  const price = zonePrices[zone.code]
                  return (
                    <button
                      key={zone.code}
                      type="button"
                      className={`${styles.zoneRow} ${on ? styles.zoneRowOn : ''}`}
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'toggleZone', zone: zone.code })}
                    >
                      <span className={`${styles.zoneBox} ${on ? styles.zoneBoxOn : ''}`} aria-hidden>
                        ✓
                      </span>
                      <span className={styles.zoneBody}>
                        <span className={styles.zoneName}>
                          {zone.labelFr}{' '}
                          {zone.detailFr && <span className={styles.zoneDetail}>{zone.detailFr}</span>}
                        </span>
                        <span
                          className={`chip ${zone.group === 'avant' ? 'chip--front' : zone.group === 'arriere' ? 'chip--rear' : ''}`}
                        >
                          {zone.group === 'avant' ? 'AVANT' : zone.group === 'arriere' ? 'ARRIÈRE' : 'OPTION'}
                        </span>
                      </span>
                      <span className={`mono ${styles.zonePrice}`}>
                        {quote.onRequest ? 'sur devis' : price != null ? formatEuro(price) : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ---------- legal warning + explicit acknowledgement ---------- */}
            {quote.nonCompliant && (
              <div className={styles.warnBox} role="alert">
                <span style={{ fontSize: 20 }} aria-hidden>
                  ⚠
                </span>
                <span className={styles.warnText}>
                  <b>Avant non conforme.</b> La loi française impose ≥{FRONT_LEGAL_MIN_VLT}% TLV à l'avant. En dessous,
                  le véhicule est verbalisable (135€, −3 points). On peut poser, mais hors-conformité.
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontWeight: 500 }}
                  >
                    <input
                      type="checkbox"
                      checked={state.ack}
                      onChange={(e) => dispatch({ type: 'setAck', value: e.target.checked })}
                    />
                    J'accepte la pose hors conformité (usage circuit/privé)
                  </label>
                </span>
              </div>
            )}

            {/* ---------- quote summary (pricing v2: Σ pack prices per body style) ---------- */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryGlow} aria-hidden />
              <div className={`sat ${styles.summaryTitle}`}>Devis</div>
              <div className={styles.summaryLines}>
                {quote.lines.length === 0 && (
                  <div className={styles.summaryEmpty}>
                    Aucune vitre sélectionnée — choisissez un pack ou cliquez une zone.
                  </div>
                )}
                {quote.lines.map((line) => (
                  <div key={line.zone.code} className={styles.summaryLine}>
                    <span>
                      {line.zone.labelFr}{' '}
                      <span className={`mono ${styles.summaryVlt}`}>· TLV {line.vlt}%</span>
                    </span>
                    <span className="mono">{quote.onRequest ? '—' : formatEuro(line.price)}</span>
                  </div>
                ))}
                {quote.lines.length > 0 && quote.onRequest && (
                  <div className={styles.onRequestBox} style={{ marginTop: 8 }}>
                    <b>{vehicle.bodyLabel} : prix sur devis.</b> Réservez votre créneau normalement — l'atelier analyse
                    votre véhicule, vous rappelle et fixe le prix. Il apparaîtra ensuite dans « Mes réservations ».
                  </div>
                )}
                {quote.lines.length > 0 && !quote.onRequest && quote.modelOverride && (
                  <div className={styles.summaryLine} style={{ color: 'var(--octane-300)' }}>
                    <span>Tarif spécifique {vehicle.make} {vehicle.model}</span>
                    <span className="mono">appliqué</span>
                  </div>
                )}
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryMeta}>
                <span>Durée estimée en atelier</span>
                <span className="mono">{formatDuration(quote.minutes)}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span className={`sat ${styles.summaryTotalLabel}`}>{quote.onRequest ? 'Prix' : 'Total'}</span>
                <span className={`mono ${styles.summaryTotal}`} style={quote.onRequest ? { fontSize: 22 } : undefined}>
                  {quote.lines.length === 0 ? formatEuro(0) : formatPrice(quote.total)}
                </span>
              </div>
              <button
                type="button"
                className="cta"
                style={{ width: '100%', marginTop: 16, fontSize: 16, padding: 16, borderRadius: 13 }}
                disabled={!canContinue}
                onClick={() => dispatch({ type: 'goStep', step: 'calendar' })}
              >
                Réserver mon créneau <span style={{ fontSize: 18 }}>→</span>
              </button>
              <div className={styles.summaryFoot}>
                {quote.onRequest ? 'Prix communiqué par l’atelier · sans engagement' : 'Prix TTC · paiement à l’atelier'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
