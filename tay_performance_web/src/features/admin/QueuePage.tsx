import StatusPill from '../../components/ui/StatusPill'
import { ADMIN_QUEUE, TINT_ZONES } from '../../data/mock'
import { formatDuration } from '../booking/useBookingDraft'
import styles from './admin.module.css'

function zoneShort(code: string) {
  const map: Record<string, string> = {
    pare_brise: 'PB',
    front_sides: 'AV',
    rear_sides: 'AR',
    rear_window: 'LUN',
    panoramic_roof: 'TOIT',
  }
  return map[code] ?? code
}

const MAX_DURATION = 150

export default function QueuePage() {
  const totalMinutes = ADMIN_QUEUE.reduce((sum, q) => sum + q.durationMin, 0)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>File du jour</h1>
        <p className={styles.pageSub}>Ce qui rentre à l'atelier aujourd'hui — variantes, zones, durées.</p>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>{ADMIN_QUEUE.length}</div>
          <div className={styles.statCardLabel}>véhicules planifiés</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>{formatDuration(totalMinutes)}</div>
          <div className={styles.statCardLabel}>de pose cumulée</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`}>
            {ADMIN_QUEUE.filter((q) => q.status === 'in_progress').length}
          </div>
          <div className={styles.statCardLabel}>en pose maintenant</div>
        </div>
        <div className={styles.statCard}>
          <div className={`mono ${styles.statCardValue}`} style={{ color: 'var(--status-warning)' }}>
            {ADMIN_QUEUE.flatMap((q) => q.specs).filter((s) => !s.isLegal).length}
          </div>
          <div className={styles.statCardLabel}>spec non conforme à valider</div>
        </div>
      </div>

      <div className={styles.queueList}>
        {ADMIN_QUEUE.map((entry) => {
          const [h, m] = entry.time.split(':').map(Number)
          const entryStart = h * 60 + m
          const showNowLine = nowMinutes < entryStart && !ADMIN_QUEUE.some((other) => {
            const [oh, om] = other.time.split(':').map(Number)
            const os = oh * 60 + om
            return os > nowMinutes && os < entryStart
          })
          return (
            <div key={entry.id}>
              {showNowLine && (
                <div className={styles.nowLine} aria-label="Maintenant">
                  <span className={`mono ${styles.nowLabel}`}>MAINTENANT</span>
                  <span className={styles.nowBar} />
                </div>
              )}
              <article className={styles.queueRow}>
                <div className={`mono ${styles.queueTime}`}>
                  <span className={styles.queueTimeStart}>{entry.time}</span>
                  <span className={styles.queueTimeEnd}>→ {entry.endTime}</span>
                </div>
                <div className={styles.queueVehicle}>
                  <span className={`mono ${styles.queueBadge}`}>{entry.vehicle.badge}</span>
                  <span>
                    <span className={`sat ${styles.queueVehicleName}`}>
                      {entry.vehicle.make} {entry.vehicle.generation} {entry.vehicle.model}
                    </span>
                    <span className={styles.queueOwner}>
                      {entry.owner} · <span className="mono">{entry.phone}</span>
                    </span>
                  </span>
                </div>
                <div className={styles.queueSpecs}>
                  {entry.specs.map((spec) => (
                    <span
                      key={spec.zone}
                      className={`chip ${!spec.isLegal ? '' : TINT_ZONES.find((z) => z.code === spec.zone)?.isFront ? 'chip--front' : 'chip--rear'}`}
                      style={!spec.isLegal ? { borderColor: 'rgba(248,113,113,.5)', color: 'var(--status-warning)' } : undefined}
                      title={!spec.isLegal ? 'Non conforme — ack client requis' : undefined}
                    >
                      {zoneShort(spec.zone)} {spec.vltPercent}%{!spec.isLegal && ' ⚠'}
                    </span>
                  ))}
                </div>
                <div className={styles.queueDuration}>
                  <span className={`mono ${styles.queueDurationText}`}>{formatDuration(entry.durationMin)}</span>
                  <span className={styles.durationTrack}>
                    <span
                      className={styles.durationFill}
                      style={{ width: `${Math.min(100, (entry.durationMin / MAX_DURATION) * 100)}%` }}
                    />
                  </span>
                </div>
                <div className={styles.queueStatus}>
                  <StatusPill status={entry.status} />
                </div>
                <div className={styles.queueActions}>
                  <button type="button" className={styles.iconBtn} title="Avancer le statut">
                    ▸
                  </button>
                  <button type="button" className={styles.iconBtn} title="Ajouter des photos">
                    ✚
                  </button>
                  <button type="button" className={styles.iconBtn} title="Ouvrir la fiche">
                    ↗
                  </button>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
}
