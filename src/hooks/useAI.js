import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, getDoc, getDocs, collection, query, where, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/auth'
import app from '../lib/firebase'

const functions = getFunctions(app)

/**
 * Wraps Firebase callable functions behind domain-specific methods.
 * Pages should call this hook instead of constructing callable functions directly.
 */
export function useAI() {
  const { user } = useAuth()

  /** Parses raw job-description text into structured fields. */
  async function parseJD(text) {
    const fn = httpsCallable(functions, 'parseJD')
    const result = await fn({ text })
    return result.data
  }

  /** Gets stage-specific coaching tips for an application. */
  async function getCoaching(stage, company, role) {
    const fn = httpsCallable(functions, 'getCoaching')
    const result = await fn({ stage, company, role })
    return result.data
  }

  /** Drafts an application follow-up message from job/recruiter context. */
  async function draftFollowUp(payload) {
    const fn = httpsCallable(functions, 'draftFollowUp')
    const result = await fn(payload)
    return result.data
  }

  /** Scores an already-tailored resume against the target job. */
  async function matchTailoredResume(resumeText, company, role, keySkills, notes) {
    if (!resumeText) throw new Error('No tailored resume text found for this application.')
    const fn = httpsCallable(functions, 'matchResume')
    const result = await fn({ resumeText, company, role, keySkills, notes })
    return result.data
  }

  /** Scores the user's default resume against a job and returns match analysis. */
  async function matchResume(jobId, company, role, keySkills, notes) {
    const resumesSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'resumes'), where('isDefault', '==', true), limit(1))
    )
    let resumeText = resumesSnap.docs[0]?.data()?.resumeText

    if (!resumeText) {
      resumeText = (await getDoc(doc(db, 'users', user.uid, 'settings', 'resume'))).data()?.resumeText
        ?? (await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'))).data()?.resumeText
    }

    if (!resumeText) throw new Error('No resume saved. Add your resume from the Resumes page first.')

    const fn = httpsCallable(functions, 'matchResume')
    const result = await fn({ resumeText, company, role, keySkills, notes })
    return result.data
  }

  /** Imports job-posting details from a supported public URL. */
  async function importFromUrl(url) {
    const fn = httpsCallable(functions, 'importFromUrl')
    const result = await fn({ url })
    return result.data
  }

  /** Converts resume text into editable structured sections. */
  async function parseResumeStructure(resumeText) {
    const fn = httpsCallable(functions, 'parseResumeStructure', { timeout: 60000 })
    const result = await fn({ resumeText })
    return result.data
  }

  /** Creates a tailored resume draft using the default resume and job context. */
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

  /** Finds recruiter contacts for a company domain. */
  async function findRecruiter(domain) {
    const fn = httpsCallable(functions, 'findRecruiter')
    const result = await fn({ domain })
    return result.data
  }

  /** Drafts recruiter outreach copy for a selected recruiter/job pair. */
  async function draftRecruiterOutreach(payload) {
    const fn = httpsCallable(functions, 'draftRecruiterOutreach')
    const result = await fn(payload)
    return result.data
  }

  /** Searches job listings with keyword + NA region filters. */
  async function searchJobs({ keyword, city, country, workplaceTypes, employmentTypes, willingToSponsor, postedDate, page }) {
    const fn = httpsCallable(functions, 'searchJobs', { timeout: 30000 })
    const result = await fn({ keyword, city, country, workplaceTypes, employmentTypes, willingToSponsor, postedDate, page })
    return result.data
  }

  return { parseJD, getCoaching, draftFollowUp, matchResume, matchTailoredResume, importFromUrl, tailorResume, findRecruiter, draftRecruiterOutreach, parseResumeStructure, searchJobs }
}
