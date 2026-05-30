import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth, isAuthedAndVerified } from '../context/auth'
import Layout from '../components/layout/Layout'
import LoginPage from '../pages/LoginPage'
import LandingPage from '../pages/LandingPage'
import WelcomePage from '../pages/WelcomePage'
import ProfilePage from '../pages/ProfilePage'
import BoardPage from '../pages/BoardPage'
import DashboardPage from '../pages/DashboardPage'
import LoadingScreen from '../components/common/LoadingScreen'

/**
 * Returns true when this browser has completed onboarding for the user.
 */
function hasSeenWelcome(uid) {
  return localStorage.getItem(`runway_onboarded_${uid}`) === 'true'
}

const ResumePage = lazy(() => import('../pages/ResumePage'))
const ResumeDetailPage = lazy(() => import('../pages/ResumeDetailPage'))
const ApplicationDetailPage = lazy(() => import('../pages/ApplicationDetailPage'))
const OutreachPage = lazy(() => import('../pages/OutreachPage'))
const TargetCompaniesPage = lazy(() => import('../pages/TargetCompaniesPage'))
const DiscoverPage = lazy(() => import('../pages/DiscoverPage'))

/**
 * Blocks protected routes until Firebase auth resolves, then requires a verified user.
 */
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <LoadingScreen fullScreen />
  if (!isAuthedAndVerified(user)) return <Navigate to="/" replace />
  return children
}

/**
 * Defines public auth routes, first-run onboarding, and the protected app shell.
 */
export default function AppRouter() {
  const { user } = useAuth()
  const verified = isAuthedAndVerified(user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            user === undefined ? <LoadingScreen fullScreen /> :
            verified ? <Navigate to={hasSeenWelcome(user.uid) ? '/board' : '/welcome'} replace /> :
            (user && !verified) ? <Navigate to="/login" replace /> :
            <LandingPage />
          }
        />

        <Route
          path="/login"
          element={
            user === undefined ? <LoadingScreen fullScreen /> :
            verified ? <Navigate to={hasSeenWelcome(user.uid) ? '/board' : '/welcome'} replace /> :
            <LoginPage />
          }
        />

        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          }
        />

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
          <Route path="resumes/:resumeId" element={<Suspense fallback={<LoadingScreen />}><ResumeDetailPage /></Suspense>} />
          <Route path="applications/:jobId" element={<Suspense fallback={<LoadingScreen />}><ApplicationDetailPage /></Suspense>} />
          <Route path="outreach" element={<Suspense fallback={<LoadingScreen />}><OutreachPage /></Suspense>} />
          <Route path="targets" element={<Suspense fallback={<LoadingScreen />}><TargetCompaniesPage /></Suspense>} />
          <Route path="discover" element={<Suspense fallback={<LoadingScreen />}><DiscoverPage /></Suspense>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
