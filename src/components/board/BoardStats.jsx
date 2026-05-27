import { useJobs } from '../../context/useJobs'
import { useNow } from '../../hooks/useNow'
import './BoardStats.css'

const ACTIVE_STAGES = new Set(['applied', 'phoneScreen', 'technicalInterview', 'finalRound', 'offer'])
const INTERVIEW_STAGES = new Set(['phoneScreen', 'technicalInterview', 'finalRound'])
const STALE_APPLICATION_MS = 7 * 86_400_000

export default function BoardStats() {
  const { jobs } = useJobs()
  const now = useNow()

  const active = jobs.filter(job => ACTIVE_STAGES.has(job.stage)).length
  const interviews = jobs.filter(job => INTERVIEW_STAGES.has(job.stage)).length
  const nextActions = jobs.filter(job => {
    if (job.stage !== 'applied') return false

    const statusChangedAt = job.lastStatusChange?.toMillis?.() ?? job.createdAt?.toMillis?.() ?? 0
    return now - statusChangedAt > STALE_APPLICATION_MS
  }).length
  const scored = jobs.filter(job => job.matchScore != null)
  const avgMatch = scored.length
    ? Math.round(scored.reduce((sum, job) => sum + job.matchScore, 0) / scored.length)
    : null

  const stats = [
    { label: 'Active Pipeline', value: active, sub: 'in progress' },
    { label: 'Need Action', value: nextActions, sub: 'stale ≥ 7 days', accent: nextActions > 0 },
    { label: 'Interviews', value: interviews, sub: 'past first screen' },
    { label: 'Avg Resume Match', value: avgMatch != null ? `${avgMatch}%` : '—', sub: avgMatch != null ? `${scored.length} scored` : 'run match to score' },
  ]

  return (
    <div className="board-stats">
      {stats.map(s => (
        <div key={s.label} className="board-stat-card">
          <p className="board-stat-label">{s.label}</p>
          <p className={`text-xl font-bold mt-0.5 ${s.accent ? 'text-orange-400' : 'text-white'}`}>{s.value}</p>
          <p className="board-stat-sub">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}
