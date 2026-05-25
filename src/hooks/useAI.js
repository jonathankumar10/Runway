import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, getDoc, getDocs, collection, query, where, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import app from '../lib/firebase'

const functions = getFunctions(app)

export function useAI() {
  const { user } = useAuth()

  async function parseJD(text) {
    const fn = httpsCallable(functions, 'parseJD')
    const result = await fn({ text })
    return result.data
  }

  async function getCoaching(stage, company, role) {
    const fn = httpsCallable(functions, 'getCoaching')
    const result = await fn({ stage, company, role })
    return result.data
  }

  async function draftFollowUp(payload) {
    const fn = httpsCallable(functions, 'draftFollowUp')
    const result = await fn(payload)
    return result.data
  }

  async function matchResume(jobId, company, role, keySkills, notes) {
    // Read default resume from new resumes subcollection
    const resumesSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'resumes'), where('isDefault', '==', true), limit(1))
    )
    let resumeText = resumesSnap.docs[0]?.data()?.resumeText

    // Fall back to legacy settings/resume and settings/preferences docs
    if (!resumeText) {
      resumeText = (await getDoc(doc(db, 'users', user.uid, 'settings', 'resume'))).data()?.resumeText
        ?? (await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'))).data()?.resumeText
    }

    if (!resumeText) throw new Error('No resume saved. Add your resume from the Resumes page first.')

    const fn = httpsCallable(functions, 'matchResume')
    const result = await fn({ resumeText, company, role, keySkills, notes })
    return result.data
  }

  async function importFromUrl(url) {
    const fn = httpsCallable(functions, 'importFromUrl')
    const result = await fn({ url })
    return result.data
  }

  async function parseResumeStructure(resumeText) {
    const fn = httpsCallable(functions, 'parseResumeStructure', { timeout: 60000 })
    const result = await fn({ resumeText })
    return result.data
  }

  async function tailorResume(company, role, jobDescription, keySkills, gaps) {
    const resumesSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'resumes'), where('isDefault', '==', true), limit(1))
    )
    const resumeDoc = resumesSnap.docs[0]
    let resumeText = resumeDoc?.data()?.resumeText
    const parsedStructure = resumeDoc?.data()?.parsedStructure ?? null
    const styleMap = resumeDoc?.data()?.styleMap ?? null

    if (!resumeText) {
      resumeText = (await getDoc(doc(db, 'users', user.uid, 'settings', 'resume'))).data()?.resumeText
        ?? (await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'))).data()?.resumeText
    }

    if (!resumeText) throw new Error('No resume saved. Add your resume from the Resumes page first.')

    const sectionOrder = resumeText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2 && l === l.toUpperCase() && /[A-Z]/.test(l) && !/^\d/.test(l) && !/[|@]/.test(l))

    const fn = httpsCallable(functions, 'tailorResume', { timeout: 120000 })
    const result = await fn({ resumeText, company, role, jobDescription, keySkills, gaps, sectionOrder, parsedStructure })
    return { ...result.data, styleMap }
  }

  async function findRecruiter(domain) {
    const fn = httpsCallable(functions, 'findRecruiter')
    const result = await fn({ domain })
    return result.data
  }

  async function draftRecruiterOutreach(payload) {
    const fn = httpsCallable(functions, 'draftRecruiterOutreach')
    const result = await fn(payload)
    return result.data
  }

  return { parseJD, getCoaching, draftFollowUp, matchResume, importFromUrl, tailorResume, findRecruiter, draftRecruiterOutreach, parseResumeStructure }
}
