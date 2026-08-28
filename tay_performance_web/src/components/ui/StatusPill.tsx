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

/** Human sentence for a status-history row (what happened, in French). */
export function describeTransition(from: BookingStatus | null, to: BookingStatus, note?: string | null): string {
  const n = note ?? ''
  if (!from) {
    if (n.includes('création manuelle')) return "Réservation créée par l'atelier" + (n.includes('prix modifié') ? ' (prix modifié)' : '')
    return 'Demande de rendez-vous envoyée par le client'
  }
  switch (to) {
    case 'confirmed':
      return "Rendez-vous confirmé par l'atelier"
    case 'in_progress':
      return 'Pose démarrée'
    case 'completed':
      return 'Pose terminée'
    case 'cancelled':
      if (n.startsWith('reprogrammation')) return `Reprogrammé par le client${n.replace('reprogrammation', '')}`
      if (n) return `Annulé — ${n}`
      return from === 'in_progress' ? 'Pose interrompue / annulée' : 'Rendez-vous annulé'
    case 'no_show':
      return "Client absent au rendez-vous (no-show)"
    case 'requested':
      return 'Demande réouverte'
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
