import { useState } from 'react'
import BoardStats from '../components/board/BoardStats'
import StageFilterTabs from '../components/board/StageFilterTabs'
import KanbanBoard from '../components/board/KanbanBoard'
import QuickViewPanel from '../components/board/QuickViewPanel'

/**
 * Main application pipeline view.
 * Coordinates stage filtering and the selected-card quick view.
 */
export default function BoardPage() {
  const [activeStage, setActiveStage] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)

  function handleCardClick(job) {
    setSelectedJob(prev => prev?.id === job.id ? null : job)
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <BoardStats />
      <StageFilterTabs activeStage={activeStage} setActiveStage={setActiveStage} />
      <div className="flex flex-1 overflow-hidden">
        <KanbanBoard
          activeStage={activeStage}
          selectedJobId={selectedJob?.id}
          onCardClick={handleCardClick}
        />
        {selectedJob && (
          <QuickViewPanel
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    </div>
  )
}
