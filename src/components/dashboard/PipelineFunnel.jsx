import { STAGES } from '../../constants/stages'
import { useJobs } from '../../context/useJobs'

export default function PipelineFunnel() {
  const { jobs } = useJobs()

  const activeStageCounts = STAGES
    .filter(s => !['rejected', 'withdrawn'].includes(s.id))
    .map(s => ({
      ...s,
      count: jobs.filter(j => j.stage === s.id).length,
    }))

  const max = Math.max(...activeStageCounts.map(s => s.count), 1)

  const totalActive = activeStageCounts.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Pipeline</h3>
        <span className="text-xs text-slate-500">{totalActive} active</span>
      </div>
      <div className="space-y-2.5">
        {activeStageCounts.map(stage => (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-28 shrink-0 truncate">{stage.label}</span>
            <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`pipeline-bar h-full rounded-full ${stage.dotClass} transition-all duration-500`}
                style={{ '--bar-w': `${max ? (stage.count / max) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-300 w-5 text-right">{stage.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
