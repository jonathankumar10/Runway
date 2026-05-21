import { ArrowRight } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { STAGE_MAP } from '../../constants/stages'

function getNextMove(job) {
  const now = Date.now()
  const daysSince = job.lastStatusChange?.toMillis
    ? Math.floor((now - job.lastStatusChange.toMillis()) / 86400000)
    : null

  switch (job.stage) {
    case 'saved': return { text: 'Apply now', urgent: false }
    case 'applied': {
      const overdue = daysSince != null && daysSince >= 7
      return {
        text: overdue ? `Follow up (${daysSince}d with no update)` : `Waiting — applied ${daysSince ?? '?'}d ago`,
        urgent: overdue,
      }
    }
    case 'phoneScreen': return { text: 'Prep for screen — review role & company', urgent: false }
    case 'technicalInterview': return { text: 'Practice DSA & system design', urgent: false }
    case 'finalRound': return { text: 'Prep behavioral stories & questions to ask', urgent: false }
    case 'offer': return { text: 'Evaluate & negotiate offer', urgent: false }
    default: return null
  }
}

export default function NextMoves() {
  const { jobs } = useJobs()

  const active = jobs
    .filter(j => !['accepted', 'rejected', 'withdrawn'].includes(j.stage))
    .sort((a, b) => {
      const aUrgent = getNextMove(a)?.urgent ? -1 : 0
      const bUrgent = getNextMove(b)?.urgent ? -1 : 0
      return aUrgent - bUrgent
    })
    .slice(0, 8)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Next Moves</h3>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-9 h-9 rounded-full border border-dashed border-slate-700 flex items-center justify-center">
            <ArrowRight size={15} className="text-slate-600" />
          </div>
          <p className="text-xs text-slate-500">No active applications</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {active.map(job => {
            const move = getNextMove(job)
            const stage = STAGE_MAP[job.stage]
            if (!move) return null
            return (
              <li key={job.id} className="flex items-start gap-2.5">
                <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${move.urgent ? 'bg-amber-400' : (stage?.dotClass ?? 'bg-slate-500')}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{job.company} — {job.role}</p>
                  <p className={`text-xs flex items-center gap-1 mt-0.5 ${move.urgent ? 'text-amber-400' : 'text-slate-500'}`}>
                    <ArrowRight size={9} className="shrink-0" />
                    {move.text}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
