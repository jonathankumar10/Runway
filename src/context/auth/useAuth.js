import { useContext } from 'react'
import { AuthContext } from './authContext'

/**
 * Reads the current auth state and auth actions from AuthProvider.
 */
export function useAuth() {
  return useContext(AuthContext)
}
