import { STAGES } from '../../constants/stages'
import { useJobs } from '../../context/useJobs'
import './StageFilterTabs.css'

export default function StageFilterTabs({ activeStage, setActiveStage }) {
  const { jobs } = useJobs()

  const counts = STAGES.reduce((acc, s) => {
    acc[s.id] = jobs.filter(j => j.stage === s.id).length
    return acc
  }, {})

  return (
    <div className="stage-tabs">
      <button
        onClick={() => setActiveStage('all')}
        className={`stage-tab ${activeStage === 'all' ? 'stage-tab-active' : 'stage-tab-inactive'}`}
      >
        All stages
        <span className="text-xs text-slate-400">{jobs.length}</span>
      </button>

      {STAGES.map(stage => (
        <button
          key={stage.id}
          onClick={() => setActiveStage(activeStage === stage.id ? 'all' : stage.id)}
          className={`stage-tab ${activeStage === stage.id ? `${stage.bgClass} ${stage.textClass}` : 'stage-tab-inactive'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stage.dotClass}`} />
          {stage.label}
          {counts[stage.id] > 0 && (
            <span className="text-xs text-slate-400">{counts[stage.id]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
