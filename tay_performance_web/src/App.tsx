import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './features/landing/LandingPage'
import BookingPage from './features/booking/BookingPage'
import GaragePage from './features/portal/GaragePage'
import BookingsPage from './features/portal/BookingsPage'
import ProfilePage from './features/portal/ProfilePage'
import SignInPage from './features/auth/SignInPage'
import AddressPage from './features/info/AddressPage'
import AdminLayout from './features/admin/AdminLayout'
import AdminLoginPage from './features/admin/AdminLoginPage'
import QueuePage from './features/admin/QueuePage'
import AgendaPage from './features/admin/AgendaPage'
import ClientsPage from './features/admin/ClientsPage'
import VehiclesPage from './features/admin/VehiclesPage'
import PricingPage from './features/admin/PricingPage'
import ConfigPage from './features/admin/ConfigPage'
import RequireAdmin from './auth/RequireAdmin'

/** Reset scroll on navigation (hash links keep native smooth-scroll). */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/reserver" element={<BookingPage />} />
        <Route path="/garage" element={<GaragePage />} />
        <Route path="/reservations" element={<BookingsPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/connexion" element={<SignInPage />} />
        <Route path="/adresse" element={<AddressPage />} />
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
          <Route path="tarifs" element={<PricingPage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
    </>
  )
}
