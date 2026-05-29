import { useState } from 'react'

/**
 * Tracks the current page and returns the visible slice for a paginated list.
 */
export function usePagination(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedItems = items.slice(startIndex, startIndex + pageSize)

  return {
    currentPage: safePage,
    totalPages,
    paginatedItems,
    goToPage: setCurrentPage,
  }
}
