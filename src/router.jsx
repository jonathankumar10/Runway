import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import { lazy, Suspense } from 'react'
import BoardPage from './pages/BoardPage'
import DashboardPage from './pages/DashboardPage'
const ResumePage = lazy(() => import('./pages/ResumePage'))
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage'))

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function Router() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/board" replace /> : <LoginPage />} />
        <Route path="/" element={<Navigate to="/board" replace />} />
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
          <Route path="resumes" element={<Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading...</div>}><ResumePage /></Suspense>} />
          <Route path="applications/:jobId" element={<Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading...</div>}><ApplicationDetailPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
