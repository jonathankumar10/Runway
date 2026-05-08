import {
  addDoc, updateDoc, deleteDoc,
  collection, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export function useJobMutations() {
  const { user } = useAuth()

  function col() {
    return collection(db, 'users', user.uid, 'applications')
  }

  function docRef(id) {
    return doc(db, 'users', user.uid, 'applications', id)
  }

  async function addJob(data) {
    const logoUrl = data.company
      ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(data.company.toLowerCase().replace(/\s+/g, '') + '.com')}`
      : null
    await addDoc(col(), {
      company: '',
      role: '',
      jobUrl: '',
      logoUrl,
      salaryMin: null,
      salaryMax: null,
      currency: 'USD',
      recruiterName: '',
      recruiterEmail: '',
      location: '',
      dateApplied: null,
      interviewDates: [],
      notes: '',
      stage: 'saved',
      keySkills: [],
      lastStatusChange: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...data,
    })
  }

  async function updateJob(id, data) {
    await updateDoc(docRef(id), { ...data, updatedAt: serverTimestamp() })
  }

  async function updateStage(id, stage) {
    await updateDoc(docRef(id), {
      stage,
      lastStatusChange: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteJob(id) {
    await deleteDoc(docRef(id))
  }

  return { addJob, updateJob, updateStage, deleteJob }
}
