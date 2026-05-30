import { useState } from 'react'
import { X, Zap, Loader2, User, FileText, LayoutGrid } from 'lucide-react'
import { STAGES } from '../../constants/stages'
import { useJobMutations } from '../../hooks/useJobMutations'
import { useJobImport } from '../../hooks/useJobImport'
import './ApplicationModal.css'

const EMPTY = {
  company: '', role: '', jobUrl: '', location: '', stage: 'saved',
  salaryMin: '', salaryMax: '', dateApplied: '', source: '',
  nextStep: '', jobDescription: '',
  recruiterName: '', recruiterEmail: '', recruiterLinkedIn: '',
  notes: '',
}

const SOURCES = ['', 'LinkedIn', 'Indeed', 'Glassdoor', 'Company Website', 'Referral', 'Recruiter', 'Other']

function toForm(job) {
  if (!job) return EMPTY
  return {
    company: job.company ?? '',
    role: job.role ?? '',
    jobUrl: job.jobUrl ?? '',
    location: job.location ?? '',
    stage: job.stage ?? 'saved',
    salaryMin: job.salaryMin ?? '',
    salaryMax: job.salaryMax ?? '',
    dateApplied: job.dateApplied?.toDate ? job.dateApplied.toDate().toISOString().slice(0, 10) : '',
    source: job.source ?? '',
    nextStep: job.nextStep ?? '',
    jobDescription: job.jobDescription ?? '',
    recruiterName: job.recruiterName ?? '',
    recruiterEmail: job.recruiterEmail ?? '',
    recruiterLinkedIn: job.recruiterLinkedIn ?? '',
    notes: job.notes ?? '',
  }
}

const TABS = [
  { id: 'basics', label: 'Basics', icon: LayoutGrid },
  { id: 'contact', label: 'Contact', icon: User },
  { id: 'notes', label: 'Notes', icon: FileText },
]

/**
 * Modal for creating, editing, or importing a single application.
 */
export default function ApplicationModal({ job, onClose, defaultStage }) {
  const [form, setForm] = useState(() => {
    const base = toForm(job)
    return defaultStage && !job ? { ...base, stage: defaultStage } : base
  })
  const [tab, setTab] = useState('basics')
  const [saving, setSaving] = useState(false)
  const [importUrl, setImportUrl] = useState(job?.jobUrl ?? '')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [imported, setImported] = useState(false)
  const { addJob, updateJob } = useJobMutations()
  const { importJobFromUrl } = useJobImport()

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAutoImport() {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError(null)
    setImported(false)
    try {
      const result = await importJobFromUrl(importUrl)
      if (!result.success) throw new Error(result.errorMessage)
      const { fields } = result
      setForm(f => ({
        ...f,
        company: fields.company || f.company,
        role: fields.role || f.role,
        location: fields.location || f.location,
        salaryMin: fields.salaryMin ?? f.salaryMin,
        salaryMax: fields.salaryMax ?? f.salaryMax,
        jobUrl: result.sourceUrl,
        jobDescription: fields.jobDescription || f.jobDescription,
      }))
      setImported(true)
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...form,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        dateApplied: form.dateApplied ? new Date(form.dateApplied) : null,
        logoUrl: form.company
          ? `https://www.google.com/s2/favicons?sz=64&domain=${form.company.toLowerCase().replace(/\s+/g, '')}.com`
          : null,
      }
      if (job) await updateJob(job.id, data)
      else await addJob(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <div className="modal-header-icon">
              <span className="text-blue-400 text-sm font-bold">+</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{job ? 'Edit Application' : 'Single Import'}</h2>
              <p className="text-xs text-zinc-500">
                {job ? 'Update this job opportunity' : 'Paste one job URL or enter details manually'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors mt-0.5">
            <X size={17} />
          </button>
        </div>

        <div className="modal-import-bar">
          <div className="flex items-center gap-2 mb-2">
            <div className="modal-import-icon">
              <Zap size={12} className="text-blue-400" />
            </div>
            <span className="text-[11px] font-bold text-blue-400 tracking-wide uppercase">Single URL Import</span>
            {imported && (
              <span className="ml-auto text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✓ Fields filled</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={e => { setImportUrl(e.target.value); setImportError(null); setImported(false) }}
              onKeyDown={e => e.key === 'Enter' && handleAutoImport()}
              placeholder="Paste one job URL..."
              className="modal-input flex-1"
            />
            <button
              type="button"
              onClick={handleAutoImport}
              disabled={importing || !importUrl.trim()}
              className="modal-import-btn"
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {importing ? 'Importing...' : 'Import URL'}
            </button>
          </div>
          {importError && <p className="text-[11px] text-red-400 mt-1.5">{importError}</p>}
        </div>

        <div className="flex gap-1 px-5 mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`modal-tab ${tab === t.id ? 'modal-tab-active' : 'modal-tab-inactive'}`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 overflow-y-auto max-h-[48vh]">

            {tab === 'basics' && (
              <div className="space-y-3 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Company *" value={form.company} onChange={v => set('company', v)} placeholder="e.g. Google" required />
                  <Field label="Job Title *" value={form.role} onChange={v => set('role', v)} placeholder="e.g. Software Engineer" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField label="Status" value={form.stage} onChange={v => set('stage', v)}>
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </SelectField>
                  <Field label="Location" value={form.location} onChange={v => set('location', v)} placeholder="e.g. Remote" />
                </div>
                <Field label="Job URL" value={form.jobUrl} onChange={v => set('jobUrl', v)} placeholder="https://..." type="url" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Applied Date" value={form.dateApplied} onChange={v => set('dateApplied', v)} type="date" />
                  <SelectField label="Source" value={form.source} onChange={v => set('source', v)}>
                    {SOURCES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                  </SelectField>
                </div>
                <Field label="Next Step" value={form.nextStep} onChange={v => set('nextStep', v)} placeholder="e.g. Recruiter screen, take-home, follow-up email" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Salary Min ($)" value={form.salaryMin} onChange={v => set('salaryMin', v)} placeholder="e.g. 150000" type="number" />
                  <Field label="Salary Max ($)" value={form.salaryMax} onChange={v => set('salaryMax', v)} placeholder="e.g. 200000" type="number" />
                </div>
                <div>
                  <label className="modal-field-label">Job Description</label>
                  <textarea
                    value={form.jobDescription}
                    onChange={e => set('jobDescription', e.target.value)}
                    placeholder="Paste the full job description — powers AI match scoring and coaching."
                    rows={4}
                    className="modal-textarea"
                  />
                </div>
              </div>
            )}

            {tab === 'contact' && (
              <div className="space-y-3 pb-4">
                <Field label="Recruiter Name" value={form.recruiterName} onChange={v => set('recruiterName', v)} placeholder="Jane Smith" />
                <Field label="Recruiter Email" value={form.recruiterEmail} onChange={v => set('recruiterEmail', v)} placeholder="jane@company.com" type="email" />
                <Field label="Recruiter LinkedIn" value={form.recruiterLinkedIn} onChange={v => set('recruiterLinkedIn', v)} placeholder="https://linkedin.com/in/..." type="url" />
              </div>
            )}

            {tab === 'notes' && (
              <div className="pb-4">
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Add notes, impressions, key skills to highlight, interview prep..."
                  rows={10}
                  className="modal-textarea"
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="submit" disabled={saving} className="modal-submit-btn">
              {saving ? 'Saving...' : job ? 'Save Changes' : 'Save Application'}
            </button>
            <button type="button" onClick={onClose} className="modal-cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="modal-field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="modal-input"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, children }) {
  return (
    <div>
      <label className="modal-field-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="modal-select">
        {children}
      </select>
    </div>
  )
}
