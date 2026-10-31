import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

/** Minimal token-styled modal — used by garage add-vehicle and admin dialogs. */
import Icon from './Icon'
export default function Modal({ title, onClose, children, wide }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel" style={{ maxWidth: wide ? 860 : 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="sat" style={{ fontSize: 18, margin: 0, color: 'var(--text-hi)' }}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-1)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              placeContent: 'center',
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
