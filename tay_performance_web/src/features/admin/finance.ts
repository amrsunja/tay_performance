/* Finance model — pure functions over booking rows (no I/O). Money buckets by status:
     earned    = completed            (pose faite → payé à l'atelier)
     upcoming  = confirmed + in_progress (engagé, argent qui arrive)
     pipeline  = requested            (demandes non confirmées)
     lost      = cancelled + no_show  (manque à gagner)
   A booking flagged `revenueExcluded` counts in none of them (shown separately). */
import type { FinanceBookingRow } from '../../api/admin'
import type { BookingStatus, TintZoneCode } from '../../types/domain'

export type Bucket = 'earned' | 'upcoming' | 'pipeline' | 'lost'

export const BUCKET_META: Record<Bucket, { label: string; hint: string; color: string }> = {
  // validated categorical palette (dark surface #13181e) — dataviz checks pass
  earned: { label: 'Encaissé', hint: 'poses terminées', color: '#2196c9' },
  upcoming: { label: 'À venir', hint: 'confirmées / en pose', color: '#cc7f22' },
  pipeline: { label: 'En attente', hint: 'demandes non confirmées', color: '#8070dc' },
  lost: { label: 'Perdu', hint: 'annulations / absences', color: '#c24f57' },
}

export function bucketOf(status: BookingStatus): Bucket {
  switch (status) {
    case 'completed':
      return 'earned'
    case 'confirmed':
    case 'in_progress':
      return 'upcoming'
    case 'requested':
      return 'pipeline'
    default:
      return 'lost'
  }
}

export interface Totals {
  earned: number
  upcoming: number
  pipeline: number
  lost: number
  excluded: number
  count: Record<Bucket, number>
}

export function totals(rows: FinanceBookingRow[]): Totals {
  const t: Totals = { earned: 0, upcoming: 0, pipeline: 0, lost: 0, excluded: 0, count: { earned: 0, upcoming: 0, pipeline: 0, lost: 0 } }
  for (const r of rows) {
    if (r.revenueExcluded) {
      t.excluded += r.priceTotal
      continue
    }
    const b = bucketOf(r.status)
    t[b] += r.priceTotal
    t.count[b] += 1
  }
  return t
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7) // yyyy-mm (slot_start is stored as timestamptz; Paris ≈ UTC for month bucketing)
}
export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** last N months (oldest first), keys yyyy-mm */
export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export interface Series {
  key: string
  earned: number
  upcoming: number
  pipeline: number
  lost: number
}

export function byMonth(rows: FinanceBookingRow[], months: string[]): Series[] {
  const map = new Map<string, Series>(months.map((m) => [m, { key: m, earned: 0, upcoming: 0, pipeline: 0, lost: 0 }]))
  for (const r of rows) {
    if (r.revenueExcluded) continue
    const s = map.get(monthKey(r.slotStart))
    if (s) s[bucketOf(r.status)] += r.priceTotal
  }
  return [...map.values()]
}

export function byDay(rows: FinanceBookingRow[], month: string): Series[] {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const out: Series[] = Array.from({ length: days }, (_, i) => ({
    key: `${month}-${String(i + 1).padStart(2, '0')}`,
    earned: 0,
    upcoming: 0,
    pipeline: 0,
    lost: 0,
  }))
  for (const r of rows) {
    if (r.revenueExcluded || !r.slotStart.startsWith(month)) continue
    const d = Number(r.slotStart.slice(8, 10)) - 1
    if (out[d]) out[d][bucketOf(r.status)] += r.priceTotal
  }
  return out
}

export interface Share {
  key: string
  label: string
  amount: number
  count: number
}

/** Earned revenue attributed to each tint zone (a booking's price split evenly across its zones). */
export function byZone(rows: FinanceBookingRow[], labels: Partial<Record<TintZoneCode, string>>): Share[] {
  const map = new Map<string, Share>()
  for (const r of rows) {
    if (r.revenueExcluded || bucketOf(r.status) !== 'earned' || r.zones.length === 0) continue
    const part = r.priceTotal / r.zones.length
    for (const z of r.zones) {
      const s = map.get(z) ?? { key: z, label: labels[z] ?? z, amount: 0, count: 0 }
      s.amount += part
      s.count += 1
      map.set(z, s)
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export function byBodyStyle(rows: FinanceBookingRow[]): Share[] {
  const map = new Map<string, Share>()
  for (const r of rows) {
    if (r.revenueExcluded || bucketOf(r.status) !== 'earned') continue
    const s = map.get(r.bodyStyle) ?? { key: r.bodyStyle, label: r.bodyLabel || r.bodyStyle, amount: 0, count: 0 }
    s.amount += r.priceTotal
    s.count += 1
    map.set(r.bodyStyle, s)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export interface ClientInsights {
  averageTicket: number
  newClients: number
  returningClients: number
  returningShare: number
  top: { name: string; amount: number; count: number; userId: string | null }[]
  noShowCount: number
  cancelledCount: number
  lostAmount: number
}

export function clientInsights(rows: FinanceBookingRow[]): ClientInsights {
  const earnedRows = rows.filter((r) => !r.revenueExcluded && bucketOf(r.status) === 'earned')
  const perClient = new Map<string, { name: string; amount: number; count: number; userId: string | null }>()
  for (const r of earnedRows) {
    const k = r.userId ?? `anon:${r.contactName.toLowerCase()}`
    const c = perClient.get(k) ?? { name: r.contactName, amount: 0, count: 0, userId: r.userId }
    c.amount += r.priceTotal
    c.count += 1
    perClient.set(k, c)
  }
  const clients = [...perClient.values()]
  const returning = clients.filter((c) => c.count > 1).length
  return {
    averageTicket: earnedRows.length ? earnedRows.reduce((s, r) => s + r.priceTotal, 0) / earnedRows.length : 0,
    newClients: clients.length - returning,
    returningClients: returning,
    returningShare: clients.length ? returning / clients.length : 0,
    top: clients.sort((a, b) => b.amount - a.amount).slice(0, 5),
    noShowCount: rows.filter((r) => r.status === 'no_show').length,
    cancelledCount: rows.filter((r) => r.status === 'cancelled').length,
    lostAmount: rows.filter((r) => !r.revenueExcluded && bucketOf(r.status) === 'lost').reduce((s, r) => s + r.priceTotal, 0),
  }
}
