import AppProviders from './AppProviders'
import AppRouter from './AppRouter'

/**
 * Root app composition.
 * Keeps global providers and routing separate so startup flow is easy to scan.
 */
export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
