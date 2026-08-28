import type { BookingStatus } from '../../types/domain'

const STATUS_META: Record<BookingStatus, { label: string; tone: string; icon: string }> = {
  requested: { label: 'Demandé', tone: 'pending', icon: '◔' },
  confirmed: { label: 'Confirmé', tone: 'success', icon: '✓' },
  in_progress: { label: 'En pose', tone: 'info', icon: '◑' },
  completed: { label: 'Terminé', tone: 'success', icon: '✓' },
  cancelled: { label: 'Annulé', tone: 'danger', icon: '✕' },
  no_show: { label: 'Client absent', tone: 'muted', icon: '—' },
}

export const STATUS_LABEL: Record<BookingStatus, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
) as Record<BookingStatus, string>

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** `price|<old>|<new>|<reason>` history notes (admin_set_booking_price) */
export function parsePriceNote(note?: string | null): { from: number; to: number; reason: string } | null {
  if (!note?.startsWith('price|')) return null
  const [, from, to, ...rest] = note.split('|')
  return { from: Number(from), to: Number(to), reason: rest.join('|') }
}

/** Human sentence for a status-history row (what happened, in French). */
export function describeTransition(from: BookingStatus | null, to: BookingStatus, note?: string | null): string {
  const n = note ?? ''
  const price = parsePriceNote(n)
  if (price) {
    return `Prix modifié par l'atelier : ${euro.format(price.from)} → ${euro.format(price.to)}${price.reason ? ` — ${price.reason}` : ''}`
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
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}
