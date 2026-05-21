import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Pagination.css'

// ─────────────────────────────────────────────────────────────────────────────
// getPageNumbers
//
// Decides which page numbers (and '...' placeholders) to render.
// When there are 7 or fewer pages we show them all.
// When there are more we show: first, a window around the current page, last.
//
// Example for page 5 of 12:  [1, '...', 4, 5, 6, '...', 12]
// ─────────────────────────────────────────────────────────────────────────────
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = [1]

  if (currentPage > 3) pages.push('...')

  // The window of pages immediately around the current one
  const rangeStart = Math.max(2, currentPage - 1)
  const rangeEnd   = Math.min(totalPages - 1, currentPage + 1)
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)

  if (currentPage < totalPages - 2) pages.push('...')

  pages.push(totalPages)
  return pages
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
//
// Props:
//   currentPage  — the current page (1-indexed)
//   totalPages   — total number of pages
//   onGoToPage   — function(pageNumber) called when the user clicks a page
//   totalItems   — total count of items (used for the "Showing X–Y of Z" line)
//   pageSize     — items per page (used for the same line)
//
// Returns null (renders nothing) when there is only one page.
// ─────────────────────────────────────────────────────────────────────────────
export default function Pagination({ currentPage, totalPages, onGoToPage, totalItems, pageSize }) {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * pageSize + 1
  const to   = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="pagination-wrap">

      {/* Count info */}
      <p className="pagination-info">
        Showing {from}–{to} of {totalItems}
      </p>

      {/* Page buttons */}
      <div className="pagination-row">

        {/* ← Previous */}
        <button
          className="pagination-btn"
          onClick={() => onGoToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers */}
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

        {/* → Next */}
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
