import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Star, Loader2 } from 'lucide-react'
import { collection, doc, getDoc, getDocs, addDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/auth'
import { useJobs } from '../context/jobs'
import { useAI } from '../hooks/useAI'
import { extractPDFText, extractStyleMap, extractSkills, fileToBase64, formatBytes } from '../lib/resumeUtils'
import './ResumePage.css'

export default function ResumePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { jobs } = useJobs()
  const { parseResumeStructure } = useAI()

  const scoredJobs = jobs.filter(j => j.matchScore != null)
  const avgScore = scoredJobs.length
    ? Math.round(scoredJobs.reduce((s, j) => s + j.matchScore, 0) / scoredJobs.length)
    : null
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'users', user.uid, 'resumes'))
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (list.length === 0) {
        const legacySnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'resume'))
        if (legacySnap.exists()) {
          const legacy = legacySnap.data()
          const newRef = await addDoc(collection(db, 'users', user.uid, 'resumes'), {
            filename: legacy.filename ?? 'resume.pdf',
            label: legacy.filename?.replace(/\.pdf$/i, '') ?? 'resume',
            size: legacy.size ?? 0,
            uploadedAt: legacy.uploadedAt ?? new Date().toISOString(),
            resumeText: legacy.resumeText ?? '',
            pdfBase64: legacy.pdfBase64 ?? '',
            isDefault: true,
          })
          list = [{ id: newRef.id, ...legacySnap.data(), isDefault: true }]
        }
      }

      list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))

      const defaults = list.filter(r => r.isDefault)
      if (defaults.length !== 1 && list.length > 0) {
        const defaultId = defaults.length > 1 ? defaults[0].id : list[0].id
        const batch = writeBatch(db)
        list.forEach(r => batch.update(doc(db, 'users', user.uid, 'resumes', r.id), { isDefault: r.id === defaultId }))
        await batch.commit()
        list = list.map(r => ({ ...r, isDefault: r.id === defaultId }))
      }

      setResumes(list)
      setLoading(false)
    }
    load()
  }, [user.uid])

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return }
    setUploading(true)
    let newResumeId
    try {
      const [resumeText, pdfBase64, styleMap] = await Promise.all([
        extractPDFText(file),
        fileToBase64(file),
        extractStyleMap(file),
      ])
      const isFirst = resumes.length === 0
      const data = {
        filename: file.name,
        label: file.name.replace(/\.pdf$/i, ''),
        size: file.size,
        uploadedAt: new Date().toISOString(),
        resumeText,
        pdfBase64,
        isDefault: isFirst,
        ...(styleMap ? { styleMap } : {}),
      }
      const newRef = await addDoc(collection(db, 'users', user.uid, 'resumes'), data)
      const newResume = { id: newRef.id, ...data }
      newResumeId = newRef.id
      setResumes(prev => [newResume, ...prev])
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
      return
    } finally {
      setUploading(false)
    }
    if (newResumeId) {
      try {
        const resume = resumes.find(r => r.id === newResumeId) ?? resumes[0]
        const result = await parseResumeStructure(resume?.resumeText ?? '')
        if (result?.parsedStructure) {
          const { updateDoc } = await import('firebase/firestore')
          await updateDoc(doc(db, 'users', user.uid, 'resumes', newResumeId), { parsedStructure: result.parsedStructure })
          setResumes(prev => prev.map(r => r.id === newResumeId ? { ...r, parsedStructure: result.parsedStructure } : r))
        }
      } catch {}
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={20} className="text-zinc-400 animate-spin" />
    </div>
  )

  return (
    <div className="resume-page">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Resumes</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your resume library and track match scores.</p>
      </div>

      <div className="resume-library-section mb-5">
        <div className="resume-list-header">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Library</p>
          <span className="text-xs text-zinc-500">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</span>
        </div>
        {resumes.length > 0 && (
          <div className="resume-list-items">
            {resumes.map(resume => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                avgScore={resume.isDefault ? avgScore : null}
                scoredJobsCount={resume.isDefault ? scoredJobs.length : null}
                onClick={() => navigate(`/resumes/${resume.id}`)}
              />
            ))}
          </div>
        )}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`resume-upload-zone ${dragOver ? 'resume-upload-zone-drag' : 'resume-upload-zone-idle'}`}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="text-blue-400 animate-spin" />
              <p className="text-xs text-zinc-400">Uploading...</p>
            </>
          ) : (
            <>
              <div className="resume-upload-icon-wrap">
                <Upload size={13} className="text-blue-400" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {resumes.length > 0 ? 'Upload another resume' : 'Drop your PDF here'}
              </p>
              <p className="text-xs text-zinc-500">click to browse · PDF only</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>
    </div>
  )
}

function ResumeCard({ resume, avgScore, scoredJobsCount, onClick }) {
  const label = resume.label || resume.filename.replace(/\.pdf$/i, '')
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const wordCount = resume.resumeText
    ? resume.resumeText.split(/\s+/).filter(Boolean).length
    : null
  const skillCount = extractSkills(resume.resumeText || '').length

  const scoreColor = avgScore != null
    ? avgScore >= 75 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'
    : ''

  return (
    <button onClick={onClick} className="resume-library-card resume-library-card-idle">
      <div className="resume-list-item-icon bg-zinc-700/80">
        <FileText size={15} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
          <span className="text-sm font-medium text-white truncate min-w-0">{label}</span>
          {resume.isDefault && (
            <span className="resume-default-badge shrink-0">
              <Star size={8} fill="currentColor" /> Default
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mb-1">{formatBytes(resume.size)} · {uploadedDate}</p>
        <div className="resume-card-stats">
          {wordCount != null && <span className="resume-card-stat">{wordCount.toLocaleString()} words</span>}
          {skillCount > 0 && <span className="resume-card-stat">{skillCount} skills</span>}
          {avgScore != null && (
            <span className={`resume-card-stat font-medium ${scoreColor}`}>
              {avgScore}% avg match
            </span>
          )}
          {scoredJobsCount != null && scoredJobsCount > 0 && (
            <span className="resume-card-stat">{scoredJobsCount} jobs scored</span>
          )}
        </div>
      </div>
    </button>
  )
}

