import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './features/landing/LandingPage'
import BookingPage from './features/booking/BookingPage'
import RequireAdmin from './auth/RequireAdmin'

/* Découpage du bundle.
   ------------------------------------------------------------------
   Avant : un seul fichier JS de ~790 Ko contenant le panneau admin, le portail client
   et les pages légales — téléchargé intégralement par un visiteur venu de Google pour
   lire un prix. C'est du poids pur sur le LCP mobile, donc sur le classement.

   Restent chargés d'emblée : la landing (page d'entrée SEO) et le funnel de réservation
   (première action attendue). Tout le reste est chargé à la demande. */
const GaragePage = lazy(() => import('./features/portal/GaragePage'))
const BookingsPage = lazy(() => import('./features/portal/BookingsPage'))
const ProfilePage = lazy(() => import('./features/portal/ProfilePage'))
const SignInPage = lazy(() => import('./features/auth/SignInPage'))
const AddressPage = lazy(() => import('./features/info/AddressPage'))
const MentionsLegalesPage = lazy(() => import('./features/legal/MentionsLegalesPage'))
const PrivacyPage = lazy(() => import('./features/legal/PrivacyPage'))
const TermsPage = lazy(() => import('./features/legal/TermsPage'))

const AdminLayout = lazy(() => import('./features/admin/AdminLayout'))
const AdminLoginPage = lazy(() => import('./features/admin/AdminLoginPage'))
const QueuePage = lazy(() => import('./features/admin/QueuePage'))
const AgendaPage = lazy(() => import('./features/admin/AgendaPage'))
const ClientsPage = lazy(() => import('./features/admin/ClientsPage'))
const VehiclesPage = lazy(() => import('./features/admin/VehiclesPage'))
const PricingPage = lazy(() => import('./features/admin/PricingPage'))
const ConfigPage = lazy(() => import('./features/admin/ConfigPage'))
const TransactionsPage = lazy(() => import('./features/admin/TransactionsPage'))

/** Reset scroll on navigation (hash links keep native smooth-scroll). */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

/** Écran d'attente d'un chunk paresseux — volontairement neutre et sans saut de mise en page. */
function RouteFallback() {
  return <div style={{ minHeight: '60vh', background: 'var(--bg-canvas)' }} aria-busy="true" />
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/reserver" element={<BookingPage />} />
          <Route path="/garage" element={<GaragePage />} />
          <Route path="/reservations" element={<BookingsPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/connexion" element={<SignInPage />} />
          <Route path="/adresse" element={<AddressPage />} />
          <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
          <Route path="/cgv" element={<TermsPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<QueuePage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="vehicules" element={<VehiclesPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="tarifs" element={<PricingPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
