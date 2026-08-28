/* /connexion — phone + SMS OTP only.
   With an anonymous session → LINK mode: the verified phone converts the current
   session into a real account in place (all bookings/vehicles kept).
   Without a session → SIGN-IN mode: OTP sign-in (account auto-created first time). */
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import { useAuth } from '../../auth/AuthProvider'
import {
  isPhoneTakenError,
  normalizePhone,
  sendLinkPhoneOtp,
  sendSignInOtp,
  verifyLinkPhoneOtp,
  verifySignInOtp,
} from '../../api/auth'
import { errorMessage } from '../../lib/supabase'
import PhoneInput from '../../components/ui/PhoneInput'
import { formatPhoneDisplay } from '../../lib/phone'
import styles from '../portal/portal.module.css'

type Step = 'phone' | 'code'

export default function SignInPage() {
  const navigate = useNavigate()
  const { session, isAnonymous, loading } = useAuth()
  const [mode, setMode] = useState<'auto' | 'signin'>('auto')
  const [step, setStep] = useState<Step>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [phoneTaken, setPhoneTaken] = useState(false)

  if (!loading && session && !isAnonymous) {
    return <Navigate to="/profil" replace />
  }

  const linkMode = mode === 'auto' && Boolean(session) && isAnonymous

  const sendCode = async () => {
    const normalized = normalizePhone(phoneInput)
    if (!normalized) {
      setError('Numéro invalide — format 06 12 34 56 78 ou +33…')
      return
    }
    setPending(true)
    setError('')
    setPhoneTaken(false)
    try {
      if (linkMode) {
        await sendLinkPhoneOtp(normalized)
      } else {
        await sendSignInOtp(normalized)
      }
      setPhone(normalized)
      setStep('code')
    } catch (e) {
      if (linkMode && isPhoneTakenError(e)) {
        setPhoneTaken(true)
        setError('Ce numéro a déjà un compte.')
      } else {
        setError(errorMessage(e))
      }
    } finally {
      setPending(false)
    }
  }

  const verifyCode = async () => {
    setPending(true)
    setError('')
    try {
      if (linkMode) {
        await verifyLinkPhoneOtp(phone, code.trim())
      } else {
        await verifySignInOtp(phone, code.trim())
      }
      navigate('/profil', { replace: true })
    } catch {
      setError('Code invalide ou expiré — réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main} style={{ display: 'grid', placeItems: 'start center' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'phone') sendCode()
            else verifyCode()
          }}
          style={{
            width: '100%',
            maxWidth: 440,
            display: 'grid',
            gap: 16,
            padding: 32,
            marginTop: 40,
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <div>
            <div className={styles.kickerRow}>
              <span className={styles.kickerLine} />
              <span className={`mono ${styles.kicker}`}>
                {linkMode ? 'Sécuriser mon compte' : 'Connexion'}
              </span>
            </div>
            <h1 className={`clash ${styles.h1}`} style={{ fontSize: 34 }}>
              {linkMode ? 'Liez votre numéro.' : 'Connexion par SMS.'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-mut)', margin: '10px 0 0', lineHeight: 1.55 }}>
              {linkMode
                ? 'Vos réservations et véhicules actuels sont conservés — le numéro vérifié vous permettra de les retrouver sur tous vos appareils. Aucun mot de passe.'
                : 'Entrez votre numéro : vous recevez un code par SMS. Pas de mot de passe. Un compte est créé automatiquement à la première connexion.'}
            </p>
          </div>

          {step === 'phone' ? (
            <>
              <PhoneInput value={phoneInput} onChange={setPhoneInput} autoFocus aria-label="Téléphone" />
              {error && (
                <span style={{ color: 'var(--status-warning)', fontSize: 13 }} role="alert">
                  {error}
                </span>
              )}
              {phoneTaken && (
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 13, padding: '11px 16px', borderRadius: 11 }}
                  onClick={() => {
                    setMode('signin')
                    setPhoneTaken(false)
                    setError('')
                  }}
                >
                  Se connecter avec ce numéro à mon compte existant →
                </button>
              )}
              {mode === 'signin' && session && (
                <span style={{ fontSize: 12, color: 'var(--status-pending)' }}>
                  ⚠ En vous connectant à un autre compte, l'historique de cette session anonyme ne sera plus visible
                  sur cet appareil.
                </span>
              )}
              <button
                type="submit"
                className="cta"
                style={{ fontSize: 15, padding: 14, borderRadius: 12 }}
                disabled={pending || !phoneInput}
              >
                {pending ? 'Envoi…' : 'Recevoir mon code SMS'}
              </button>
            </>
          ) : (
            <>
              <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Code envoyé au <span style={{ color: 'var(--text-soft)' }}>{formatPhoneDisplay(phone)}</span>
              </span>
              <input
                className="field mono"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{ letterSpacing: '0.35em', textAlign: 'center', fontSize: 20 }}
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
                disabled={pending || code.length < 6}
              >
                {pending ? 'Vérification…' : 'Valider le code'}
              </button>
              <button
                type="button"
                className="navlink"
                style={{ fontSize: 13, justifySelf: 'center' }}
                onClick={() => {
                  setStep('phone')
                  setCode('')
                  setError('')
                }}
              >
                ← Changer de numéro / renvoyer un code
              </button>
            </>
          )}

          <span style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
            Première visite ? <Link to="/reserver" className="navlink">Réservez directement</Link> — aucun compte
            requis.
          </span>
        </form>
      </main>
      <SiteFooter />
    </div>
  )
}
