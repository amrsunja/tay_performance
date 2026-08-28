/* Admin — Transactions: what the workshop earned, what is coming, what was lost.
   Money is derived from booking statuses (completed = encaissé); an admin can remove a
   booking's amount from the revenue (unpaid, refund…) — traced in the booking history. */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusPill from '../../components/ui/StatusPill'
import Modal from '../../components/ui/Modal'
import BookingDrawer from './BookingDrawer'
import { listFinanceBookings, setRevenueExcluded, type FinanceBookingRow } from '../../api/admin'
import { getCatalog } from '../../api/catalog'
import { errorMessage } from '../../lib/supabase'
import type { TintZoneCode } from '../../types/domain'
import { formatEuro } from '../booking/useBookingDraft'
import { BUCKET_META, bucketOf, byBodyStyle, byDay, byMonth, byZone, clientInsights, lastMonths, totals, type Bucket } from './finance'
import { CumulativeLine, Legend, ShareBars, StackedBars } from './Charts'
import styles from './admin.module.css'

const MONTH_FMT = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

type Range = '30d' | 'month' | '12m' | 'year' | 'all'
const RANGE_LABEL: Record<Range, string> = { '30d': '30 jours', month: 'Ce mois', '12m': '12 mois', year: 'Cette année', all: 'Tout' }

function rangeBounds(r: Range, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getFullYear() + 2, 0, 1) // include future bookings (à venir / en attente)
  switch (r) {
    case '30d':
      return { from: new Date(now.getTime() - 30 * 86400_000), to }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
    case '12m':
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to }
    default:
      return { from: new Date(2020, 0, 1), to }
  }
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return MONTH_FMT.format(new Date(y, m - 1, 1)).replace('.', '')
}

export default function TransactionsPage() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Range>('12m')
  const [filter, setFilter] = useState<Bucket | 'all' | 'excluded'>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [excluding, setExcluding] = useState<FinanceBookingRow | null>(null)
  const [error, setError] = useState('')

  const { from, to } = useMemo(() => rangeBounds(range), [range])
  const rows = useQuery({
    queryKey: ['admin', 'finance', from.toISOString(), to.toISOString()],
    queryFn: () => listFinanceBookings(from.toISOString(), to.toISOString()),
    staleTime: 30_000,
  })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 })
  const zoneLabels = useMemo(
    () => Object.fromEntries((catalog.data?.zones ?? []).map((z) => [z.code, z.labelFr])) as Partial<Record<TintZoneCode, string>>,
    [catalog.data],
  )

  const data = rows.data ?? []
  const t = useMemo(() => totals(data), [data])
  const months = useMemo(() => lastMonths(range === '30d' || range === 'month' ? 6 : 12), [range])
  const monthly = useMemo(() => byMonth(data, months), [data, months])
  const thisMonth = months[months.length - 1]
  const daily = useMemo(() => byDay(data, thisMonth), [data, thisMonth])
  const zones = useMemo(() => byZone(data, zoneLabels), [data, zoneLabels])
  const bodies = useMemo(() => byBodyStyle(data), [data])
  const insights = useMemo(() => clientInsights(data), [data])

  // previous-period comparison for the headline (same length window, ending at `from`)
  const prevMonthEarned = monthly.length >= 2 ? monthly[monthly.length - 2].earned : 0
  const thisMonthEarned = monthly.length ? monthly[monthly.length - 1].earned : 0
  const delta = prevMonthEarned > 0 ? (thisMonthEarned - prevMonthEarned) / prevMonthEarned : null

  const listed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((r) => {
      if (filter === 'excluded' ? !r.revenueExcluded : filter !== 'all' && (r.revenueExcluded || bucketOf(r.status) !== filter)) return false
      if (!q) return true
      return r.reference.toLowerCase().includes(q) || r.contactName.toLowerCase().includes(q) || r.vehicleLabel.toLowerCase().includes(q)
    })
  }, [data, filter, search])

  const excludeMutation = useMutation({
    mutationFn: ({ id, excluded, reason }: { id: string; excluded: boolean; reason?: string }) => setRevenueExcluded(id, excluded, reason),
    onSuccess: () => {
      setExcluding(null)
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const tiles: { bucket: Bucket; value: number; count: number }[] = (['earned', 'upcoming', 'pipeline', 'lost'] as Bucket[]).map((b) => ({
    bucket: b,
    value: t[b],
    count: t.count[b],
  }))

  return (
    <div>
      <div className={styles.pageHead} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className={`sat ${styles.pageTitle}`}>Transactions</h1>
          <p className={styles.pageSub}>
            Encaissé = poses terminées · À venir = confirmées / en pose · En attente = demandes non confirmées. Un montant peut être
            retiré du chiffre d'affaires (impayé, remboursement) sans toucher à la réservation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      {/* ---------- KPI tiles ---------- */}
      <div className={styles.statRow}>
        {tiles.map(({ bucket, value, count }) => (
          <button
            key={bucket}
            type="button"
            className={styles.statCard}
            style={{ textAlign: 'left', cursor: 'pointer', borderColor: filter === bucket ? BUCKET_META[bucket].color : undefined, position: 'relative' }}
            onClick={() => setFilter((f) => (f === bucket ? 'all' : bucket))}
            aria-pressed={filter === bucket}
          >
            <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2, background: BUCKET_META[bucket].color }} />
            <div className={`mono ${styles.statCardValue}`}>{rows.isPending ? '…' : formatEuro(value)}</div>
            <div className={styles.statCardLabel}>
              {BUCKET_META[bucket].label} · {count} réservation{count > 1 ? 's' : ''}
              <span style={{ color: 'var(--text-faint)' }}> — {BUCKET_META[bucket].hint}</span>
            </div>
            {bucket === 'earned' && delta !== null && (
              <div className="mono" style={{ fontSize: 11, marginTop: 6, color: delta >= 0 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% vs mois précédent ({formatEuro(prevMonthEarned)})
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ---------- charts ---------- */}
      <div className={styles.twoCol} style={{ alignItems: 'start' }}>
        <div className={styles.tableCard} style={{ padding: 18 }}>
          <div className={styles.blockHead} style={{ marginBottom: 10 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Chiffre d'affaires par mois</h2>
            <Legend buckets={['earned', 'upcoming', 'pipeline']} />
          </div>
          <StackedBars data={monthly} buckets={['earned', 'upcoming', 'pipeline']} labelOf={monthLabel} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            Le mois en cours inclut les rendez-vous déjà planifiés · manque à gagner (annulations / absences) :{' '}
            <span style={{ color: BUCKET_META.lost.color }}>{formatEuro(t.lost)}</span>
          </div>
        </div>

        <div className={styles.tableCard} style={{ padding: 18 }}>
          <div className={styles.blockHead} style={{ marginBottom: 10 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Encaissé — {MONTH_LONG.format(new Date(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 1, 1))}</h2>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>cumul journalier</span>
          </div>
          <CumulativeLine data={daily} bucket="earned" />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            Encore planifié ce mois :{' '}
            <span style={{ color: 'var(--text-soft)' }}>{formatEuro(daily.reduce((s, d) => s + d.upcoming, 0))}</span> · en attente{' '}
            <span style={{ color: 'var(--text-soft)' }}>{formatEuro(daily.reduce((s, d) => s + d.pipeline, 0))}</span>
          </div>
        </div>
      </div>

      <div className={styles.twoCol} style={{ alignItems: 'start', marginTop: 18 }}>
        <div className={styles.tableCard} style={{ padding: 18 }}>
          <div className={styles.blockHead} style={{ marginBottom: 12 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Par zone de pose</h2>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>encaissé · prix réparti entre les zones</span>
          </div>
          <ShareBars items={zones} />
          <div className={styles.blockHead} style={{ margin: '22px 0 12px' }}>
            <h2 className={`sat ${styles.blockTitle}`}>Par carrosserie</h2>
          </div>
          <ShareBars items={bodies} />
        </div>

        <div className={styles.tableCard} style={{ padding: 18 }}>
          <div className={styles.blockHead} style={{ marginBottom: 12 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Clients</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <MiniStat label="Panier moyen" value={formatEuro(insights.averageTicket)} />
            <MiniStat label="Clients fidèles" value={`${Math.round(insights.returningShare * 100)} %`} hint={`${insights.returningClients} sur ${insights.returningClients + insights.newClients}`} />
            <MiniStat label="Manque à gagner" value={formatEuro(insights.lostAmount)} hint={`${insights.cancelledCount} annul. · ${insights.noShowCount} absent${insights.noShowCount > 1 ? 's' : ''}`} tone="warning" />
          </div>
          <div className={`mono ${styles.makeCount}`} style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Top clients (encaissé)
          </div>
          <ShareBars items={insights.top.map((c) => ({ label: c.name, amount: c.amount, count: c.count }))} color={BUCKET_META.upcoming.color} />
        </div>
      </div>

      {/* ---------- transactions list ---------- */}
      <div className={styles.blockHead} style={{ marginTop: 28 }}>
        <h2 className={`sat ${styles.blockTitle}`}>
          Détail{' '}
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>
            · {listed.length} ligne{listed.length > 1 ? 's' : ''}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Tout
          </button>
          {(['earned', 'upcoming', 'pipeline', 'lost'] as Bucket[]).map((b) => (
            <button key={b} type="button" className="chip" aria-pressed={filter === b} onClick={() => setFilter(b)}>
              {BUCKET_META[b].label}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={filter === 'excluded'} onClick={() => setFilter('excluded')}>
            Retirés · {formatEuro(t.excluded)}
          </button>
          <input className="field" placeholder="Référence, client, véhicule…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, padding: '8px 12px' }} aria-label="Rechercher" />
        </div>
      </div>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Réf.</th>
              <th>Client</th>
              <th>Véhicule</th>
              <th>Statut</th>
              <th className={styles.thNum}>Montant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listed.map((r) => {
              const b = bucketOf(r.status)
              return (
                <tr key={r.id} style={r.revenueExcluded ? { opacity: 0.55 } : undefined}>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{DATE_FMT.format(new Date(r.slotStart))}</td>
                  <td>
                    <button type="button" className="navlink mono" style={{ fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--octane-300)' }} onClick={() => setOpen(r.id)}>
                      {r.reference}
                    </button>
                  </td>
                  <td className={styles.cellStrong}>{r.contactName}</td>
                  <td style={{ color: 'var(--text-soft)' }}>
                    {r.vehicleLabel} <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>· {r.bodyLabel}</span>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={`mono ${styles.tdNum}`} style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ color: r.revenueExcluded ? 'var(--text-faint)' : BUCKET_META[b].color, textDecoration: r.revenueExcluded ? 'line-through' : undefined }}>
                      {formatEuro(r.priceTotal)}
                    </span>
                    {r.priceOverridden && <span title="prix modifié" style={{ color: 'var(--octane-300)', marginLeft: 4 }}>*</span>}
                    {r.revenueExcluded && (
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>retiré{r.revenueExcludedReason ? ` — ${r.revenueExcludedReason}` : ''}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.revenueExcluded ? (
                      <button type="button" className="ghost" style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8 }} disabled={excludeMutation.isPending} onClick={() => excludeMutation.mutate({ id: r.id, excluded: false })}>
                        Réintégrer
                      </button>
                    ) : (
                      <button type="button" className="ghost" style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, color: 'var(--text-dim)' }} onClick={() => setExcluding(r)}>
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!rows.isPending && listed.length === 0 && (
              <tr>
                <td colSpan={7} className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Aucune transaction sur cette période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {excluding && (
        <ExcludeModal
          row={excluding}
          pending={excludeMutation.isPending}
          onClose={() => setExcluding(null)}
          onConfirm={(reason) => excludeMutation.mutate({ id: excluding.id, excluded: true, reason })}
        />
      )}
      {open && <BookingDrawer bookingId={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warning' }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, marginTop: 4, color: tone === 'warning' ? 'var(--status-warning)' : 'var(--text-hi)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function ExcludeModal({ row, pending, onClose, onConfirm }: { row: FinanceBookingRow; pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title="Retirer du chiffre d'affaires" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-soft)' }}>
          <span className="mono" style={{ color: 'var(--octane-300)' }}>{row.reference}</span> · {row.contactName} ·{' '}
          <span className="mono">{formatEuro(row.priceTotal)}</span>
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
          La réservation et son statut ne changent pas ; le montant n'est simplement plus compté. Le client voit la mention dans son historique.
        </p>
        <input className="field" placeholder="Motif — ex : impayé, remboursement, geste commercial" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="cta" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }} disabled={pending} onClick={() => onConfirm(reason.trim())}>
            {pending ? 'Enregistrement…' : 'Retirer le montant'}
          </button>
          <button type="button" className="ghost" style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12 }} onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  )
}
