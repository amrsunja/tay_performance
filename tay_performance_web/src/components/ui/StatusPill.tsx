import type { BookingStatus } from '../../types/domain'

const STATUS_META: Record<BookingStatus, { label: string; tone: string; icon: string }> = {
  requested: { label: 'Demandé', tone: 'pending', icon: '◔' },
  confirmed: { label: 'Confirmé', tone: 'success', icon: '✓' },
  in_progress: { label: 'En pose', tone: 'info', icon: '◑' },
  completed: { label: 'Terminé', tone: 'success', icon: '✓' },
  cancelled: { label: 'Annulé', tone: 'danger', icon: '✕' },
  no_show: { label: 'No-show', tone: 'muted', icon: '—' },
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
