import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth, isAuthedAndVerified } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import { lazy, Suspense } from 'react'
import BoardPage from './pages/BoardPage'
import DashboardPage from './pages/DashboardPage'
import LoadingScreen from './components/ui/LoadingScreen'

const ResumePage = lazy(() => import('./pages/ResumePage'))
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage'))

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <LoadingScreen fullScreen />
  if (!isAuthedAndVerified(user)) return <Navigate to="/" replace />
  return children
}

export default function Router() {
  const { user } = useAuth()
  const verified = isAuthedAndVerified(user)

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route
          path="/"
          element={
            user === undefined ? <LoadingScreen fullScreen /> :
            verified ? <Navigate to="/board" replace /> :
            // Signed in but unverified email user → send to /login verify-pending view
            (user && !verified) ? <Navigate to="/login" replace /> :
            <LandingPage />
          }
        />

        {/* Auth page */}
        <Route
          path="/login"
          element={
            user === undefined ? <LoadingScreen fullScreen /> :
            verified ? <Navigate to="/board" replace /> :
            <LoginPage />
          }
        />

        {/* App shell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="board" element={<BoardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="resumes" element={<Suspense fallback={<LoadingScreen />}><ResumePage /></Suspense>} />
          <Route path="applications/:jobId" element={<Suspense fallback={<LoadingScreen />}><ApplicationDetailPage /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
