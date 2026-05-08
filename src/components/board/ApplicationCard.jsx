import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, Trash2 } from 'lucide-react'
import { STAGE_MAP } from '../../constants/stages'
import { useJobMutations } from '../../hooks/useJobMutations'
import './ApplicationCard.css'

function formatSalary(min, max) {
  if (!min && !max) return null
  const fmt = n => `$${Math.round(n / 1000)}k`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  return min ? `${fmt(min)}+` : `up to ${fmt(max)}`
}

function MatchPill({ score }) {
  if (score == null) return null
  const color = score >= 75 ? 'text-green-400 bg-green-500/10'
    : score >= 50 ? 'text-yellow-400 bg-yellow-500/10'
    : 'text-red-400 bg-red-500/10'
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

export default function ApplicationCard({ job, isDragging, isSelected, onCardClick }) {
  const { deleteJob } = useJobMutations()
  const stage = STAGE_MAP[job.stage]

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: job.id })

  const dndStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isSortableDragging ? 0.4 : 1 }
  const salary = formatSalary(job.salaryMin, job.salaryMax)

  const borderClass = isSelected
    ? 'border-violet-500/60 ring-1 ring-violet-500/30'
    : (stage?.borderClass ?? 'border-slate-700')

  async function handleDelete(e) {
    e.stopPropagation()
    if (confirm(`Delete ${job.company} – ${job.role}?`)) await deleteJob(job.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      onClick={() => onCardClick?.(job)}
      className={`app-card ${borderClass}${isDragging ? ' shadow-2xl scale-105' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className={`h-0.5 w-full ${stage?.dotClass ?? 'bg-slate-600'}`} />

      <div className="p-3">
        <div className="flex items-start gap-2.5 mb-2">
          {job.logoUrl ? (
            <img src={job.logoUrl} alt="" className="app-card-logo" onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <div className="app-card-logo-fallback">
              {job.company?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="app-card-company">{job.company || 'Untitled'}</p>
              <MatchPill score={job.matchScore} />
            </div>
            <p className="app-card-role">{job.role || 'No role'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {salary && <span className="app-card-salary">{salary}</span>}
          {job.location && <span className="text-xs text-slate-500 truncate">{job.location}</span>}
        </div>

        <div className="app-card-actions" onPointerDown={e => e.stopPropagation()}>
          {job.jobUrl && (
            <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="app-card-action-btn">
              <ExternalLink size={11} />
            </a>
          )}
          <button onClick={handleDelete} className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
