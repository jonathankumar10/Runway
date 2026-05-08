import { useState } from 'react'
import { X, Wand2 } from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import './JDParserModal.css'

export default function JDParserModal({ onParsed, onClose }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { parseJD } = useAI()

  async function handleParse(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const fields = await parseJD(text.trim())
      onParsed({
        company: fields.company ?? '',
        role: fields.role ?? '',
        jobUrl: fields.jobUrl ?? '',
        location: fields.location ?? '',
        salaryMin: fields.salaryMin ?? '',
        salaryMax: fields.salaryMax ?? '',
        keySkills: fields.keySkills ?? [],
      })
    } catch {
      setError('Failed to parse. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="jd-overlay" onClick={onClose}>
      <div className="jd-box" onClick={e => e.stopPropagation()}>
        <div className="jd-header">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Parse Job Description</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleParse}>
          <div className="px-5 py-4">
            <p className="text-xs text-slate-400 mb-3">
              Paste the full job description below. Claude will extract company, role, salary, location, and key skills.
            </p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste job description here..."
              rows={10}
              className="jd-textarea"
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>

          <div className="jd-footer">
            <button type="button" onClick={onClose} className="jd-cancel-btn">Cancel</button>
            <button type="submit" disabled={loading || !text.trim()} className="jd-submit-btn">
              <Wand2 size={13} />
              {loading ? 'Parsing...' : 'Parse with AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
