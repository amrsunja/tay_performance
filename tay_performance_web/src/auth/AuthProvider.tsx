/* Session context: restores the Supabase session, exposes a lazy
   `ensureSession()` (anonymous sign-in on first identity-requiring action),
   and resolves the profile role for admin routing.
   Security note: RLS is the real boundary — this context is UX only. */
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthState {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isAnonymous: boolean
  /** Returns an existing session or creates an anonymous one. */
  ensureSession: () => Promise<Session>
  signOut: () => Promise<void>
  refreshRole: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const resolveRole = useCallback(async (s: Session | null) => {
    if (!s) {
      setIsAdmin(false)
      return
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', s.user.id).single()
    setIsAdmin(data?.role === 'admin')
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      resolveRole(data.session).finally(() => mounted && setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      resolveRole(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [resolveRole])

  const ensureSession = useCallback(async (): Promise<Session> => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    const { data: anon, error } = await supabase.auth.signInAnonymously()
    if (error || !anon.session) {
      throw error ?? new Error('anonymous sign-in failed')
    }
    return anon.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshRole = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await resolveRole(data.session)
  }, [resolveRole])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      isAdmin,
      isAnonymous: session?.user?.is_anonymous ?? true,
      ensureSession,
      signOut,
      refreshRole,
    }),
    [session, loading, isAdmin, ensureSession, signOut, refreshRole],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
