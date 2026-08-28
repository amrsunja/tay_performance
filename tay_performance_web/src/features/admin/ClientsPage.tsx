import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../../components/ui/Modal'
import PhoneInput from '../../components/ui/PhoneInput'
import { formatPhoneDisplay, normalizePhone } from '../../lib/phone'
import { isValidEmail } from '../../api/auth'
import StatusPill from '../../components/ui/StatusPill'
import { getClientBookings, listClients, updateClientProfile } from '../../api/admin'
import { errorMessage } from '../../lib/supabase'
import type { AdminClientRow } from '../../types/api'
import { formatEuro } from '../booking/useBookingDraft'
import styles from './admin.module.css'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function initials(name: string | null): string {
  if (!name) return '∅'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<AdminClientRow | null>(null)

  const clients = useQuery({
    queryKey: ['admin', 'clients', search],
    queryFn: () => listClients(search),
    staleTime: 15_000,
  })

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={`sat ${styles.pageTitle}`}>Clients</h1>
        <p className={styles.pageSub}>Contacts, véhicules rattachés et historique de passage. Les clients anonymes apparaissent dès leur première réservation.</p>
      </div>

      <div className={styles.toolRow}>
        <input
          className="field"
          style={{ maxWidth: 320 }}
          placeholder="Rechercher un client, un e-mail, une plaque…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th className={styles.thNum}>Véhicules</th>
              <th className={styles.thNum}>Réservations</th>
              <th>Dernière visite</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {(clients.data ?? []).map((client) => (
              <tr key={client.id}>
                <td>
                  <span className={styles.avatarCell}>
                    <span className={styles.avatar} aria-hidden>
                      {initials(client.fullName)}
                    </span>
                    <span className={styles.cellStrong}>
                      {client.fullName ?? 'Client anonyme'}
                      {client.isAnonymous && (
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 6 }}>
                          ANON
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td>
                  <span className={styles.cellStack}>
                    <span>{client.email ?? '—'}</span>
                    <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                      {formatPhoneDisplay(client.phone) || '—'}
                    </span>
                  </span>
                </td>
                <td className={`mono ${styles.tdNum}`}>{client.vehiclesCount}</td>
                <td className={`mono ${styles.tdNum}`}>{client.bookingsCount}</td>
                <td className="mono" style={{ fontSize: 13 }}>
                  {client.lastVisit ? dateFmt.format(new Date(client.lastVisit)) : '—'}
                </td>
                <td className={styles.tdActions}>
                  <button type="button" className={styles.iconBtn} title="Ouvrir la fiche" onClick={() => setOpen(client)}>
                    ↗
                  </button>
                </td>
              </tr>
            ))}
            {!clients.isPending && (clients.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="mono" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  Aucun client trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <ClientDrawer client={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ClientDrawer({ client, onClose }: { client: AdminClientRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(client.fullName ?? '')
  const [email, setEmail] = useState(client.email ?? '')
  const [phone, setPhone] = useState(normalizePhone(client.phone ?? '') ?? '')
  const [error, setError] = useState('')

  const bookings = useQuery({
    queryKey: ['admin', 'client-bookings', client.id],
    queryFn: () => getClientBookings(client.id),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isValidEmail(email.trim()) || !phone) throw new Error('INVALID_CONTACT')
      await updateClientProfile(client.id, { fullName, email: email.trim(), phone })
    },
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Modal title={client.fullName ?? 'Client anonyme'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <input className="field" placeholder="Nom" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <input className="field" placeholder="E-mail *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <PhoneInput value={phone} onChange={setPhone} aria-label="Téléphone *" />
        </div>
        {error && <span style={{ color: 'var(--status-warning)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="ghost"
          style={{ fontSize: 13, padding: '10px 16px', borderRadius: 11, justifySelf: 'start' }}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isSuccess ? '✓ Enregistré' : 'Enregistrer'}
        </button>

        <div className="sat" style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 8 }}>
          Réservations
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(bookings.data ?? []).map((b) => (
            <div
              key={b.id}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 10, background: 'var(--surface-1)' }}
            >
              <span className="mono" style={{ fontSize: 12, color: 'var(--octane-300)' }}>{b.reference}</span>
              <span style={{ fontSize: 13, color: 'var(--text-soft)', flex: 1 }}>{b.vehicleLabel}</span>
              <StatusPill status={b.status} />
              <span className="mono" style={{ fontSize: 13 }}>{formatEuro(b.priceTotal)}</span>
            </div>
          ))}
          {!bookings.isPending && (bookings.data ?? []).length === 0 && (
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucune réservation.</span>
          )}
        </div>
      </div>
    </Modal>
  )
}
