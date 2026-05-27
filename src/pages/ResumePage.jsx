import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Star, Trash2, Download, Eye, Loader2, Check, Pencil, Sparkles, BarChart2, MousePointerClick, X, Plus, Briefcase, Code2, GraduationCap, AlignLeft } from 'lucide-react'
import { collection, doc, getDocs, getDoc, addDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'
import * as pdfjs from 'pdfjs-dist'
import { db } from '../lib/firebase'
import { useAuth } from '../context/auth'
import { useJobs } from '../context/jobs'
import { useAI } from '../hooks/useAI'
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

/**
 * Extracts readable text from a PDF resume upload.
 */
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

/**
 * Extracts coarse typography/style data from the uploaded PDF for resume templates.
 */
async function extractStyleMap(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()

    const sizes = content.items
      .filter(item => item.str?.trim())
      .map(item => {
        const size = item.height > 0
          ? item.height
          : Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2)
        return Math.round(size * 10) / 10
      })
      .filter(s => s >= 4 && s <= 36)

    if (sizes.length === 0) return null

    // Find mode (body = most common size)
    const freq = {}
    for (const s of sizes) freq[s] = (freq[s] ?? 0) + 1
    let bodyFontSizePt = parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
    bodyFontSizePt = Math.min(14, Math.max(8, bodyFontSizePt))

    // Heading cluster = items noticeably larger than body
    const headingItems = sizes.filter(s => s >= bodyFontSizePt + 1.5)
    let headingFontSizePt, confident

    if (headingItems.length >= 3) {
      const sorted = [...headingItems].sort((a, b) => a - b)
      headingFontSizePt = sorted[Math.floor(sorted.length / 2)]
      headingFontSizePt = Math.min(20, Math.max(9, headingFontSizePt))
      confident = true
    } else {
      headingFontSizePt = parseFloat((bodyFontSizePt * 1.12).toFixed(1))
      confident = false
    }

    // If all sizes are nearly identical, extraction is unreliable
    const range = Math.max(...sizes) - Math.min(...sizes)
    if (range < 1.5) confident = false

    return { bodyFontSizePt, headingFontSizePt, extractedAt: new Date().toISOString(), confident }
  } catch {
    return null
  }
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

/**
 * Resume library and editor page.
 * Handles uploads, default resume selection, parsing, and structured editing.
 */
export default function ResumePage() {
  const { user } = useAuth()
  const { jobs } = useJobs()
  const { parseResumeStructure } = useAI()
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [parsingId, setParsingId] = useState(null)
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

  async function handleExtractStyle(resumeId, pdfBase64) {
    setParsingId(resumeId)
    try {
      const res = await fetch(pdfBase64)
      const blob = await res.blob()
      const file = new File([blob], 'resume.pdf', { type: 'application/pdf' })
      const styleMap = await extractStyleMap(file)
      if (styleMap) {
        await updateDoc(doc(db, 'users', user.uid, 'resumes', resumeId), { styleMap })
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, styleMap } : r))
      }
    } catch (err) {
      console.error('Style extraction failed:', err)
    } finally {
      setParsingId(null)
    }
  }

  async function handleParseStructure(resumeId, resumeText) {
    setParsingId(resumeId)
    try {
      const result = await parseResumeStructure(resumeText)
      if (result?.parsedStructure) {
        await updateDoc(doc(db, 'users', user.uid, 'resumes', resumeId), { parsedStructure: result.parsedStructure })
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, parsedStructure: result.parsedStructure } : r))
      }
    } catch (err) {
      console.error('Structure parse failed:', err)
    } finally {
      setParsingId(null)
    }
  }

  async function handleUpdateResume(resumeId, updates) {
    await updateDoc(doc(db, 'users', user.uid, 'resumes', resumeId), updates)
    setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, ...updates } : r))
  }

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return }
    setUploading(true)
    let uploadedResume
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
      uploadedResume = { id: newRef.id, text: resumeText }
      setResumes(prev => [newResume, ...prev])
      setSelectedId(newResume.id)
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
      return
    } finally {
      setUploading(false)
    }
    if (uploadedResume) {
      await handleParseStructure(uploadedResume.id, uploadedResume.text)
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Resumes</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your resume library and track match scores.</p>
      </div>

      <div className="resume-stats-row">
        <StatCard value={resumes.length} label="Resumes" icon={FileText} iconColor="text-violet-400" />
        <StatCard value={activeJobs.length} label="Active applications" icon={Briefcase} iconColor="text-blue-400" />
        <StatCard value={scoredJobs.length} label="Jobs scored" icon={BarChart2} iconColor="text-amber-400" />
        <StatCard
          value={avgScore != null ? `${avgScore}%` : '—'}
          label="Avg match score"
          icon={Sparkles}
          iconColor={avgScore != null ? (avgScore >= 75 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400') : 'text-slate-600'}
          valueClass={avgScore != null ? (avgScore >= 75 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400') : undefined}
        />
      </div>

      {/* Library stack */}
      <div className="resume-library-section mb-5">
        <div className="resume-list-header">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Library</p>
          <span className="text-xs text-slate-500">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</span>
        </div>
        {resumes.length > 0 && (
          <div className="resume-list-items">
            {resumes.map(resume => (
              <ResumeLibraryCard
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
              <Loader2 size={16} className="text-violet-400 animate-spin" />
              <p className="text-xs text-slate-400">Uploading...</p>
            </>
          ) : (
            <>
              <div className="resume-upload-icon-wrap">
                <Upload size={13} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                {resumes.length > 0 ? 'Upload another resume' : 'Drop your PDF here'}
              </p>
              <p className="text-xs text-slate-500">click to browse · PDF only</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {/* Detail panel — full width */}
      <div ref={detailRef}>
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
            onUpdate={updates => handleUpdateResume(selectedResume.id, updates)}
            parsingId={parsingId}
            onParseStructure={() => handleParseStructure(selectedResume.id, selectedResume.resumeText)}
            onExtractStyle={() => handleExtractStyle(selectedResume.id, selectedResume.pdfBase64)}
          />
        ) : (
          <div className="resume-empty-detail">
            <div className="resume-empty-icon-wrap">
              <MousePointerClick size={20} className="text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-400 mt-4">Select a resume to inspect</p>
            <p className="text-xs text-slate-600 mt-1">Skills, word count, and match stats will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ResumeLibraryCard({ resume, isSelected, onSelect }) {
  const label = resume.label || resume.filename.replace(/\.pdf$/i, '')
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      onClick={onSelect}
      className={`resume-library-card ${isSelected ? 'resume-library-card-selected' : 'resume-library-card-idle'}`}
    >
      <div className={`resume-list-item-icon ${isSelected ? 'bg-violet-600/30' : 'bg-slate-700/80'}`}>
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
        <p className="text-xs text-slate-500">{formatBytes(resume.size)} · {uploadedDate}</p>
      </div>
    </button>
  )
}

function ResumeDetail({ resume, scoredJobs, avgScore, onOpen, onDownload, onSetDefault, onDelete, onUpdateLabel, onUpdate, parsingId, onParseStructure, onExtractStyle }) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [view, setView] = useState('details')

  const label = resume.label || resume.filename.replace(/\.pdf$/i, '')
  const skills = extractSkills(resume.resumeText || '')
  const wordCount = resume.resumeText ? resume.resumeText.split(/\s+/).filter(Boolean).length : 0
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const isParsingThis = parsingId === resume.id
  const hasStructure = !!resume.parsedStructure

  function startEdit() { setLabelDraft(label); setEditingLabel(true) }
  function saveLabel() {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== label) onUpdateLabel(trimmed)
    setEditingLabel(false)
  }

  return (
    <div className="resume-detail-card">
      <div className="resume-detail-top">
        <div className="resume-detail-icon">
          <FileText size={20} className="text-violet-300" />
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

      <div className="resume-detail-actions">
        <ActionBtn icon={Eye} label="Open" onClick={onOpen} />
        <ActionBtn icon={Download} label="Download" onClick={onDownload} />
        {resume.pdfBase64 && (
          <ActionBtn
            icon={view === 'pdf' ? AlignLeft : FileText}
            label={view === 'pdf' ? 'Details' : 'Preview PDF'}
            onClick={() => setView(v => v === 'pdf' ? 'details' : 'pdf')}
            accent={view === 'pdf'}
          />
        )}
        {!resume.isDefault && <ActionBtn icon={Check} label="Set as Default" onClick={onSetDefault} accent />}
        <span className="flex-1" />
        <ActionBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>

      <div className="resume-detail-divider" />

      {view === 'pdf' && resume.pdfBase64 ? (
        <div className="resume-pdf-preview">
          <iframe
            src={resume.pdfBase64}
            title={resume.filename}
            className="resume-pdf-iframe"
          />
        </div>
      ) : (
        <>
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-blue-400" />
              <p className="resume-section-title">Stats</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

          <div className="resume-detail-divider" />

          {isParsingThis ? (
            <div className="se-loading">
              <Loader2 size={16} className="animate-spin text-violet-400" />
              <span className="text-sm text-slate-400">Parsing resume structure...</span>
            </div>
          ) : hasStructure ? (
            <StructuredEditor resume={resume} onUpdate={onUpdate} />
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-violet-400" />
                <p className="resume-section-title">Detected Skills</p>
                <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{skills.length}</span>
              </div>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {skills.map(skill => (
                    <span key={skill} className="resume-skill-tag">{skill}</span>
                  ))}
                </div>
              ) : resume.resumeText ? (
                <p className="text-sm text-slate-500 mb-4">No recognized tech skills found in this resume.</p>
              ) : (
                <p className="text-sm text-slate-500 mb-4">Text extraction failed — try re-uploading this file.</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onParseStructure} className="se-parse-btn">
                  <Sparkles size={13} /> Parse Structure
                </button>
                {resume.pdfBase64 && !resume.styleMap && (
                  <button onClick={onExtractStyle} className="se-parse-btn" title="Extract font sizes from your PDF to enable the Original resume template">
                    <Sparkles size={13} /> Extract PDF Style
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── StructuredEditor ──────────────────────────────────────────────────────────

function StructuredEditor({ resume, onUpdate }) {
  const s = resume.parsedStructure
  if (!s) return null

  function save(newStructure) {
    onUpdate({ parsedStructure: newStructure })
  }

  return (
    <div className="structured-editor">
      {s.summary?.sentences?.length > 0 && (
        <EditorSection title="Summary" icon={<AlignLeft size={13} />}>
          <SummaryEditor
            sentences={s.summary.sentences}
            onChange={sentences => save({ ...s, summary: { ...s.summary, sentences } })}
          />
        </EditorSection>
      )}

      {s.skills?.length > 0 && (
        <EditorSection title="Skills" icon={<Sparkles size={13} />}>
          <SkillsEditor
            groups={s.skills}
            onChange={skills => save({ ...s, skills })}
          />
        </EditorSection>
      )}

      <EditorSection title="Experience" icon={<Briefcase size={13} />}>
        <BulletEditor
          entries={s.experience ?? []}
          getTitle={e => e.role}
          getSubtitle={e => e.company}
          getDates={e => e.dates}
          setTitle={(e, v) => ({ ...e, role: v })}
          setSubtitle={(e, v) => ({ ...e, company: v })}
          setDates={(e, v) => ({ ...e, dates: v })}
          entryTemplate={() => ({ role: '', company: '', dates: '', bullets: [] })}
          onChange={experience => save({ ...s, experience })}
        />
      </EditorSection>

      <EditorSection title="Projects" icon={<Code2 size={13} />}>
        <BulletEditor
          entries={s.projects ?? []}
          getTitle={e => e.name}
          getSubtitle={() => null}
          getDates={e => e.dates}
          setTitle={(e, v) => ({ ...e, name: v })}
          setDates={(e, v) => ({ ...e, dates: v })}
          entryTemplate={() => ({ name: '', dates: '', bullets: [] })}
          onChange={projects => save({ ...s, projects })}
        />
      </EditorSection>

      <EditorSection title="Education" icon={<GraduationCap size={13} />}>
        <EducationEditor
          entries={s.education ?? []}
          onChange={education => save({ ...s, education })}
        />
      </EditorSection>
    </div>
  )
}

function EditorSection({ title, icon, children }) {
  return (
    <div className="se-section">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-violet-400">{icon}</span>
        <p className="resume-section-title">{title}</p>
      </div>
      {children}
    </div>
  )
}

function SummaryEditor({ sentences, onChange }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [draft, setDraft] = useState('')

  function startEdit(i) { setEditingIndex(i); setDraft(sentences[i]) }
  function save() {
    if (editingIndex == null) return
    const trimmed = draft.trim()
    if (trimmed) onChange(sentences.map((s, i) => i === editingIndex ? trimmed : s))
    setEditingIndex(null)
  }

  return (
    <div className="se-summary">
      {sentences.map((s, i) => (
        <div key={i} className="se-bullet-row">
          {editingIndex === i ? (
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={e => { if (e.key === 'Escape') setEditingIndex(null) }}
              className="se-bullet-textarea"
              rows={2}
            />
          ) : (
            <div className="se-bullet-text" onClick={() => startEdit(i)}>
              <span className="se-bullet-content">{s}</span>
              <Pencil size={10} className="se-bullet-pencil" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SkillsEditor({ groups, onChange }) {
  const [addingGroup, setAddingGroup] = useState(null)
  const [addDraft, setAddDraft] = useState('')

  function removeSkill(gi, si) {
    onChange(groups.map((g, i) => i === gi
      ? { ...g, items: g.items.filter((_, j) => j !== si) }
      : g))
  }

  function confirmAdd(gi) {
    const trimmed = addDraft.trim()
    if (trimmed) {
      onChange(groups.map((g, i) => i === gi ? { ...g, items: [...g.items, trimmed] } : g))
    }
    setAddDraft('')
    setAddingGroup(null)
  }

  return (
    <div className="se-skills">
      {groups.map((group, gi) => (
        <div key={gi} className="se-skill-group">
          <p className="se-skill-label">{group.label}</p>
          <div className="se-skill-chips">
            {group.items.map((skill, si) => (
              <span key={si} className="se-chip">
                {skill}
                <button onClick={() => removeSkill(gi, si)} className="se-chip-remove">
                  <X size={10} />
                </button>
              </span>
            ))}
            {addingGroup === gi ? (
              <input
                autoFocus
                value={addDraft}
                onChange={e => setAddDraft(e.target.value)}
                onBlur={() => confirmAdd(gi)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmAdd(gi)
                  if (e.key === 'Escape') { setAddingGroup(null); setAddDraft('') }
                }}
                className="se-chip-input"
                placeholder="skill name"
              />
            ) : (
              <button onClick={() => setAddingGroup(gi)} className="se-chip-add">
                <Plus size={10} /> Add
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function BulletEditor({ entries, getTitle, getSubtitle, getDates, onChange, setTitle, setSubtitle, setDates, entryTemplate }) {
  const [editKey, setEditKey] = useState(null)
  const [draft, setDraft] = useState('')
  const [addingBulletEi, setAddingBulletEi] = useState(null)
  const [addingBulletDraft, setAddingBulletDraft] = useState('')

  function startEdit(key, value) { setEditKey(key); setDraft(value ?? '') }

  function saveHeaderField(ei, setter) {
    const trimmed = draft.trim()
    if (trimmed) onChange(entries.map((e, i) => i === ei ? setter(e, trimmed) : e))
    setEditKey(null)
  }

  function saveBullet(ei, bi) {
    const trimmed = draft.trim()
    if (trimmed) {
      onChange(entries.map((e, i) => i === ei
        ? { ...e, bullets: e.bullets.map((b, j) => j === bi ? trimmed : b) }
        : e))
    }
    setEditKey(null)
  }

  function deleteBullet(ei, bi) {
    onChange(entries.map((e, i) => i === ei ? { ...e, bullets: e.bullets.filter((_, j) => j !== bi) } : e))
  }

  function commitNewBullet(ei) {
    const trimmed = addingBulletDraft.trim()
    if (trimmed) onChange(entries.map((e, i) => i === ei ? { ...e, bullets: [...e.bullets, trimmed] } : e))
    setAddingBulletEi(null)
    setAddingBulletDraft('')
  }

  return (
    <div className="se-exp">
      {entries.map((entry, ei) => {
        const title = getTitle(entry)
        const subtitle = getSubtitle(entry)
        const dates = getDates(entry)

        return (
          <div key={ei} className="se-exp-entry">
            <div className="se-exp-header-row">
              <div className="se-exp-header flex-1 min-w-0">
                {editKey === `${ei}-title` ? (
                  <input autoFocus value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => saveHeaderField(ei, setTitle)}
                    onKeyDown={e => { if (e.key === 'Enter') saveHeaderField(ei, setTitle); if (e.key === 'Escape') setEditKey(null) }}
                    className="se-header-input-role"
                  />
                ) : (
                  <span className={`se-exp-role${setTitle ? ' cursor-text' : ''}`}
                    onClick={setTitle ? () => startEdit(`${ei}-title`, title) : undefined}>
                    {title || <span className="text-slate-600 italic font-normal text-[11px]">Role</span>}
                  </span>
                )}

                {(setSubtitle || subtitle !== null) && (
                  <>
                    <span className="se-exp-company"> · </span>
                    {setSubtitle ? (
                      editKey === `${ei}-subtitle` ? (
                        <input autoFocus value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={() => saveHeaderField(ei, setSubtitle)}
                          onKeyDown={e => { if (e.key === 'Enter') saveHeaderField(ei, setSubtitle); if (e.key === 'Escape') setEditKey(null) }}
                          className="se-header-input-company"
                        />
                      ) : (
                        <span className="se-exp-company cursor-text"
                          onClick={() => startEdit(`${ei}-subtitle`, subtitle || '')}>
                          {subtitle || <span className="text-slate-600 italic text-[11px]">Company</span>}
                        </span>
                      )
                    ) : (
                      <span className="se-exp-company">{subtitle}</span>
                    )}
                  </>
                )}

                {setDates ? (
                  editKey === `${ei}-dates` ? (
                    <input autoFocus value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => saveHeaderField(ei, setDates)}
                      onKeyDown={e => { if (e.key === 'Enter') saveHeaderField(ei, setDates); if (e.key === 'Escape') setEditKey(null) }}
                      className="se-header-input-dates"
                    />
                  ) : (
                    <span className="se-exp-dates cursor-text"
                      onClick={() => startEdit(`${ei}-dates`, dates || '')}>
                      {dates || <span className="text-slate-600 italic text-[10px]">Dates</span>}
                    </span>
                  )
                ) : (
                  dates && <span className="se-exp-dates">{dates}</span>
                )}
              </div>
              <button onClick={() => onChange(entries.filter((_, i) => i !== ei))} className="se-entry-delete" title="Delete entry">
                <Trash2 size={11} />
              </button>
            </div>

            <div className="se-bullets">
              {entry.bullets.map((bullet, bi) => {
                const bKey = `${ei}-${bi}`
                return (
                  <div key={bi} className="se-bullet-row">
                    {editKey === bKey ? (
                      <textarea autoFocus value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => saveBullet(ei, bi)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditKey(null) }}
                        className="se-bullet-textarea"
                        rows={2}
                      />
                    ) : (
                      <div className="se-bullet-text" onClick={() => startEdit(bKey, bullet)}>
                        <span className="se-bullet-dot">·</span>
                        <span className="se-bullet-content">{bullet}</span>
                        <div className="se-bullet-actions">
                          <Pencil size={10} className="se-bullet-pencil" />
                          <button onClick={e => { e.stopPropagation(); deleteBullet(ei, bi) }}
                            className="se-bullet-delete-btn" title="Delete bullet">
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {addingBulletEi === ei ? (
                <div className="se-bullet-row">
                  <textarea autoFocus value={addingBulletDraft}
                    onChange={e => setAddingBulletDraft(e.target.value)}
                    onBlur={() => commitNewBullet(ei)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNewBullet(ei) }
                      if (e.key === 'Escape') { setAddingBulletEi(null); setAddingBulletDraft('') }
                    }}
                    className="se-bullet-textarea"
                    rows={2}
                    placeholder="New bullet point..."
                  />
                </div>
              ) : (
                <button onClick={() => setAddingBulletEi(ei)} className="se-add-bullet-btn">
                  <Plus size={10} /> Add bullet
                </button>
              )}
            </div>
          </div>
        )
      })}
      {entryTemplate && (
        <button onClick={() => onChange([...entries, entryTemplate()])} className="se-add-entry-btn">
          <Plus size={11} /> Add entry
        </button>
      )}
    </div>
  )
}

function EducationEditor({ entries, onChange }) {
  const [editKey, setEditKey] = useState(null)
  const [draft, setDraft] = useState('')

  function startEdit(key, value) { setEditKey(key); setDraft(value ?? '') }

  function saveField(ei, field) {
    const trimmed = draft.trim()
    onChange(entries.map((e, i) => i === ei ? { ...e, [field]: trimmed } : e))
    setEditKey(null)
  }

  function renderField(ei, field, value, className, inputClass, placeholder) {
    const key = `${ei}-${field}`
    if (editKey === key) {
      return (
        <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => saveField(ei, field)}
          onKeyDown={e => { if (e.key === 'Enter') saveField(ei, field); if (e.key === 'Escape') setEditKey(null) }}
          className={inputClass}
        />
      )
    }
    return (
      <span className={`${className} cursor-text`} onClick={() => startEdit(key, value)}>
        {value || <span className="text-slate-600 italic text-[11px]">{placeholder}</span>}
      </span>
    )
  }

  return (
    <div className="se-edu">
      {entries.map((entry, ei) => (
        <div key={ei} className="se-edu-entry">
          <div className="se-exp-header-row">
            <div className="se-exp-header flex-1 min-w-0">
              {renderField(ei, 'degree', entry.degree, 'se-exp-role', 'se-header-input-role', 'Degree')}
              <span className="se-exp-company"> · </span>
              {renderField(ei, 'school', entry.school, 'se-exp-company', 'se-header-input-company', 'School')}
              {renderField(ei, 'dates', entry.dates, 'se-exp-dates', 'se-header-input-dates', 'Dates')}
            </div>
            <button onClick={() => onChange(entries.filter((_, i) => i !== ei))} className="se-entry-delete" title="Delete entry">
              <Trash2 size={11} />
            </button>
          </div>
          <div className="mt-0.5">
            {renderField(ei, 'location', entry.location, 'text-[11px] text-slate-500', 'se-header-input-location', 'Location (optional)')}
          </div>
        </div>
      ))}
      <button
        onClick={() => onChange([...entries, { degree: '', school: '', dates: '', location: '' }])}
        className="se-add-entry-btn"
      >
        <Plus size={11} /> Add education
      </button>
    </div>
  )
}

// ── Shared small components ───────────────────────────────────────────────────

function StatCard({ value, label, valueClass, icon: Icon, iconColor }) {
  return (
    <div className="resume-stat-card">
      {Icon && <Icon size={14} className={`mb-2.5 ${iconColor ?? 'text-slate-500'}`} />}
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
