import {
  addDoc, updateDoc, deleteDoc,
  collection, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/auth'

/**
 * Provides Firestore write helpers for the signed-in user's applications.
 */
export function useJobMutations() {
  const { user } = useAuth()

  function col() {
    return collection(db, 'users', user.uid, 'applications')
  }

  function docRef(id) {
    return doc(db, 'users', user.uid, 'applications', id)
  }

  /** Creates a new application with defaults plus supplied field overrides. */
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

  /** Updates application fields and refreshes the updated timestamp. */
  async function updateJob(id, data) {
    await updateDoc(docRef(id), { ...data, updatedAt: serverTimestamp() })
  }

  /** Moves an application to another pipeline stage and records status-change time. */
  async function updateStage(id, stage) {
    await updateDoc(docRef(id), {
      stage,
      lastStatusChange: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  /** Permanently deletes an application. */
  async function deleteJob(id) {
    await deleteDoc(docRef(id))
  }

  return { addJob, updateJob, updateStage, deleteJob }
}
