import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth, isAuthedAndVerified } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import WelcomePage from './pages/WelcomePage'
import ProfilePage from './pages/ProfilePage'
import { lazy, Suspense } from 'react'
import BoardPage from './pages/BoardPage'
import DashboardPage from './pages/DashboardPage'
import LoadingScreen from './components/ui/LoadingScreen'

// Returns true if this user has already seen and dismissed the welcome page.
// We store a simple flag in localStorage keyed by user ID.
function hasSeenWelcome(uid) {
  return localStorage.getItem(`runway_onboarded_${uid}`) === 'true'
}

const ResumePage = lazy(() => import('./pages/ResumePage'))
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage'))
const OutreachPage = lazy(() => import('./pages/OutreachPage'))
const TargetCompaniesPage = lazy(() => import('./pages/TargetCompaniesPage'))

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
            // First-time users go to /welcome, returning users go straight to /board
            verified ? <Navigate to={hasSeenWelcome(user.uid) ? '/board' : '/welcome'} replace /> :
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
            // Same logic — after login, new users see welcome, returning users skip it
            verified ? <Navigate to={hasSeenWelcome(user.uid) ? '/board' : '/welcome'} replace /> :
            <LoginPage />
          }
        />

        {/* Welcome / onboarding — shown once to new users after their first login.
            It's protected (requires login) but lives outside the main Layout
            so it has no sidebar or nav chrome. */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
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
          <Route path="outreach" element={<Suspense fallback={<LoadingScreen />}><OutreachPage /></Suspense>} />
          <Route path="targets" element={<Suspense fallback={<LoadingScreen />}><TargetCompaniesPage /></Suspense>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
