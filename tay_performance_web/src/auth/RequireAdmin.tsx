import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

/** Route guard for /admin — UX only; RLS enforces the real boundary. */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          Chargement…
        </span>
      </div>
    )
  }
  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}
