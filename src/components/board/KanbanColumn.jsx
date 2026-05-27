import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ApplicationCard from './ApplicationCard'
import './KanbanColumn.css'

/**
 * Droppable stage column that renders sortable application cards.
 */
export default function KanbanColumn({ stage, jobs, selectedJobId, onCardClick, dimmed }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const dropClass = isOver
    ? `${stage.bgClass} ${stage.borderClass} border`
    : 'border-transparent'

  return (
    <div className={`kanban-col ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
      <div className="kanban-col-header">
        <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
        <span className="text-xs font-semibold text-slate-300">{stage.label}</span>
        <span className="kanban-col-count">{jobs.length}</span>
      </div>

      <div ref={setNodeRef} className={`kanban-col-drop ${dropClass}`}>
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          <div className="kanban-col-cards">
            {jobs.map(job => (
              <ApplicationCard
                key={job.id}
                job={job}
                isSelected={job.id === selectedJobId}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
