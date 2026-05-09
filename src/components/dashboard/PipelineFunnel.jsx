import { STAGES } from '../../constants/stages'
import { useJobs } from '../../context/JobsContext'

export default function PipelineFunnel() {
  const { jobs } = useJobs()

  const activeStageCounts = STAGES
    .filter(s => !['rejected', 'withdrawn'].includes(s.id))
    .map(s => ({
      ...s,
      count: jobs.filter(j => j.stage === s.id).length,
    }))

  const max = Math.max(...activeStageCounts.map(s => s.count), 1)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Pipeline</h3>
      <div className="space-y-2">
        {activeStageCounts.map(stage => (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="text-xs text-slate-300 w-28 shrink-0 truncate">{stage.label}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`pipeline-bar h-full rounded-full ${stage.dotClass} transition-all duration-500`}
                style={{ '--bar-w': `${max ? (stage.count / max) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-200 w-5 text-right">{stage.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
