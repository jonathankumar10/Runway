import { useState } from 'react'
import { X, Zap, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useJobImport } from '../../hooks/useJobImport'
import { useJobMutations } from '../../hooks/useJobMutations'
import { parseImportUrls } from '../../lib/imports/importUtils'
import { runBulkJobImport } from '../../lib/imports/bulkImportRunner'
import './BulkImportModal.css'

/**
 * Modal for importing multiple job URLs and creating applications in sequence.
 */
export default function BulkImportModal({ onClose }) {
  const [urlText, setUrlText] = useState('')
  const [items, setItems] = useState([])
  const [phase, setPhase] = useState('input')
  const { importJobFromUrl } = useJobImport()
  const { addJob } = useJobMutations()

  const { urls, invalid } = parseImportUrls(urlText)
  const doneCount = items.filter(i => i.status === 'success' || i.status === 'error').length
  const successCount = items.filter(i => i.status === 'success').length
  const errorCount = items.filter(i => i.status === 'error').length

  function setItemStatus(index, patch) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function handleImport() {
    if (!urls.length) return

    const initial = urls.map((url, i) => ({ id: i, url, status: 'idle', result: null, error: null }))
    setItems(initial)
    setPhase('running')

    await runBulkJobImport({
      urls,
      importJobFromUrl,
      addJob,
      onItemUpdate: setItemStatus,
    })

    setPhase('done')
  }

  return (
    <div className="bulk-overlay" onClick={onClose}>
      <div className="bulk-box" onClick={e => e.stopPropagation()}>

        <div className="bulk-header">
          <div className="flex items-center gap-2.5">
            <div className="bulk-header-icon">
              <Zap size={14} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Bulk Import Jobs</h2>
              <p className="text-xs text-slate-500">Paste multiple job URLs; each valid URL is imported separately</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X size={17} />
          </button>
        </div>

        {phase === 'input' && (
          <>
            <div className="px-5 pb-4">
              <textarea
                value={urlText}
                onChange={e => setUrlText(e.target.value)}
                placeholder={"https://jobs.lever.co/acme/...\nhttps://www.linkedin.com/jobs/view/...\nhttps://boards.greenhouse.io/..."}
                rows={8}
                className="bulk-textarea"
                autoFocus
              />
              {(urls.length > 0 || invalid.length > 0) && (
                <p className="text-xs text-slate-500 mt-2">
                  {urls.length} valid URL{urls.length !== 1 ? 's' : ''} detected
                  {invalid.length > 0 && (
                    <span className="text-amber-400"> · {invalid.length} ignored</span>
                  )}
                </p>
              )}
            </div>
            <div className="bulk-footer">
              <button onClick={handleImport} disabled={!urls.length} className="bulk-submit-btn">
                <Zap size={13} />
                Import {urls.length > 0 ? `${urls.length} Job${urls.length !== 1 ? 's' : ''}` : 'Jobs'}
              </button>
              <button onClick={onClose} className="bulk-cancel-btn">Cancel</button>
            </div>
          </>
        )}

        {(phase === 'running' || phase === 'done') && (
          <>
            <div className="px-5 py-3">
              {phase === 'done' && (
                <div className="bulk-summary">
                  <span className="text-green-400 font-semibold">{successCount} imported</span>
                  {errorCount > 0 && <span className="text-red-400">{errorCount} failed</span>}
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="bulk-item">
                    <div className="bulk-item-icon">
                      {item.status === 'loading' && <Loader2 size={14} className="text-violet-400 animate-spin" />}
                      {item.status === 'success' && <CheckCircle2 size={14} className="text-green-400" />}
                      {item.status === 'error'   && <XCircle size={14} className="text-red-400" />}
                      {item.status === 'idle'    && <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.status === 'success' && item.result ? (
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {item.result.company} — {item.result.role}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 truncate">{item.url}</p>
                      )}
                      {item.status === 'loading' && (
                        <p className="text-[10px] text-slate-500 mt-0.5">Importing...</p>
                      )}
                      {item.status === 'error' && (
                        <p className="text-[10px] text-red-400 mt-0.5">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bulk-footer">
              {phase === 'done' ? (
                <button onClick={onClose} className="bulk-submit-btn">Done</button>
              ) : (
                <p className="bulk-progress">
                  Importing {doneCount} of {items.length}…
                </p>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
