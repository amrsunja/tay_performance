import baseFront from '../../assets/bmw_original_front.png'
import frontWindshieldTint from '../../assets/bmw_front_window_tint.png'
import frontSidesTint from '../../assets/bmw_front_right_left_windows_tint.png'
import rearSidesTint from '../../assets/bmw_back_windows_tint.png'
import type { TintZoneCode } from '../../types/domain'
import styles from './booking.module.css'

/**
 * Paint order (bottom → top). The windshield PNG must sit ABOVE the front
 * side windows layer — otherwise the side-window film overlaps the
 * windshield glass on the 3/4 view.
 * Layer assets are bundled frontend art (pixel-registered 1266×832) — they are
 * intentionally NOT in the database (docs/01 §5).
 */
const LAYERS: { code: TintZoneCode; src: string; front: boolean }[] = [
  { code: 'front_sides', src: frontSidesTint, front: true },
  { code: 'rear_sides', src: rearSidesTint, front: false },
  { code: 'pare_brise', src: frontWindshieldTint, front: true },
]

const FRONT_ZONES: TintZoneCode[] = ['pare_brise', 'front_sides']

interface TintBlueprintProps {
  selected: string[]
  frontVlt: number
  rearVlt: number
  vehicleLabel: string
  vehicleYears?: string
}

/** VLT 85 (clair) → 0 opacity · VLT 5 (foncé) → ~1 opacity */
export function opacityForVlt(vlt: number): number {
  return Math.max(0, Math.min(1, (85 - vlt) / 80))
}

/**
 * Plan de pose — layered live preview over the base vehicle photo.
 * Each layer's opacity is driven by its zone's selection + the group VLT slider.
 */
export default function TintBlueprint({ selected, frontVlt, rearVlt, vehicleLabel, vehicleYears }: TintBlueprintProps) {
  const frontOn = selected.some((code) => FRONT_ZONES.includes(code as TintZoneCode))
  const rearOn = selected.some((code) => !FRONT_ZONES.includes(code as TintZoneCode))

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
          {vehicleLabel}
          {vehicleYears ? ` · ${vehicleYears}` : ''}
        </span>
      </div>

      <div className={styles.bpStage}>
        <div className={styles.bpCanvas}>
          <img src={baseFront} alt={vehicleLabel} className={styles.bpLayer} />
          {LAYERS.map((layer) => {
            const isSelected = selected.includes(layer.code)
            const vlt = layer.front ? frontVlt : rearVlt
            return (
              <img
                key={layer.code}
                src={layer.src}
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
