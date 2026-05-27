import { useContext } from 'react'
import { JobsContext } from './jobsContext'

/**
 * Reads live application data from JobsProvider.
 */
export function useJobs() {
  return useContext(JobsContext)
}
