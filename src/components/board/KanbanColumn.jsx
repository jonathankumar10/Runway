import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ApplicationCard from './ApplicationCard'
import './KanbanColumn.css'

/**
 * Droppable stage column that renders sortable application cards.
 */
export default function KanbanColumn({ stage, jobs, selectedJobId, onCardClick, onAddClick, dimmed }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className={`kanban-col ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
      <div className="kanban-col-header">
        <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
        <span className="text-xs font-semibold text-zinc-300">{stage.label}</span>
        <span className="kanban-col-count">{jobs.length}</span>
      </div>

      <div ref={setNodeRef} className={`kanban-col-drop${isOver ? ' kanban-col-drop--over' : ''}`}>
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
        <button
          className="kanban-col-add"
          onClick={e => { e.stopPropagation(); onAddClick?.() }}
          onPointerDown={e => e.stopPropagation()}
        >
          <Plus size={13} />
          <span>Add here</span>
        </button>
      </div>
    </div>
  )
}
