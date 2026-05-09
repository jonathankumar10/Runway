import { ArrowRight } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { STAGE_MAP } from '../../constants/stages'

function getNextMove(job) {
  const now = Date.now()
  const daysSince = job.lastStatusChange?.toMillis
    ? Math.floor((now - job.lastStatusChange.toMillis()) / 86400000)
    : null

  switch (job.stage) {
    case 'saved': return 'Apply now'
    case 'applied':
      return daysSince != null && daysSince >= 7
        ? `Follow up (${daysSince}d with no update)`
        : `Waiting — applied ${daysSince ?? '?'}d ago`
    case 'phoneScreen': return 'Prep for screen — review role & company'
    case 'technicalInterview': return 'Practice DSA & system design'
    case 'finalRound': return 'Prep behavioral stories & questions to ask'
    case 'offer': return 'Evaluate & negotiate offer'
    default: return null
  }
}

export default function NextMoves() {
  const { jobs } = useJobs()

  const active = jobs
    .filter(j => !['accepted', 'rejected', 'withdrawn'].includes(j.stage))
    .slice(0, 8)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Next Moves</h3>
      {active.length === 0 ? (
        <p className="text-xs text-slate-400">No active applications</p>
      ) : (
        <ul className="space-y-2">
          {active.map(job => {
            const move = getNextMove(job)
            const stage = STAGE_MAP[job.stage]
            if (!move) return null
            return (
              <li key={job.id} className="flex items-start gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${stage?.dotClass ?? 'bg-slate-500'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{job.company} — {job.role}</p>
                  <p className="text-xs text-slate-300 flex items-center gap-1">
                    <ArrowRight size={9} />
                    {move}
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
