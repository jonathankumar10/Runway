import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Plus, Zap } from 'lucide-react'
import { STAGES } from '../../constants/stages'
import { useJobs } from '../../context/JobsContext'
import { useJobMutations } from '../../hooks/useJobMutations'
import KanbanColumn from './KanbanColumn'
import ApplicationCard from './ApplicationCard'
import ApplicationModal from '../modals/ApplicationModal'
import BulkImportModal from '../modals/BulkImportModal'

export default function KanbanBoard({ activeStage = 'all', selectedJobId, onCardClick }) {
  const { jobs } = useJobs()
  const { updateStage } = useJobMutations()
  const [activeJob, setActiveJob] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
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

    // over.id is either a stage id (dropped on empty column area) or a card id (dropped on a card)
    const stageById = STAGES.find(s => s.id === over.id)?.id
    const stageByCard = jobs.find(j => j.id === over.id)?.stage
    const newStage = stageById ?? stageByCard

    if (newStage) {
      const job = jobs.find(j => j.id === active.id)
      if (job && job.stage !== newStage) await updateStage(active.id, newStage)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 shrink-0">
        <p className="text-xs text-slate-300">
          {filteredJobs.length} application{filteredJobs.length !== 1 ? 's' : ''}
          {activeStage !== 'all' && <span className="text-slate-500"> · filtered</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Zap size={13} />
            Bulk Import
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={13} />
            Add Application
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 px-6 py-4 h-full min-w-max">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                jobs={jobsByStage[stage.id]}
                selectedJobId={selectedJobId}
                onCardClick={onCardClick}
                dimmed={activeStage !== 'all' && activeStage !== stage.id}
              />
            ))}
          </div>

          <DragOverlay>
            {activeJob ? <ApplicationCard job={activeJob} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {modalOpen && <ApplicationModal onClose={() => setModalOpen(false)} />}
      {bulkOpen && <BulkImportModal onClose={() => setBulkOpen(false)} />}
    </div>
  )
}
