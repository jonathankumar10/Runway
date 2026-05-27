import { useEffect, useState } from 'react'
import { Mail, Sparkles } from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import './CoachingPanel.css'

const STAGE_LABELS = {
  saved: null,
  applied: 'Follow-up tips',
  phoneScreen: 'Phone screen prep',
  technicalInterview: 'Technical prep',
  finalRound: 'Final round prep',
  offer: 'Offer & negotiation',
  accepted: null,
  rejected: null,
  withdrawn: null,
}

export default function CoachingPanel({ job }) {
  const [tipsState, setTipsState] = useState({ key: null, tips: null })
  const [followUp, setFollowUp] = useState(null)
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const { getCoaching, draftFollowUp } = useAI()

  const label = STAGE_LABELS[job.stage]
  const coachingKey = `${job.stage}:${job.company}:${job.role}`
  const tips = tipsState.key === coachingKey ? tipsState.tips : null
  const loadingTips = label && tips === null

  useEffect(() => {
    if (!label || tips !== null) return undefined

    let ignore = false
    getCoaching(job.stage, job.company, job.role)
      .then(data => {
        if (!ignore) setTipsState({ key: coachingKey, tips: data?.tips ?? [] })
      })
      .catch(() => {
        if (!ignore) setTipsState({ key: coachingKey, tips: [] })
      })

    return () => {
      ignore = true
    }
  }, [coachingKey, getCoaching, job.company, job.role, job.stage, label, tips])

  async function handleDraftFollowUp() {
    if (followUp) { setShowFollowUp(true); return }
    setLoadingFollowUp(true)
    try {
      const data = await draftFollowUp({
        company: job.company,
        role: job.role,
        stage: job.stage,
        recruiterName: job.recruiterName || null,
        daysSinceApplied: job.dateApplied
          ? Math.floor((Date.now() - job.dateApplied.toMillis()) / 86400000)
          : null,
      })
      setFollowUp(data)
      setShowFollowUp(true)
    } catch {
      // silently fail
    } finally {
      setLoadingFollowUp(false)
    }
  }

  if (!label) return null

  return (
    <div className="coaching-panel">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={11} className="text-violet-400" />
        <span className="text-xs font-medium text-violet-400">{label}</span>
      </div>

      {loadingTips ? (
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton-line h-2.5 bg-slate-800 rounded animate-pulse" style={{ '--skeleton-w': `${70 + i * 10}%` }} />
          ))}
        </div>
      ) : (
        <ul className="space-y-1">
          {tips?.map((tip, i) => (
            <li key={i} className="text-xs text-slate-400 flex gap-1.5 leading-relaxed">
              <span className="text-slate-600 shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      )}

      <button onClick={handleDraftFollowUp} disabled={loadingFollowUp} className="coaching-follow-up-btn">
        <Mail size={11} />
        {loadingFollowUp ? 'Drafting...' : 'Draft follow-up email'}
      </button>

      {showFollowUp && followUp && (
        <div className="coaching-draft-box">
          <p className="text-xs font-medium text-slate-300 mb-1">Subject: {followUp.subject}</p>
          <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{followUp.body}</p>
          <button
            onClick={() => navigator.clipboard.writeText(`Subject: ${followUp.subject}\n\n${followUp.body}`)}
            className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  )
}
