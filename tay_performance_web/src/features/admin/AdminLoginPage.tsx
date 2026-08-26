import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'

/** Email + password sign-in for dashboard-created admin accounts only.
    Non-admin credentials are rejected with a generic error (docs/03 §1.2). */
export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { refreshRole } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setPending(true)
    setError('')
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !data.session) throw signInError ?? new Error('login failed')
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single()
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('not admin')
      }
      await refreshRole()
      navigate('/admin', { replace: true })
    } catch {
      setError('Identifiants invalides.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-canvas)', padding: 20 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'grid',
          gap: 14,
          padding: 32,
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-1)',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        <img src={logo} alt="Tay Performance" style={{ height: 40, justifySelf: 'center', marginBottom: 6 }} />
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-dim)', textAlign: 'center' }}>
          ADMIN · ATELIER
        </div>
        <input
          className="field"
          type="email"
          placeholder="E-mail"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="Mot de passe"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">
            {error}
          </span>
        )}
        <button
          type="submit"
          className="cta"
          style={{ fontSize: 15, padding: 14, borderRadius: 12 }}
          disabled={pending || !email || !password}
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
          Comptes créés par l'administrateur uniquement.
        </span>
      </form>
    </div>
  )
}
