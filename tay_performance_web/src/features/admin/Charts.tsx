/* Tiny inline-SVG charts (no dependency) following the dataviz specs: thin marks,
   2px surface gaps, rounded data-ends, recessive grid, hover tooltip, direct labels only
   where useful, text in text tokens (never series colour). */
import { useState } from 'react'
import type { Series } from './finance'
import { BUCKET_META, type Bucket } from './finance'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euroFull = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

function niceMax(v: number): number {
  if (v <= 0) return 100
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return step * p
}

const tipStyle: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  background: 'var(--surface-3)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: '0 10px 30px rgba(0,0,0,.45)',
  zIndex: 3,
  whiteSpace: 'nowrap',
}

/* ---------- stacked monthly bars ---------- */
export function StackedBars({
  data,
  buckets,
  labelOf,
  height = 220,
}: {
  data: Series[]
  buckets: Bucket[]
  labelOf: (key: string) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const padL = 64
  const padR = 8
  const padT = 12
  const padB = 28
  const plotW = W - padL - padR
  const plotH = height - padT - padB
  const max = niceMax(Math.max(...data.map((d) => buckets.reduce((s, b) => s + d[b], 0)), 1))
  const slot = plotW / Math.max(data.length, 1)
  const barW = Math.min(34, slot * 0.6)
  const y = (v: number) => padT + plotH - (v / max) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Chiffre d'affaires par mois" style={{ display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-faint)" fontFamily="var(--font-mono)">
              {euro.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2
          let acc = 0
          const total = buckets.reduce((s, b) => s + d[b], 0)
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit target wider than the mark */}
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
              {buckets.map((b, bi) => {
                const v = d[b]
                if (v <= 0) return null
                const y1 = y(acc + v)
                const h = Math.max(0, y(acc) - y1 - (acc > 0 ? 2 : 0))
                acc += v
                const isTop = bi === buckets.length - 1 || buckets.slice(bi + 1).every((bb) => d[bb] <= 0)
                return (
                  <rect
                    key={b}
                    x={x}
                    y={y1}
                    width={barW}
                    height={h}
                    rx={isTop ? 4 : 0}
                    fill={BUCKET_META[b].color}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )
              })}
              {total > 0 && (i === data.length - 1 || hover === i) && (
                <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize={10} fill="var(--text-soft)" fontFamily="var(--font-mono)">
                  {euro.format(total)}
                </text>
              )}
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize={10} fill="var(--text-dim)" fontFamily="var(--font-mono)">
                {labelOf(d.key)}
              </text>
            </g>
          )
        })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
      </svg>
      {hover !== null && data[hover] && (
        <div style={{ ...tipStyle, left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, top: 0, transform: 'translate(-50%, -8px)' }}>
          <div className="mono" style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{labelOf(data[hover].key)}</div>
          {buckets.map((b) => (
            <div key={b} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: BUCKET_META[b].color, marginRight: 6 }} />
                {BUCKET_META[b].label}
              </span>
              <span className="mono">{euroFull.format(data[hover][b])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- daily line (cumulative) ---------- */
export function CumulativeLine({ data, bucket, height = 180 }: { data: Series[]; bucket: Bucket; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const padL = 64
  const padR = 8
  const padT = 12
  const padB = 24
  const plotW = W - padL - padR
  const plotH = height - padT - padB
  let acc = 0
  const cum = data.map((d) => (acc += d[bucket]))
  const max = niceMax(Math.max(...cum, 1))
  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * plotW
  const y = (v: number) => padT + plotH - (v / max) * plotH
  const path = cum.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`
  const color = BUCKET_META[bucket].color
  const today = new Date().getDate() - 1

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label="Cumul du mois"
        style={{ display: 'block' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((px - padL) / plotW) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, i)))
        }}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t * max)} y2={y(t * max)} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={padL - 8} y={y(t * max) + 4} textAnchor="end" fontSize={10} fill="var(--text-faint)" fontFamily="var(--font-mono)">
              {euro.format(t * max)}
            </text>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.12} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((_, i) =>
          i % 5 === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--text-dim)" fontFamily="var(--font-mono)">
              {i + 1}
            </text>
          ) : null,
        )}
        {today >= 0 && today < data.length && (
          <line x1={x(today)} x2={x(today)} y1={padT} y2={y(0)} stroke="var(--text-faint)" strokeDasharray="3 4" strokeWidth={1} />
        )}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(cum[hover])} r={5} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div style={{ ...tipStyle, left: `${(x(hover) / W) * 100}%`, top: 0, transform: `translate(${hover > data.length / 2 ? '-105%' : '8px'}, 0)` }}>
          <div className="mono" style={{ color: 'var(--text-dim)' }}>jour {hover + 1}</div>
          <div>
            cumul <span className="mono">{euroFull.format(cum[hover])}</span>
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            ce jour <span className="mono">{euroFull.format(data[hover][bucket])}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- horizontal share bars (single hue, magnitude) ---------- */
export function ShareBars({ items, color = BUCKET_META.earned.color }: { items: { label: string; amount: number; count: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.amount), 1)
  if (items.length === 0) return <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucune donnée.</span>
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.label}>
            {it.label}
          </span>
          <div style={{ height: 10, borderRadius: 4, background: 'var(--surface-inset)', overflow: 'hidden' }}>
            <div style={{ width: `${(it.amount / max) * 100}%`, height: '100%', borderRadius: 4, background: color }} title={euroFull.format(it.amount)} />
          </div>
          <span className="mono" style={{ color: 'var(--text)', minWidth: 90, textAlign: 'right' }}>
            {euro.format(it.amount)} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>· {it.count}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------- legend ---------- */
export function Legend({ buckets }: { buckets: Bucket[] }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {buckets.map((b) => (
        <span key={b} className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: BUCKET_META[b].color }} />
          {BUCKET_META[b].label}
        </span>
      ))}
    </div>
  )
}
