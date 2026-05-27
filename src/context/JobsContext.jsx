import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'
import { STAGES } from '../constants/stages'
import { JobsContext } from './jobsContext'

const VALID_STAGES = new Set(STAGES.map(stage => stage.id))
const EMPTY_JOBS_STATE = { userId: null, jobs: [], loading: false }

function normalizeJob(docSnapshot) {
  return { id: docSnapshot.id, ...docSnapshot.data() }
}

export function JobsProvider({ children }) {
  const { user } = useAuth() ?? {}
  const userId = user?.uid ?? null
  const [jobsState, setJobsState] = useState(EMPTY_JOBS_STATE)

  useEffect(() => {
    if (!userId) return

    const applicationsQuery = query(
      collection(db, 'users', userId, 'applications'),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(applicationsQuery, (snapshot) => {
      const jobs = snapshot.docs
        .map(normalizeJob)
        .filter(job => VALID_STAGES.has(job.stage))

      setJobsState({ userId, jobs, loading: false })
    })
  }, [userId])

  const value = useMemo(() => {
    if (!userId) return EMPTY_JOBS_STATE
    if (jobsState.userId !== userId) return { userId, jobs: [], loading: true }
    return jobsState
  }, [jobsState, userId])

  return (
    <JobsContext.Provider value={value}>
      {children}
    </JobsContext.Provider>
  )
}
