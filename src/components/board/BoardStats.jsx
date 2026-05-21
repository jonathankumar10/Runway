import { useJobs } from '../../context/JobsContext'
import './BoardStats.css'

export default function BoardStats() {
  const { jobs } = useJobs()

  const active = jobs.filter(j => !['saved', 'rejected', 'withdrawn', 'accepted'].includes(j.stage)).length
  const interviews = jobs.filter(j => ['phoneScreen', 'technicalInterview', 'finalRound'].includes(j.stage)).length
  const nextActions = jobs.filter(j => {
    if (j.stage !== 'applied') return false
    const ms = j.lastStatusChange?.toMillis?.() ?? j.createdAt?.toMillis?.() ?? 0
    return Date.now() - ms > 7 * 86400000
  }).length
  const scored = jobs.filter(j => j.matchScore != null)
  const avgMatch = scored.length
    ? Math.round(scored.reduce((s, j) => s + j.matchScore, 0) / scored.length)
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
