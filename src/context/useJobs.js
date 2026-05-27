import { useContext } from 'react'
import { JobsContext } from './jobsContext'

export function useJobs() {
  return useContext(JobsContext)
}
