import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import Router from './router'

export default function App() {
  return (
    <AuthProvider>
      <JobsProvider>
        <Router />
      </JobsProvider>
    </AuthProvider>
  )
}
