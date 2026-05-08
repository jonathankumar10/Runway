import { createContext, useContext, useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

const JobsContext = createContext(null)

export function JobsProvider({ children }) {
  const { user } = useAuth() ?? {}
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) {
      setJobs([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'users', user.uid, 'applications'),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [user?.uid])

  return (
    <JobsContext.Provider value={{ jobs, loading }}>
      {children}
    </JobsContext.Provider>
  )
}

export function useJobs() {
  return useContext(JobsContext)
}
