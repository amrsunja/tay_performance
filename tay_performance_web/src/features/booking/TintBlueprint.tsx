import baseFront from '../../assets/bmw_original_front.png'
import { TINT_ZONES, DEMO_VEHICLE } from '../../data/mock'
import type { TintZoneCode } from '../../types/domain'
import styles from './booking.module.css'

/**
 * Paint order (bottom → top). The windshield PNG must sit ABOVE the front
 * side windows layer — otherwise the side-window film overlaps the
 * windshield glass on the 3/4 view.
 */
const LAYER_ORDER: TintZoneCode[] = ['front_sides', 'rear_sides', 'pare_brise']

interface TintBlueprintProps {
  selected: string[]
  frontVlt: number
  rearVlt: number
}

/** VLT 85 (clair) → 0 opacity · VLT 5 (foncé) → ~1 opacity */
export function opacityForVlt(vlt: number): number {
  return Math.max(0, Math.min(1, (85 - vlt) / 80))
}

/**
 * Plan de pose — layered live preview.
 * The base photo is overlaid with one transparent PNG per tint zone
 * (pare-brise / vitres avant latérales / vitres arrière latérales),
 * pixel-registered on the same 1266×832 canvas. Each layer's opacity
 * is driven by its zone's selection + the group VLT slider.
 */
export default function TintBlueprint({ selected, frontVlt, rearVlt }: TintBlueprintProps) {
  const layeredZones = LAYER_ORDER
    .map((code) => TINT_ZONES.find((z) => z.code === code))
    .filter((z): z is (typeof TINT_ZONES)[number] => Boolean(z?.layerSrc))
  const frontOn = selected.some((code) => TINT_ZONES.find((z) => z.code === code)?.group === 'avant')
  const rearOn = selected.some((code) => TINT_ZONES.find((z) => z.code === code)?.group !== 'avant')

  return (
    <div className={styles.blueprint} data-reveal>
      <div className={styles.bpGrid} aria-hidden />
      <div className={styles.bpGridLarge} aria-hidden />
      <div className={styles.bpVignette} aria-hidden />

      <div className={styles.bpHead}>
        <span className={`mono ${styles.bpLabel}`} style={{ color: '#86aae0' }}>
          PLAN DE POSE · FILMS TEINTÉS
        </span>
        <span className={`mono ${styles.bpLabel}`}>
          {DEMO_VEHICLE.make} {DEMO_VEHICLE.generation} {DEMO_VEHICLE.model} · {DEMO_VEHICLE.years}
        </span>
      </div>

      <div className={styles.bpStage}>
        <div className={styles.bpCanvas}>
          <img src={baseFront} alt={`${DEMO_VEHICLE.make} ${DEMO_VEHICLE.model}`} className={styles.bpLayer} />
          {layeredZones.map((zone) => {
            const isSelected = selected.includes(zone.code)
            const vlt = zone.group === 'avant' ? frontVlt : rearVlt
            return (
              <img
                key={zone.code}
                src={zone.layerSrc}
                alt=""
                aria-hidden
                className={styles.bpLayer}
                style={{ opacity: isSelected ? opacityForVlt(vlt) : 0 }}
              />
            )
          })}

          {/* callout chips */}
          <div className={styles.bpTag} style={{ left: '26%', top: '26%', opacity: frontOn ? 1 : 0 }}>
            <span className={`mono ${styles.bpTagChip}`} style={{ background: 'var(--octane-500)' }}>
              <span className={styles.bpTagDot} />
              Avant · {frontVlt}%
            </span>
          </div>
          {/* anchored on the C-pillar so the chip never covers the rear glass */}
          <div className={styles.bpTag} style={{ left: '88%', top: '38%', opacity: rearOn ? 1 : 0 }}>
            <span className={`mono ${styles.bpTagChip}`} style={{ background: 'var(--brand-blue)' }}>
              <span className={styles.bpTagDot} />
              Arrière · {rearVlt}%
            </span>
          </div>
        </div>
      </div>

      <div className={styles.bpLegend}>
        <span className={styles.bpLegendItem}>
          <span className={styles.bpLegendDot} style={{ background: 'var(--octane-500)' }} />
          <span className={`mono ${styles.bpLegendText}`}>Teinte avant (live)</span>
        </span>
        <span className={styles.bpLegendItem}>
          <span className={styles.bpLegendDot} style={{ background: 'var(--brand-blue)' }} />
          <span className={`mono ${styles.bpLegendText}`}>Teinte arrière (live)</span>
        </span>
        <span className={`mono ${styles.bpLegendHint}`}>Aperçu réel — glissez les curseurs d'opacité</span>
      </div>
    </div>
  )
}
