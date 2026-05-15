import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Star, Trash2, Download, Eye, Loader2, Check, Pencil, Sparkles, BarChart2, MousePointerClick } from 'lucide-react'
import { collection, doc, getDocs, getDoc, addDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'
import * as pdfjs from 'pdfjs-dist'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import './ResumePage.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const TECH_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R',
  'React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'Redux', 'HTML', 'CSS', 'Tailwind',
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Rails', 'Laravel', '.NET',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Elasticsearch', 'Cassandra',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux',
  'TensorFlow', 'PyTorch', 'scikit-learn', 'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Tableau', 'Power BI', 'dbt',
  'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'Microservices', 'WebSockets',
  'Git', 'Figma', 'Jira', 'Agile', 'Scrum', 'Looker',
]

function extractSkills(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return TECH_SKILLS.filter(s => lower.includes(s.toLowerCase()))
}

async function extractPDFText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text.trim()
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ResumePage() {
  const { user } = useAuth()
  const { jobs } = useJobs()
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const fileRef = useRef()
  const detailRef = useRef()

  const scoredJobs = jobs.filter(j => j.matchScore != null)
  const avgScore = scoredJobs.length
    ? Math.round(scoredJobs.reduce((s, j) => s + j.matchScore, 0) / scoredJobs.length)
    : null
  const activeJobs = jobs.filter(j => !['rejected', 'withdrawn', 'accepted'].includes(j.stage))

  const selectedResume = resumes.find(r => r.id === selectedId) ?? null

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
      if (list.length > 0) setSelectedId(list.find(r => r.isDefault)?.id ?? list[0].id)
      setLoading(false)
    }
    load()
  }, [user.uid])

  function handleSelectResume(id) {
    setSelectedId(id)
    if (window.innerWidth < 768 && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30)
    }
  }

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return }
    setUploading(true)
    try {
      const [resumeText, pdfBase64] = await Promise.all([extractPDFText(file), fileToBase64(file)])
      const isFirst = resumes.length === 0
      const data = {
        filename: file.name,
        label: file.name.replace(/\.pdf$/i, ''),
        size: file.size,
        uploadedAt: new Date().toISOString(),
        resumeText,
        pdfBase64,
        isDefault: isFirst,
      }
      const newRef = await addDoc(collection(db, 'users', user.uid, 'resumes'), data)
      const newResume = { id: newRef.id, ...data }
      setResumes(prev => [newResume, ...prev])
      setSelectedId(newResume.id)
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleSetDefault(resumeId) {
    const batch = writeBatch(db)
    resumes.forEach(r => batch.update(doc(db, 'users', user.uid, 'resumes', r.id), { isDefault: r.id === resumeId }))
    await batch.commit()
    setResumes(prev => prev.map(r => ({ ...r, isDefault: r.id === resumeId })))
  }

  async function handleDelete(resumeId) {
    if (!confirm('Remove this resume?')) return
    const target = resumes.find(r => r.id === resumeId)
    await deleteDoc(doc(db, 'users', user.uid, 'resumes', resumeId))
    const remaining = resumes.filter(r => r.id !== resumeId)
    if (target?.isDefault && remaining.length > 0) {
      await updateDoc(doc(db, 'users', user.uid, 'resumes', remaining[0].id), { isDefault: true })
      setResumes(remaining.map((r, i) => ({ ...r, isDefault: i === 0 })))
    } else {
      setResumes(remaining)
    }
    setSelectedId(remaining[0]?.id ?? null)
  }

  async function handleUpdateLabel(resumeId, label) {
    await updateDoc(doc(db, 'users', user.uid, 'resumes', resumeId), { label })
    setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, label } : r))
  }

  function handleOpen(resume) {
    const win = window.open()
    win.document.write(`<iframe src="${resume.pdfBase64}" width="100%" height="100%" style="border:none;position:fixed;top:0;left:0" />`)
  }

  function handleDownload(resume) {
    const a = document.createElement('a')
    a.href = resume.pdfBase64
    a.download = resume.filename
    a.click()
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={20} className="text-slate-400 animate-spin" />
    </div>
  )

  return (
    <div className="resume-page">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 mb-1">WORKSPACE &rsaquo; RESUMES</p>
        <h1 className="text-2xl font-bold text-white">Resumes</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your resume library. Click a resume to inspect its skills and stats.</p>
      </div>

      {/* Stats bar */}
      <div className="resume-stats-row">
        <StatCard value={resumes.length} label="Resumes" />
        <StatCard value={activeJobs.length} label="Active applications" />
        <StatCard value={scoredJobs.length} label="Jobs scored" />
        <StatCard
          value={avgScore != null ? `${avgScore}%` : '—'}
          label="Avg match score"
          valueClass={avgScore != null ? (avgScore >= 75 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400') : undefined}
        />
      </div>

      {/* Master-detail layout */}
      <div className="resume-layout">

        {/* LEFT — resume list + upload */}
        <div className="resume-list-col">
          <div className="resume-list-card">
            <div className="resume-list-header">
              <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Library</p>
              <span className="text-xs text-slate-400">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</span>
            </div>

            {resumes.length > 0 && (
              <div className="resume-list-items">
                {resumes.map(resume => (
                  <ResumeListItem
                    key={resume.id}
                    resume={resume}
                    isSelected={selectedId === resume.id}
                    onSelect={() => handleSelectResume(resume.id)}
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
                  <Loader2 size={18} className="text-violet-400 animate-spin" />
                  <p className="text-xs text-slate-400">Extracting text...</p>
                </>
              ) : (
                <>
                  <Upload size={18} className="text-slate-400" />
                  <p className="text-sm font-medium text-slate-300">
                    {resumes.length > 0 ? 'Upload another' : 'Drop your PDF here'}
                  </p>
                  <p className="text-xs text-slate-500">click to browse &middot; PDF only</p>
                </>
              )}
            </div>

            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={e => handleFile(e.target.files?.[0])} />
          </div>
        </div>

        {/* RIGHT — detail panel */}
        <div className="resume-detail-col" ref={detailRef}>
          {selectedResume ? (
            <ResumeDetail
              resume={selectedResume}
              scoredJobs={scoredJobs}
              avgScore={avgScore}
              onOpen={() => handleOpen(selectedResume)}
              onDownload={() => handleDownload(selectedResume)}
              onSetDefault={() => handleSetDefault(selectedResume.id)}
              onDelete={() => handleDelete(selectedResume.id)}
              onUpdateLabel={label => handleUpdateLabel(selectedResume.id, label)}
            />
          ) : (
            <div className="resume-empty-detail">
              <MousePointerClick size={28} className="text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-400">Select a resume to inspect</p>
              <p className="text-xs text-slate-600 mt-1">Skills, word count, and match stats will appear here</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function ResumeListItem({ resume, isSelected, onSelect }) {
  const label = resume.label || resume.filename.replace(/\.pdf$/i, '')
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      onClick={onSelect}
      className={`resume-list-item ${isSelected ? 'resume-list-item-selected' : 'resume-list-item-idle'}`}
    >
      <div className={`resume-list-item-icon ${isSelected ? 'bg-violet-600/30' : 'bg-slate-700'}`}>
        <FileText size={15} className={isSelected ? 'text-violet-300' : 'text-slate-400'} />
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
        <p className="text-xs text-slate-500">{formatBytes(resume.size)} &middot; {uploadedDate}</p>
      </div>
    </button>
  )
}

function ResumeDetail({ resume, scoredJobs, avgScore, onOpen, onDownload, onSetDefault, onDelete, onUpdateLabel }) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')

  const label = resume.label || resume.filename.replace(/\.pdf$/i, '')
  const skills = extractSkills(resume.resumeText || '')
  const wordCount = resume.resumeText ? resume.resumeText.split(/\s+/).filter(Boolean).length : 0
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  function startEdit() { setLabelDraft(label); setEditingLabel(true) }
  function saveLabel() {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== label) onUpdateLabel(trimmed)
    setEditingLabel(false)
  }

  return (
    <div className="resume-detail-card">

      {/* Top: name + actions */}
      <div className="resume-detail-top">
        <div className="resume-detail-icon">
          <FileText size={22} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
              className="resume-label-input-lg"
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold text-white truncate min-w-0">{label}</h2>
              <button onClick={startEdit} className="text-slate-600 hover:text-slate-300 transition-colors shrink-0" title="Rename">
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 min-w-0">
            <span className="text-xs text-slate-400 truncate min-w-0 max-w-full">{resume.filename}</span>
            <span className="text-xs text-slate-500 shrink-0">{formatBytes(resume.size)} &middot; {uploadedDate}</span>
            {resume.isDefault && (
              <span className="resume-default-badge shrink-0">
                <Star size={8} fill="currentColor" /> Default
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="resume-detail-actions">
        <ActionBtn icon={Eye} label="Open" onClick={onOpen} />
        <ActionBtn icon={Download} label="Download" onClick={onDownload} />
        {!resume.isDefault && <ActionBtn icon={Check} label="Set as Default" onClick={onSetDefault} accent />}
        <ActionBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>

      <div className="resume-detail-divider" />

      {/* Stats grid */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-blue-400" />
          <p className="resume-section-title">Stats</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatMini label="Word count" value={wordCount > 0 ? wordCount.toLocaleString() : '—'} />
          <StatMini label="Skills detected" value={skills.length} />
          {resume.isDefault ? (
            <>
              <StatMini label="Jobs scored" value={scoredJobs.length} />
              <StatMini
                label="Avg match score"
                value={avgScore != null ? `${avgScore}%` : '—'}
                valueClass={avgScore != null ? (avgScore >= 75 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400') : undefined}
              />
            </>
          ) : (
            <div className="col-span-2 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400">Set as default to use this resume for AI match scoring and see match stats here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} className="text-violet-400" />
          <p className="resume-section-title">Detected Skills</p>
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{skills.length}</span>
        </div>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <span key={skill} className="resume-skill-tag">{skill}</span>
            ))}
          </div>
        ) : resume.resumeText ? (
          <p className="text-sm text-slate-500">No recognized tech skills found in this resume.</p>
        ) : (
          <p className="text-sm text-slate-500">Text extraction failed — try re-uploading this file.</p>
        )}
      </div>

    </div>
  )
}

function StatCard({ value, label, valueClass }) {
  return (
    <div className="resume-stat-card">
      <p className={`text-xl sm:text-2xl font-bold ${valueClass ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

function StatMini({ label, value, valueClass }) {
  return (
    <div className="resume-stat-mini">
      <p className={`text-lg sm:text-xl font-bold ${valueClass ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, danger, accent }) {
  if (danger) return (
    <button onClick={onClick} className="resume-action-btn-danger"><Icon size={13} />{label}</button>
  )
  if (accent) return (
    <button onClick={onClick} className="resume-action-btn-accent"><Icon size={13} />{label}</button>
  )
  return (
    <button onClick={onClick} className="resume-action-btn"><Icon size={13} />{label}</button>
  )
}
