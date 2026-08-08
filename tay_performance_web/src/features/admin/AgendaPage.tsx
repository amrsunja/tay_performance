import styles from './admin.module.css'

interface AgendaBlock {
  day: number // 0 = Lundi
  start: number // hour (decimal)
  duration: number // hours
  label: string
  sub: string
  tone: 'amber' | 'blue' | 'green' | 'muted'
}

const BLOCKS: AgendaBlock[] = [
  { day: 0, start: 8.5, duration: 1.6, label: 'BMW F30 M3', sub: 'AR 20% · LUN 20%', tone: 'green' },
  { day: 0, start: 10.5, duration: 2.2, label: 'Tesla Model Y', sub: 'Intégral 5%', tone: 'blue' },
  { day: 0, start: 14, duration: 1.2, label: 'Mini Cooper S', sub: 'AR 20% · LUN 35%', tone: 'amber' },
  { day: 0, start: 15.5, duration: 2.25, label: 'Audi Q5', sub: 'AV 50% ⚠ · AR 5%', tone: 'amber' },
  { day: 1, start: 9, duration: 2, label: 'Golf 8 GTI', sub: 'AR 20% · LUN 20%', tone: 'green' },
  { day: 1, start: 14, duration: 3, label: 'Range Rover Evoque', sub: 'Intégral 20%', tone: 'blue' },
  { day: 2, start: 10, duration: 1.5, label: 'Peugeot 208', sub: 'AR 35%', tone: 'green' },
  { day: 3, start: 9.5, duration: 2.5, label: 'Mercedes GLC', sub: 'Intégral 5% + toit', tone: 'blue' },
  { day: 4, start: 11, duration: 1.5, label: 'Alpine A110', sub: 'AR 20%', tone: 'green' },
  { day: 4, start: 15, duration: 2, label: 'Tesla Model 3', sub: 'Intégral 20%', tone: 'blue' },
]

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const OPEN_HOUR = 8
const CLOSE_HOUR = 19
const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)
const HOUR_PX = 52

const TONE_STYLES: Record<AgendaBlock['tone'], { border: string; bg: string }> = {
  amber: { border: 'rgba(255,158,27,.55)', bg: 'rgba(255,158,27,.10)' },
  blue: { border: 'rgba(41,171,226,.55)', bg: 'rgba(41,171,226,.10)' },
  green: { border: 'rgba(52,211,153,.5)', bg: 'rgba(52,211,153,.09)' },
  muted: { border: 'var(--border-strong)', bg: 'var(--surface-2)' },
}

export default function AgendaPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Agenda atelier</h1>
        <p className={styles.pageSub}>Semaine en cours · baie 1 · granularité 30 min. Samedi fermeture 16h.</p>
      </div>

      <div className={styles.agendaCard}>
        <div className={styles.agendaGrid} style={{ gridTemplateColumns: `64px repeat(${DAYS.length}, 1fr)` }}>
          {/* header row */}
          <div />
          {DAYS.map((d, i) => (
            <div key={d} className={`mono ${styles.agendaDayHead}`} style={i === 0 ? { color: 'var(--octane-500)' } : undefined}>
              {d}
              {i === 0 && <span className={styles.agendaTodayDot} aria-hidden />}
            </div>
          ))}

          {/* hours column */}
          <div className={styles.agendaHours}>
            {HOURS.map((h) => (
              <div key={h} className={`mono ${styles.agendaHour}`} style={{ height: HOUR_PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* day columns */}
          {DAYS.map((d, dayIndex) => (
            <div key={d} className={styles.agendaDayCol} style={{ height: HOURS.length * HOUR_PX }}>
              {HOURS.map((h) => (
                <div key={h} className={styles.agendaCell} style={{ height: HOUR_PX }} />
              ))}
              {/* Saturday afternoon closed */}
              {dayIndex === 5 && (
                <div
                  className={styles.agendaClosed}
                  style={{ top: (16 - OPEN_HOUR) * HOUR_PX, height: (CLOSE_HOUR - 16) * HOUR_PX }}
                >
                  <span className="mono">FERMÉ</span>
                </div>
              )}
              {BLOCKS.filter((b) => b.day === dayIndex).map((block) => {
                const tone = TONE_STYLES[block.tone]
                return (
                  <div
                    key={`${block.day}-${block.start}`}
                    className={styles.agendaBlock}
                    style={{
                      top: (block.start - OPEN_HOUR) * HOUR_PX + 2,
                      height: block.duration * HOUR_PX - 4,
                      borderColor: tone.border,
                      background: tone.bg,
                    }}
                  >
                    <span className={`sat ${styles.agendaBlockTitle}`}>{block.label}</span>
                    <span className={`mono ${styles.agendaBlockSub}`}>{block.sub}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
