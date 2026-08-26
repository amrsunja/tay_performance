import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { getCatalog } from '../../api/catalog'
import {
  addBlackout,
  changePassword,
  countFutureBookings,
  getBlackouts,
  getWorkshopHours,
  removeBlackout,
  saveSetting,
  saveWorkshopDay,
} from '../../api/configAdmin'
import { errorMessage } from '../../lib/supabase'
import type { WorkshopHoursRow } from '../../types/api'
import styles from './admin.module.css'

const DAY_LABELS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function ConfigPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [days, setDays] = useState<WorkshopHoursRow[]>([])
  const [dirtyDays, setDirtyDays] = useState<Set<number>>(new Set())
  const [blackoutDay, setBlackoutDay] = useState('')
  const [blackoutReason, setBlackoutReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  const hours = useQuery({ queryKey: ['config', 'hours'], queryFn: getWorkshopHours })
  const blackouts = useQuery({ queryKey: ['config', 'blackouts'], queryFn: getBlackouts })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 60_000 })
  const futureCount = useQuery({ queryKey: ['config', 'future-count'], queryFn: countFutureBookings })

  useEffect(() => {
    if (hours.data && days.length === 0) setDays(hours.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours.data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['config'] })
    queryClient.invalidateQueries({ queryKey: ['catalog'] })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
  }

  const patchDay = (weekday: number, patch: Partial<WorkshopHoursRow>) => {
    setDays((d) => d.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)))
    setDirtyDays((s) => new Set(s).add(weekday))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const weekday of dirtyDays) {
        const row = days.find((d) => d.weekday === weekday)
        if (row) await saveWorkshopDay(row)
      }
    },
    onSuccess: () => {
      setDirtyDays(new Set())
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const settingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) => saveSetting(key, value, session!.user.id),
    onSuccess: () => {
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const addBlackoutMutation = useMutation({
    mutationFn: () => addBlackout(blackoutDay, blackoutReason.trim() || 'Atelier fermé', session!.user.id),
    onSuccess: () => {
      setBlackoutDay('')
      setBlackoutReason('')
      setError('')
      invalidate()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(newPassword),
    onSuccess: () => {
      setPasswordSaved(true)
      setNewPassword('')
      setError('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const settings = catalog.data?.settings

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Configuration atelier</h1>
        <p className={styles.pageSub}>Horaires, granularité des créneaux, baies et jours bloqués.</p>
      </div>

      {error && (
        <div style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 14 }} role="alert">
          {error}
        </div>
      )}

      <div className={styles.twoCol}>
        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Horaires d'ouverture</h2>
          </div>
          <div className={styles.configCard}>
            {days.map((day) => (
              <div key={day.weekday} className={styles.dayRow}>
                <label className={styles.daySwitch}>
                  <input
                    type="checkbox"
                    checked={day.isOpen}
                    aria-label={`${DAY_LABELS[day.weekday]} ouvert`}
                    onChange={(e) =>
                      patchDay(day.weekday, {
                        isOpen: e.target.checked,
                        openTime: day.openTime ?? '09:00',
                        closeTime: day.closeTime ?? '18:00',
                      })
                    }
                  />
                  <span className={styles.switchTrack} aria-hidden>
                    <span className={styles.switchThumb} />
                  </span>
                  <span className={styles.dayName}>{DAY_LABELS[day.weekday]}</span>
                </label>
                {day.isOpen ? (
                  <span className={`mono ${styles.dayHours}`}>
                    <input
                      className={`field mono ${styles.timeField}`}
                      type="time"
                      value={day.openTime ?? '09:00'}
                      aria-label={`${DAY_LABELS[day.weekday]} ouverture`}
                      onChange={(e) => patchDay(day.weekday, { openTime: e.target.value })}
                    />
                    →
                    <input
                      className={`field mono ${styles.timeField}`}
                      type="time"
                      value={day.closeTime ?? '18:00'}
                      aria-label={`${DAY_LABELS[day.weekday]} fermeture`}
                      onChange={(e) => patchDay(day.weekday, { closeTime: e.target.value })}
                    />
                  </span>
                ) : (
                  <span className={`mono ${styles.dayClosed}`}>Fermé</span>
                )}
              </div>
            ))}
            {dirtyDays.size > 0 && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  className="cta"
                  style={{ fontSize: 13, padding: '10px 18px', borderRadius: 11 }}
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer les horaires'}
                </button>
                {(futureCount.data ?? 0) > 0 && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--status-pending)' }}>
                    ⚠ {futureCount.data} réservation(s) à venir — vérifiez les conflits
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Créneaux & capacité</h2>
          </div>
          <div className={styles.configCard}>
            <div className={styles.configRow}>
              <span>Granularité des créneaux</span>
              <select
                className={`field mono ${styles.selectField}`}
                value={settings?.slotGranularityMin ?? 30}
                aria-label="Granularité"
                onChange={(e) => settingMutation.mutate({ key: 'slot_granularity_min', value: Number(e.target.value) })}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
            <div className={styles.configRow}>
              <span>Nombre de baies en parallèle</span>
              <select
                className={`field mono ${styles.selectField}`}
                value={settings?.bayCount ?? 1}
                aria-label="Baies"
                onChange={(e) => settingMutation.mutate({ key: 'bay_count', value: Number(e.target.value) })}
              >
                <option value="1">1 baie</option>
                <option value="2">2 baies</option>
                <option value="3">3 baies</option>
              </select>
            </div>
            <div className={styles.configRow}>
              <span>Fenêtre d'annulation client</span>
              <select
                className={`field mono ${styles.selectField}`}
                value={settings?.cancellationCutoffHours ?? 24}
                aria-label="Fenêtre annulation"
                onChange={(e) => settingMutation.mutate({ key: 'cancellation_cutoff_hours', value: Number(e.target.value) })}
              >
                <option value="12">≥12h avant</option>
                <option value="24">≥24h avant</option>
                <option value="48">≥48h avant</option>
              </select>
            </div>
            <div className={styles.configRow}>
              <span>Durée de blocage d'un créneau (panier)</span>
              <select
                className={`field mono ${styles.selectField}`}
                value={settings?.holdTtlMinutes ?? 10}
                aria-label="TTL du hold"
                onChange={(e) => settingMutation.mutate({ key: 'hold_ttl_minutes', value: Number(e.target.value) })}
              >
                <option value="5">5 min</option>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.blockHead}>
            <h2 className={`sat ${styles.blockTitle}`}>Jours bloqués</h2>
          </div>
          <div className={styles.configCard}>
            {(blackouts.data ?? []).map((blackout) => (
              <div key={blackout.id} className={styles.blackoutRow}>
                <span className={`mono ${styles.blackoutDate}`}>
                  {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
                    new Date(`${blackout.day}T00:00:00`),
                  )}
                </span>
                <span className={styles.blackoutReason}>{blackout.reason}</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Débloquer"
                  onClick={() => removeBlackout(blackout.id).then(invalidate).catch((e) => setError(errorMessage(e)))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                className="field mono"
                type="date"
                value={blackoutDay}
                onChange={(e) => setBlackoutDay(e.target.value)}
                style={{ maxWidth: 170 }}
                aria-label="Date à bloquer"
              />
              <input
                className="field"
                placeholder="Raison"
                value={blackoutReason}
                onChange={(e) => setBlackoutReason(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <button
                type="button"
                className="ghost"
                style={{ fontSize: 12, padding: '10px 14px', borderRadius: 10 }}
                disabled={!blackoutDay || addBlackoutMutation.isPending}
                onClick={() => addBlackoutMutation.mutate()}
              >
                + Bloquer
              </button>
            </div>
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Notifications</h2>
          </div>
          <div className={styles.configCard}>
            <div className={styles.configRow}>
              <span>E-mail de confirmation client</span>
              <span className="pill pill--success">
                <span aria-hidden>✓</span> Actif
              </span>
            </div>
            <div className={styles.configRow}>
              <span>Rappel J-1</span>
              <span className="pill pill--success">
                <span aria-hidden>✓</span> Actif
              </span>
            </div>
            <div className={styles.configRow}>
              <span>SMS (passerelle)</span>
              <span className="pill pill--muted">
                <span aria-hidden>—</span> V2
              </span>
            </div>
          </div>

          <div className={styles.blockHead} style={{ marginTop: 28 }}>
            <h2 className={`sat ${styles.blockTitle}`}>Compte</h2>
          </div>
          <div className={styles.configCard}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="field"
                type="password"
                placeholder="Nouveau mot de passe (≥10 caractères)"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordSaved(false)
                }}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button
                type="button"
                className="ghost"
                style={{ fontSize: 12, padding: '10px 14px', borderRadius: 10 }}
                disabled={newPassword.length < 10 || passwordMutation.isPending}
                onClick={() => passwordMutation.mutate()}
              >
                {passwordSaved ? '✓ Modifié' : 'Changer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
