/* /profil — the client's account hub: editable personal info, verified-account
   state (phone OTP), vehicles and reservations overview. */
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import StatusPill from '../../components/ui/StatusPill'
import { useAuth } from '../../auth/AuthProvider'
import { getMyProfile, updateMyProfile } from '../../api/profile'
import { getMyVehicles } from '../../api/garage'
import { getMyBookings } from '../../api/bookings'
import { isValidEmail } from '../../api/auth'
import { errorMessage } from '../../lib/supabase'
import { formatEuro } from '../booking/useBookingDraft'
import styles from './portal.module.css'

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
})

const card: React.CSSProperties = {
  padding: 24,
  borderRadius: 'var(--r-lg)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-1)',
  display: 'grid',
  gap: 14,
  alignContent: 'start',
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, isAnonymous, loading, signOut } = useAuth()
  const userId = session?.user.id

  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(userId!),
    enabled: Boolean(userId),
  })
  const vehicles = useQuery({ queryKey: ['garage'], queryFn: getMyVehicles, enabled: Boolean(userId) })
  const bookings = useQuery({ queryKey: ['my-bookings'], queryFn: getMyBookings, enabled: Boolean(userId) })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile.data && !hydrated) {
      setFullName(profile.data.fullName)
      setEmail(profile.data.email)
      setPhone(profile.data.phone)
      setHydrated(true)
    }
  }, [profile.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('FORBIDDEN')
      if (email && !isValidEmail(email)) throw new Error('INVALID_CONTACT')
      await updateMyProfile(userId, {
        fullName,
        email,
        // the verified phone is managed by auth — don't let a profile edit desync it
        phone: isAnonymous ? phone : profile.data?.phone,
      })
    },
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (!loading && !session) {
    return <Navigate to="/connexion" replace />
  }

  const list = bookings.data ?? []

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head} data-reveal>
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>Espace client · Mon profil</span>
            </div>
            <h1 className={`clash ${styles.h1}`}>
              Votre compte<span style={{ color: 'var(--accent-500)' }}>.</span>
            </h1>
          </div>
          <div className={styles.tabs}>
            <Link to="/garage" className={styles.tab}>
              Mon Garage
            </Link>
            <Link to="/reservations" className={styles.tab}>
              Mes réservations
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* -------- personal info -------- */}
          <section style={card} aria-label="Informations personnelles">
            <h2 className="sat" style={{ margin: 0, fontSize: 18, color: 'var(--text-hi)' }}>
              Informations personnelles
            </h2>
            <input
              className="field"
              placeholder="Nom complet"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="field"
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {isAnonymous ? (
              <input
                className="field mono"
                type="tel"
                placeholder="Téléphone"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="field mono" style={{ flex: 1, opacity: 0.75 }}>
                  {profile.data?.phone || '—'}
                </span>
                <span className="pill pill--success">
                  <span aria-hidden>✓</span> Vérifié
                </span>
              </div>
            )}
            {error && (
              <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">
                {error}
              </span>
            )}
            <button
              type="button"
              className="cta"
              style={{ fontSize: 14, padding: '12px 22px', borderRadius: 12, justifySelf: 'start' }}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Enregistrement…' : saveMutation.isSuccess ? '✓ Enregistré' : 'Enregistrer'}
            </button>
          </section>

          {/* -------- account state -------- */}
          <section style={card} aria-label="Compte">
            <h2 className="sat" style={{ margin: 0, fontSize: 18, color: 'var(--text-hi)' }}>
              Accès au compte
            </h2>
            {isAnonymous ? (
              <>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-mut)', lineHeight: 1.55 }}>
                  Votre historique vit pour l'instant sur <b>cet appareil uniquement</b>. Liez votre numéro par SMS
                  pour le retrouver partout — sans mot de passe.
                </p>
                <Link
                  to="/connexion"
                  className="cta"
                  style={{ fontSize: 14, padding: '13px 22px', borderRadius: 12, justifySelf: 'start' }}
                >
                  Se connecter par SMS →
                </Link>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-mut)' }}>
                  Compte vérifié — vos réservations vous suivent sur tous vos appareils.
                </p>
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 13, padding: '11px 18px', borderRadius: 11, justifySelf: 'start', color: 'var(--status-danger)' }}
                  onClick={async () => {
                    await signOut()
                    navigate('/', { replace: true })
                  }}
                >
                  Se déconnecter
                </button>
              </>
            )}
          </section>
        </div>

        {/* -------- vehicles -------- */}
        <h2 className={`sat ${styles.groupTitle}`} style={{ marginTop: 40 }}>
          Mes véhicules <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>({(vehicles.data ?? []).length})</span>
        </h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {(vehicles.data ?? []).map((v) => (
            <div
              key={v.vehicleId}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
            >
              <span className={`mono ${styles.vehicleBadge}`}>{v.badge}</span>
              <span style={{ flex: 1 }}>
                <span className="sat" style={{ fontSize: 15, color: 'var(--text-hi)' }}>
                  {v.make} {v.generation} {v.model}
                </span>
                <span className="mono" style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)' }}>
                  {v.bodyLabel} · {v.plate ?? 'sans immat.'}
                </span>
              </span>
              <Link to={`/reserver?vehicle=${v.vehicleId}`} className="ghost" style={{ fontSize: 13, padding: '9px 14px', borderRadius: 10 }}>
                Réserver →
              </Link>
            </div>
          ))}
          {!vehicles.isPending && (vehicles.data ?? []).length === 0 && (
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Aucun véhicule — il s'ajoutera automatiquement à votre première réservation.
            </span>
          )}
          <Link to="/garage" className="navlink" style={{ fontSize: 13 }}>
            Gérer mon garage →
          </Link>
        </div>

        {/* -------- reservations -------- */}
        <h2 className={`sat ${styles.groupTitle}`} style={{ marginTop: 40 }}>
          Mes réservations <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>({list.length})</span>
        </h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((b) => (
            <div
              key={b.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', flexWrap: 'wrap' }}
            >
              <span className="mono" style={{ fontSize: 12, color: 'var(--octane-300)' }}>{b.reference}</span>
              <span style={{ flex: 1, minWidth: 180 }}>
                <span style={{ fontSize: 14, color: 'var(--text-soft)' }}>{b.vehicleLabel}</span>
                <span className="mono" style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)' }}>
                  {dateFmt.format(new Date(b.slotStart))}
                </span>
              </span>
              <StatusPill status={b.status} />
              <span className="mono" style={{ fontSize: 14 }}>{formatEuro(b.priceTotal)}</span>
            </div>
          ))}
          {!bookings.isPending && list.length === 0 && (
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>Aucune réservation pour l'instant.</span>
          )}
          <Link to="/reservations" className="navlink" style={{ fontSize: 13 }}>
            Voir le détail des réservations →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
