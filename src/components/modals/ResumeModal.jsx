import { useEffect, useRef, useState } from 'react'
import { X, Upload, FileText, Check } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import './ResumeModal.css'

export default function ResumeModal({ onClose }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid, 'settings', 'preferences')).then(snap => {
      if (snap.exists() && snap.data().resumeText) setText(snap.data().resumeText)
    })
  }, [user.uid])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target.result)
    reader.readAsText(file)
  }

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    await setDoc(
      doc(db, 'users', user.uid, 'settings', 'preferences'),
      { resumeText: text.trim() },
      { merge: true }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 800)
  }

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-box" onClick={e => e.stopPropagation()}>
        <div className="rm-header">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Your Resume</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-3">
            Paste your resume text or upload a <code className="bg-slate-800 px-1 rounded">.txt</code> file.
            Runway uses it to calculate resume match scores for each job.
          </p>

          <button onClick={() => fileRef.current?.click()} className="rm-upload-btn">
            <Upload size={13} /> Upload .txt file
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFile} />

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your resume here..."
            rows={12}
            className="rm-textarea"
          />
          <p className="text-[10px] text-slate-600 mt-1">{text.length.toLocaleString()} characters</p>
        </div>

        <div className="rm-footer">
          <button onClick={onClose} className="rm-cancel-btn">Cancel</button>
          <button onClick={handleSave} disabled={saving || !text.trim()} className="rm-submit-btn">
            {saved ? <><Check size={13} /> Saved!</> : saving ? 'Saving...' : 'Save Resume'}
          </button>
        </div>
      </div>
    </div>
  )
}
