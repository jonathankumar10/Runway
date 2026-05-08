import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Star, Trash2, Download, Eye, Loader2, Check } from 'lucide-react'
import { collection, doc, getDocs, getDoc, addDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'
import * as pdfjs from 'pdfjs-dist'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import './ResumePage.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

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
      setResumes(list)
      setLoading(false)
    }
    load()
  }, [user.uid])

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file.')
      return
    }
    setUploading(true)
    try {
      const [resumeText, pdfBase64] = await Promise.all([
        extractPDFText(file),
        fileToBase64(file),
      ])
      const isFirst = resumes.length === 0
      const data = {
        filename: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        resumeText,
        pdfBase64,
        isDefault: isFirst,
      }
      const newRef = await addDoc(collection(db, 'users', user.uid, 'resumes'), data)
      setResumes(prev => [{ id: newRef.id, ...data }, ...prev])
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleSetDefault(resumeId) {
    const batch = writeBatch(db)
    resumes.forEach(r => {
      batch.update(doc(db, 'users', user.uid, 'resumes', r.id), { isDefault: r.id === resumeId })
    })
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
      <Loader2 size={20} className="text-slate-500 animate-spin" />
    </div>
  )

  return (
    <div className="resume-page">
      <p className="text-xs text-slate-500 mb-1">WORKSPACE &rsaquo; RESUMES</p>
      <h1 className="text-2xl font-bold text-white">Resumes</h1>
      <p className="text-sm text-slate-400 mt-1 mb-8">Manage your resume library</p>

      <div className="resume-library-card">
        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Resume Library</p>
        <h2 className="text-xl font-bold text-white mb-1">Upload and manage your resumes</h2>
        <p className="text-sm text-slate-400 mb-6">
          Store multiple PDF resumes here. The <span className="text-yellow-400 font-medium">Default</span> resume is used for AI match scoring.
        </p>

        {resumes.length > 0 && (
          <div className="space-y-3 mb-6">
            {resumes.map(resume => (
              <ResumeRow
                key={resume.id}
                resume={resume}
                onOpen={() => handleOpen(resume)}
                onDownload={() => handleDownload(resume)}
                onSetDefault={() => handleSetDefault(resume.id)}
                onDelete={() => handleDelete(resume.id)}
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
              <Loader2 size={20} className="text-violet-400 animate-spin" />
              <p className="text-sm text-slate-400">Extracting text from PDF...</p>
            </>
          ) : (
            <>
              <Upload size={20} className="text-slate-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                  {resumes.length > 0 ? 'Upload another resume' : 'Drop your PDF here'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">or click to browse &middot; .pdf only</p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

function ResumeRow({ resume, onOpen, onDownload, onSetDefault, onDelete }) {
  const uploadedDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className={`resume-row ${resume.isDefault ? 'resume-row-default' : 'resume-row-normal'}`}>
      <div className="resume-row-icon">
        <FileText size={18} className="text-violet-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white truncate">{resume.filename}</p>
          {resume.isDefault && (
            <span className="resume-default-badge">
              <Star size={9} fill="currentColor" /> Default
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {formatBytes(resume.size)} &middot; Uploaded {uploadedDate}
          {resume.resumeText && <span className="ml-2 text-green-400">&middot; Text extracted ✓</span>}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <ActionBtn icon={Eye} label="Open" onClick={onOpen} />
        <ActionBtn icon={Download} label="Download" onClick={onDownload} />
        {!resume.isDefault && <ActionBtn icon={Check} label="Set Default" onClick={onSetDefault} />}
        <ActionBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={danger ? 'resume-action-btn-danger' : 'resume-action-btn'}>
      <Icon size={12} />
      {label}
    </button>
  )
}
