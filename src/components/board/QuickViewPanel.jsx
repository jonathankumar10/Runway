import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, Pencil, Sparkles, Mail, ArrowRight, Loader2, Maximize2 } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useAI } from '../../hooks/useAI'
import { STAGE_MAP } from '../../constants/stages'
import ApplicationModal from '../modals/ApplicationModal'
import './QuickViewPanel.css'

const URGENCY_BOX = {
  high:   'bg-orange-500/5 border-orange-500/20',
  medium: 'bg-violet-500/5 border-violet-500/20',
  low:    'bg-slate-800/50 border-slate-700',
}

const URGENCY_LABEL = {
  high:   'text-orange-400',
  medium: 'text-violet-400',
  low:    'text-slate-500',
}

function getNextAction(job) {
  const ms = job.lastStatusChange?.toMillis?.() ?? job.createdAt?.toMillis?.() ?? 0
  const days = Math.floor((Date.now() - ms) / 86400000)
  switch (job.stage) {
    case 'saved':               return { text: 'Apply when ready', urgency: 'low' }
    case 'applied':             return days >= 7
      ? { text: `Send a follow-up — ${days}d with no update`, urgency: 'high' }
      : { text: `Waiting — applied ${days}d ago`, urgency: 'low' }
    case 'phoneScreen':         return { text: 'Review the role & research the company', urgency: 'medium' }
    case 'technicalInterview':  return { text: 'Practice DSA + system design problems', urgency: 'high' }
    case 'finalRound':          return { text: 'Prep STAR stories & questions to ask', urgency: 'high' }
    case 'offer':               return { text: 'Evaluate & negotiate the offer', urgency: 'high' }
    case 'accepted':            return { text: 'Congrats! Prepare for your start date', urgency: 'low' }
    default:                    return null
  }
}

function MatchBadge({ score }) {
  if (score == null) return null
  const color = score >= 75 ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : score >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {score}% match
    </span>
  )
}

export default function QuickViewPanel({ job, onClose }) {
  const { user } = useAuth()
  const { matchResume } = useAI()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [matching, setMatching] = useState(false)
  const stage = STAGE_MAP[job.stage]
  const nextAction = getNextAction(job)

  const salary = (() => {
    if (!job.salaryMin && !job.salaryMax) return null
    const fmt = n => `$${Math.round(n / 1000)}k`
    if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`
    return job.salaryMin ? `${fmt(job.salaryMin)}+` : `up to ${fmt(job.salaryMax)}`
  })()

  const appliedDate = job.dateApplied?.toDate
    ? job.dateApplied.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  async function handleMatchResume() {
    setMatching(true)
    try {
      const result = await matchResume(job.id, job.company, job.role, job.keySkills ?? [], job.notes ?? '')
      if (result?.score != null) {
        await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), { matchScore: result.score })
      }
    } finally {
      setMatching(false)
    }
  }

  return (
    <>
      <div className="qv-panel">
        <div className="qv-header">
          <span className="text-xs font-semibold text-slate-300">Quick View</span>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(`/applications/${job.id}`)} className="text-slate-500 hover:text-violet-400 transition-colors" title="Open full view">
              <Maximize2 size={13} />
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {job.logoUrl ? (
              <img src={job.logoUrl} alt="" className="qv-logo" onError={e => { e.target.style.display = 'none' }} />
            ) : (
              <div className="qv-logo-fallback">{job.company?.[0]?.toUpperCase() ?? '?'}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm leading-tight">{job.company || 'Untitled'}</p>
              <p className="text-xs text-slate-400 mt-0.5">{job.role || 'No role'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MatchBadge score={job.matchScore} />
            <button onClick={handleMatchResume} disabled={matching} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50">
              {matching ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {matching ? 'Matching...' : job.matchScore != null ? 'Re-match' : 'Match resume'}
            </button>
          </div>

          <div className="space-y-1.5">
            <Row label="Status">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${stage?.textClass ?? 'text-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass}`} />
                {stage?.label ?? job.stage}
              </span>
            </Row>
            {appliedDate && <Row label="Applied"><span className="text-xs text-slate-300">{appliedDate}</span></Row>}
            {salary && <Row label="Salary"><span className="text-xs text-slate-300">{salary}</span></Row>}
            {job.location && <Row label="Location"><span className="text-xs text-slate-300">{job.location}</span></Row>}
          </div>

          {nextAction && (
            <div className={`qv-next-action ${URGENCY_BOX[nextAction.urgency]}`}>
              <p className={`qv-next-action-label ${URGENCY_LABEL[nextAction.urgency]}`}>Next best action</p>
              <p className="text-xs text-slate-300 flex items-start gap-1.5">
                <ArrowRight size={11} className="mt-0.5 shrink-0" />
                {nextAction.text}
              </p>
            </div>
          )}

          {(job.recruiterName || job.recruiterEmail) && (
            <div>
              <p className="qv-section-label">Contact</p>
              {job.recruiterName && <p className="text-xs text-slate-300">{job.recruiterName}</p>}
              {job.recruiterEmail && (
                <a href={`mailto:${job.recruiterEmail}`} className="text-xs text-violet-400 hover:underline flex items-center gap-1 mt-0.5">
                  <Mail size={10} /> {job.recruiterEmail}
                </a>
              )}
            </div>
          )}

          {job.keySkills?.length > 0 && (
            <div>
              <p className="qv-section-label">Key Skills</p>
              <div className="flex flex-wrap gap-1">
                {job.keySkills.map(s => (
                  <span key={s} className="qv-skill-tag">{s}</span>
                ))}
              </div>
            </div>
          )}

          {job.notes && (
            <div>
              <p className="qv-section-label">Notes</p>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
        </div>

        <div className="qv-footer">
          <button onClick={() => setEditing(true)} className="qv-footer-btn">
            <Pencil size={12} /> Edit
          </button>
          {job.jobUrl && (
            <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="qv-footer-btn">
              <ExternalLink size={12} /> View Job
            </a>
          )}
        </div>
      </div>

      {editing && <ApplicationModal job={job} onClose={() => setEditing(false)} />}
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      {children}
    </div>
  )
}
