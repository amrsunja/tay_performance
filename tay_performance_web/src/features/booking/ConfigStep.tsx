import type { Dispatch } from 'react'
import { FRONT_LEGAL_MIN_VLT, type TintZoneCode } from '../../types/domain'
import type { CatalogZone, ResolvedVehicle } from '../../types/api'
import TintBlueprint from './TintBlueprint'
import { formatDuration, formatEuro, type DraftAction, type DraftState, type LocalQuote } from './useBookingDraft'
import styles from './booking.module.css'

interface StepProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  quote: LocalQuote
  zones: CatalogZone[]
  vehicle: ResolvedVehicle
}

const PRESETS: { label: string; zones: TintZoneCode[] }[] = [
  { label: "Tout l'avant", zones: ['pare_brise', 'front_sides'] },
  { label: "Tout l'arrière", zones: ['rear_sides', 'rear_window'] },
  { label: 'Pack intégral', zones: ['pare_brise', 'front_sides', 'rear_sides', 'rear_window', 'panoramic_roof'] },
  { label: 'Effacer', zones: [] },
]

export default function ConfigStep({ state, dispatch, quote, zones, vehicle }: StepProps) {
  const canContinue = quote.lines.length > 0 && (!quote.nonCompliant || state.ack)

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
              Cliquez les vitres à teinter, ajustez l'opacité et visualisez le rendu en direct. Le prix et la durée se
              calculent instantanément.
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
            {/* ---------- VLT sliders ---------- */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHead}>
                <span className={`sat ${styles.panelCardTitle}`}>Opacité du film (VLT)</span>
                <span className={`mono ${styles.panelCardHint}`}>% de lumière transmise</span>
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
                <input
                  className="rng rng--octane"
                  type="range"
                  min={5}
                  max={85}
                  step={5}
                  value={state.frontVlt}
                  aria-label="VLT avant"
                  onChange={(e) => dispatch({ type: 'setFrontVlt', value: Number(e.target.value) })}
                />
                <div className={styles.sliderFoot}>
                  <span className={`mono ${styles.sliderScale}`}>
                    <span>5%</span>
                    <span>foncé</span>
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
                    <span className={styles.sliderNameSub}> · vitres arrière + lunette + toit</span>
                  </span>
                  <span className="mono">
                    <span className={styles.sliderValue}>{state.rearVlt}</span>
                    <span className={styles.sliderUnit}>%</span>
                  </span>
                </div>
                <input
                  className="rng"
                  type="range"
                  min={5}
                  max={85}
                  step={5}
                  value={state.rearVlt}
                  aria-label="VLT arrière"
                  onChange={(e) => dispatch({ type: 'setRearVlt', value: Number(e.target.value) })}
                />
                <div className={styles.sliderFoot}>
                  <span className={`mono ${styles.sliderScale}`}>
                    <span>5%</span>
                    <span>foncé</span>
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
                  const vlt = zone.group === 'avant' ? state.frontVlt : state.rearVlt
                  const price = zone.deltas[vlt] ?? zone.price
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
                      <span className={`mono ${styles.zonePrice}`}>{formatEuro(price)}</span>
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
                  <b>Avant non conforme.</b> La loi française impose ≥{FRONT_LEGAL_MIN_VLT}% VLT à l'avant. En dessous,
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

            {/* ---------- quote summary (full formula — docs/04 §3) ---------- */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryGlow} aria-hidden />
              <div className={`sat ${styles.summaryTitle}`}>Devis</div>
              <div className={styles.summaryLines}>
                {quote.lines.length === 0 && (
                  <div className={styles.summaryEmpty}>
                    Aucune vitre sélectionnée — choisissez un pack ou cliquez une zone.
                  </div>
                )}
                {quote.lines.length > 0 && (
                  <div className={styles.summaryLine}>
                    <span>
                      Base {vehicle.bodyLabel.toLowerCase()}
                    </span>
                    <span className="mono">{formatEuro(quote.base)}</span>
                  </div>
                )}
                {quote.lines.map((line) => (
                  <div key={line.zone.code} className={styles.summaryLine}>
                    <span>
                      {line.zone.labelFr}{' '}
                      <span className={`mono ${styles.summaryVlt}`}>· {line.vlt}%</span>
                    </span>
                    <span className="mono">{formatEuro(line.price)}</span>
                  </div>
                ))}
                {quote.lines.length > 0 && (
                  <div className={styles.summaryLine}>
                    <span>
                      Main d'œuvre <span className={`mono ${styles.summaryVlt}`}>· {quote.minutes} min</span>
                    </span>
                    <span className="mono">{formatEuro(quote.labor)}</span>
                  </div>
                )}
                {quote.limoSupplement > 0 && (
                  <div className={styles.summaryLine} style={{ color: 'var(--octane-300)' }}>
                    <span>Film limousine (haute précision)</span>
                    <span className="mono">+{formatEuro(quote.limoSupplement)}</span>
                  </div>
                )}
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryMeta}>
                <span>Durée estimée en atelier</span>
                <span className="mono">{formatDuration(quote.minutes)}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span className={`sat ${styles.summaryTotalLabel}`}>Total estimé</span>
                <span className={`mono ${styles.summaryTotal}`}>{formatEuro(quote.total)}</span>
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
              <div className={styles.summaryFoot}>Devis indicatif · sans engagement · paiement à l'atelier</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
