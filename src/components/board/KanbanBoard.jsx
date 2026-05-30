import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { ListPlus, Zap } from 'lucide-react'
import { STAGES } from '../../constants/stages'
import { useJobs } from '../../context/jobs'
import { useJobMutations } from '../../hooks/useJobMutations'
import KanbanColumn from './KanbanColumn'
import ApplicationCard from './ApplicationCard'
import ApplicationModal from '../modals/ApplicationModal'
import BulkImportModal from '../modals/BulkImportModal'

/**
 * Resolves a drag target id to a pipeline stage id.
 */
function getDropTargetStage(overId, jobs) {
  const stageById = STAGES.find(stage => stage.id === overId)?.id
  const stageByCard = jobs.find(job => job.id === overId)?.stage
  return stageById ?? stageByCard
}

/**
 * Drag-and-drop board for moving applications between pipeline stages.
 */
export default function KanbanBoard({ activeStage = 'all', selectedJobId, onCardClick }) {
  const { jobs } = useJobs()
  const { updateStage } = useJobMutations()
  const [activeJob, setActiveJob] = useState(null)
  const [modalStage, setModalStage] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filteredJobs = activeStage === 'all' ? jobs : jobs.filter(j => j.stage === activeStage)

  const jobsByStage = STAGES.reduce((acc, s) => {
    acc[s.id] = filteredJobs.filter(j => j.stage === s.id)
    return acc
  }, {})

  function handleDragStart(event) {
    setActiveJob(jobs.find(j => j.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveJob(null)
    if (!over || active.id === over.id) return

    const newStage = getDropTargetStage(over.id, jobs)

    if (newStage) {
      const job = jobs.find(j => j.id === active.id)
      if (job && job.stage !== newStage) await updateStage(active.id, newStage)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 py-3 border-b border-zinc-700 shrink-0">
        <p className="text-xs text-zinc-300 shrink-0">
          {filteredJobs.length} application{filteredJobs.length !== 1 ? 's' : ''}
          {activeStage !== 'all' && <span className="text-zinc-500"> · filtered</span>}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setBulkOpen(true)}
            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
          >
            <ListPlus size={13} />
            <span className="sm:hidden">Bulk</span>
            <span className="hidden sm:inline">Bulk Import</span>
          </button>
          <button
            onClick={() => setModalStage('')}
            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Zap size={13} />
            <span className="sm:hidden">Single</span>
            <span className="hidden sm:inline">Single Import</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 px-4 sm:px-6 py-4 min-w-max items-start">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                jobs={jobsByStage[stage.id]}
                selectedJobId={selectedJobId}
                onCardClick={onCardClick}
                onAddClick={() => setModalStage(stage.id)}
                dimmed={activeStage !== 'all' && activeStage !== stage.id}
              />
            ))}
          </div>

          <DragOverlay>
            {activeJob ? <ApplicationCard job={activeJob} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {modalStage !== null && <ApplicationModal defaultStage={modalStage || 'saved'} onClose={() => setModalStage(null)} />}
      {bulkOpen && <BulkImportModal onClose={() => setBulkOpen(false)} />}
    </div>
  )
}
