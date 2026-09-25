import type { BookingStatus } from '../../types/domain'
import Icon, { type IconName } from './Icon'

/* `icon` is an <Icon> name, or null for the states that read better with just
   the coloured dot the pill already draws. The old ◔ ◑ ✓ ✕ glyphs rendered at
   wildly different sizes (and partly as emoji) across mobile browsers. */
const STATUS_META: Record<BookingStatus, { label: string; tone: string; icon: IconName | null }> = {
  requested: { label: 'Demandé', tone: 'pending', icon: null },
  confirmed: { label: 'Confirmé', tone: 'success', icon: 'check' },
  in_progress: { label: 'En pose', tone: 'info', icon: null },
  completed: { label: 'Terminé', tone: 'success', icon: 'check' },
  cancelled: { label: 'Annulé', tone: 'danger', icon: 'close' },
  no_show: { label: 'Client absent', tone: 'muted', icon: null },
}

export const STATUS_LABEL: Record<BookingStatus, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
) as Record<BookingStatus, string>

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** `price|<old>|<new>|<reason>` history notes (admin_set_booking_price) */
export function parsePriceNote(note?: string | null): { from: number | null; to: number; reason: string } | null {
  if (!note?.startsWith('price|')) return null
  const [, from, to, ...rest] = note.split('|')
  // from = '' when the booking was "sur devis" (no price yet)
  return { from: from === '' ? null : Number(from), to: Number(to), reason: rest.join('|') }
}

const slotFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
})

/** `reschedule|<old ISO>|<new ISO>|<reason>` history notes (admin_reschedule_booking, 0018) */
export function parseRescheduleNote(note?: string | null): { from: Date; to: Date; reason: string } | null {
  if (!note?.startsWith('reschedule|')) return null
  const [, from, to, ...rest] = note.split('|')
  const f = new Date(from)
  const t = new Date(to)
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return null
  return { from: f, to: t, reason: rest.join('|') }
}

export function formatSlot(d: Date): string {
  return slotFmt.format(d)
}

/** Human sentence for a status-history row (what happened, in French). */
export function describeTransition(from: BookingStatus | null, to: BookingStatus, note?: string | null): string {
  const n = note ?? ''
  const price = parsePriceNote(n)
  if (price) {
    return price.from == null
      ? `Prix fixé par l'atelier : ${euro.format(price.to)}${price.reason ? ` — ${price.reason}` : ''}`
      : `Prix modifié par l'atelier : ${euro.format(price.from)} → ${euro.format(price.to)}${price.reason ? ` — ${price.reason}` : ''}`
  }
  const moved = parseRescheduleNote(n)
  if (moved) {
    return `Rendez-vous déplacé par l'atelier : ${slotFmt.format(moved.from)} → ${slotFmt.format(moved.to)}${moved.reason ? ` — ${moved.reason}` : ''}`
  }
  if (n.startsWith('revenue|')) {
    const [, kind, ...rest] = n.split('|')
    const reason = rest.join('|')
    return kind === 'excluded'
      ? `Montant retiré du chiffre d'affaires par l'atelier${reason ? ` — ${reason}` : ''}`
      : "Montant réintégré au chiffre d'affaires"
  }
  if (from === to) return n || 'Mise à jour'
  if (!from) {
    if (n.includes('création manuelle')) return "Réservation créée par l'atelier" + (n.includes('prix modifié') ? ' (prix modifié)' : '')
    return 'Demande de rendez-vous envoyée par le client'
  }
  switch (to) {
    case 'confirmed':
      if (from === 'in_progress') return 'Pose annulée — retour à « confirmé »'
      if (from === 'cancelled' || from === 'no_show') return 'Réservation réactivée et confirmée'
      return "Rendez-vous confirmé par l'atelier"
    case 'in_progress':
      return from === 'completed' ? 'Pose rouverte (retour en cours)' : 'Pose démarrée'
    case 'completed':
      return 'Pose terminée'
    case 'cancelled':
      if (n.startsWith('reprogrammation')) return `Reprogrammé par le client${n.replace('reprogrammation', '')}`
      if (n) return `Annulé — ${n}`
      return from === 'in_progress' ? 'Pose interrompue / annulée' : 'Rendez-vous annulé'
    case 'no_show':
      return "Client absent au rendez-vous (no-show)"
    case 'requested':
      return from === 'cancelled' ? 'Réservation réactivée (en attente de confirmation)' : 'Remis en attente de confirmation'
    default:
      return `${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}`
  }
}

export default function StatusPill({ status }: { status: BookingStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`pill pill--${meta.tone}`}>
      {meta.icon ? <Icon name={meta.icon} size={12} strokeWidth={2.4} /> : <span className="pill__dot" aria-hidden />}
      {meta.label}
    </span>
  )
}
