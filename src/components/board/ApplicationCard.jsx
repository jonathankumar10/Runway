import { useCallback, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

function PrepPill({ status }) {
  if (!status || status === 'ready') return status === 'ready'
    ? <span className="app-card-prep app-card-prep--ready">Tailored ready</span>
    : null

  const label = {
    matching: 'Scoring',
    tailoring: 'Tailoring',
    needs_resume: 'Needs resume',
    error: 'Prep failed',
  }[status] || 'Preparing'

  return <span className={`app-card-prep app-card-prep--${status}`}>{label}</span>
}

/**
 * Sortable application card used by the Kanban board and drag overlay.
 */
export default function ApplicationCard({ job, isDragging, isSelected, onCardClick }) {
  const { deleteJob } = useJobMutations()
  const navigate = useNavigate()
  const stage = STAGE_MAP[job.stage]

  const glowRef = useRef(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: job.id })

  const mergedRef = useCallback((el) => {
    setNodeRef(el)
    glowRef.current = el
  }, [setNodeRef])

  const handleMouseMove = useCallback((e) => {
    const el = glowRef.current
    if (!el) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const angle = Math.atan2(e.clientY - (top + height / 2), e.clientX - (left + width / 2)) * (180 / Math.PI)
    el.style.setProperty('--start', String(angle + 90))
    el.style.setProperty('--active', '1')
  }, [])

  const handleMouseLeave = useCallback(() => {
    glowRef.current?.style.setProperty('--active', '0')
  }, [])

  const dndStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isSortableDragging ? 0.4 : 1 }
  const salary = formatSalary(job.salaryMin, job.salaryMax)

  const borderClass = isSelected
    ? 'border-blue-500/60 ring-1 ring-blue-500/30'
    : (stage?.borderClass ?? 'border-zinc-700')

  async function handleDelete(e) {
    e.stopPropagation()
    if (confirm(`Delete ${job.company} – ${job.role}?`)) await deleteJob(job.id)
  }

  return (
    <div
      ref={mergedRef}
      style={dndStyle}
      onClick={() => onCardClick?.(job)}
      onDoubleClick={() => navigate(`/applications/${job.id}`)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`app-card ${borderClass}${isDragging ? ' shadow-2xl scale-105' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="glows" />
      <div className={`h-0.5 w-full ${stage?.dotClass ?? 'bg-zinc-600'}`} />

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
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="app-card-company">{job.company || 'Untitled'}</p>
              <MatchPill score={job.matchScore} />
            </div>
            <p className="app-card-role">{job.role || 'No role'}</p>
            <PrepPill status={job.aiPrepStatus} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {salary && <span className="app-card-salary">{salary}</span>}
          {job.location && <span className="text-xs text-zinc-400 truncate">{job.location}</span>}
        </div>

        <div className="app-card-actions" onPointerDown={e => e.stopPropagation()}>
          <button onClick={handleDelete} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded mr-auto">
            <Trash2 size={13} />
          </button>
          {job.jobUrl && (
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="app-card-action-btn hover:text-emerald-400 hover:bg-emerald-500/10"
              title="Visit site"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={e => { e.stopPropagation(); navigate(`/applications/${job.id}`) }}
            className="app-card-action-btn hover:text-amber-400 hover:bg-amber-500/10"
            title="Edit application"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
