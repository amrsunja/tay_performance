/* New reservation: an existing client from the list (fills the contact, attaches the booking
   to his account) or a new one typed by hand. */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listClients } from '../../api/admin'
import { e164FromStored, formatPhoneDisplay } from '../../lib/phone'
import booking from '../booking/booking.module.css'
import styles from './admin.module.css'

export interface PickedClient {
  id: string
  name: string
  phone: string
  email: string
}

const MAX_RESULTS = 8

export default function ClientPicker({ value, onChange }: { value: PickedClient | null; onChange: (client: PickedClient | null) => void }) {
  const [existing, setExisting] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const clients = useQuery({
    queryKey: ['admin', 'clients', debounced],
    queryFn: () => listClients(debounced),
    enabled: existing && !value,
    staleTime: 30_000,
  })
  const results = (clients.data ?? []).slice(0, MAX_RESULTS)

  const setMode = (next: boolean) => {
    setExisting(next)
    setSearch('')
    onChange(null)
  }

  return (
    <div className={styles.formGroup}>
      <div className={booking.forWho} style={{ marginTop: 0 }} role="radiogroup" aria-label="Client">
        <button type="button" role="radio" aria-checked={!existing} className={`${booking.forWhoBtn} ${!existing ? booking.forWhoActive : ''}`} onClick={() => setMode(false)}>
          Nouveau client
        </button>
        <button type="button" role="radio" aria-checked={existing} className={`${booking.forWhoBtn} ${existing ? booking.forWhoActive : ''}`} onClick={() => setMode(true)}>
          Client existant
        </button>
      </div>

      {existing && value && (
        <div className={styles.clientPicked}>
          <span>
            <b>{value.name || 'Client sans nom'}</b> — la réservation apparaîtra dans son compte.
          </span>
          <button type="button" className="navlink mono" style={{ fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: 'none' }} onClick={() => onChange(null)}>
            changer
          </button>
        </div>
      )}

      {existing && !value && (
        <>
          <input className="field" type="search" placeholder="Rechercher : nom, téléphone, e-mail, plaque…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un client" />
          <div className={styles.clientResults}>
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.clientResult}
                onClick={() => onChange({ id: c.id, name: c.fullName ?? '', phone: e164FromStored(c.phone), email: c.email ?? '' })}
              >
                <span className={styles.cellStrong}>{c.fullName || 'Client anonyme'}</span>
                <span className={`mono ${styles.formHint}`}>
                  {[c.phone ? formatPhoneDisplay(c.phone) || c.phone : null, c.email].filter(Boolean).join(' · ') || 'Sans coordonnées'}
                </span>
              </button>
            ))}
            {clients.isSuccess && results.length === 0 && <span className={`mono ${styles.formHint}`}>Aucun client trouvé.</span>}
            {clients.isPending && <span className={`mono ${styles.formHint}`}>Recherche…</span>}
          </div>
        </>
      )}
    </div>
  )
}
