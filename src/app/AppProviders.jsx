import { AuthProvider } from '../context/auth'
import { JobsProvider } from '../context/jobs'

/**
 * Registers app-wide providers in dependency order.
 * JobsProvider depends on AuthProvider because jobs are scoped to the signed-in user.
 */
export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <JobsProvider>
        {children}
      </JobsProvider>
    </AuthProvider>
  )
}
