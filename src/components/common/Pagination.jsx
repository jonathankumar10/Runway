import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Pagination.css'

/**
 * Builds the compact page-number list, including ellipses for large ranges.
 */
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = [1]

  if (currentPage > 3) pages.push('...')

  const rangeStart = Math.max(2, currentPage - 1)
  const rangeEnd   = Math.min(totalPages - 1, currentPage + 1)
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)

  if (currentPage < totalPages - 2) pages.push('...')

  pages.push(totalPages)
  return pages
}

/**
 * Reusable pagination control for card/table list pages.
 */
export default function Pagination({ currentPage, totalPages, onGoToPage, totalItems, pageSize }) {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * pageSize + 1
  const to   = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="pagination-wrap">
      <p className="pagination-info">
        Showing {from}–{to} of {totalItems}
      </p>

      <div className="pagination-row">
        <button
          className="pagination-btn"
          onClick={() => onGoToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers(currentPage, totalPages).map((page, i) =>
          page === '...'
            ? <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
            : <button
                key={page}
                className={`pagination-btn ${page === currentPage ? 'pagination-btn--active' : ''}`}
                onClick={() => onGoToPage(page)}
              >
                {page}
              </button>
        )}

        <button
          className="pagination-btn"
          onClick={() => onGoToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>

      </div>
    </div>
  )
}
