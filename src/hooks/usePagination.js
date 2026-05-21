import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// usePagination
//
// A small hook that splits any array into pages.
//
// Usage:
//   const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(myArray, 10)
//
// 'items'    — the full filtered array you want to paginate
// 'pageSize' — how many items to show per page
//
// Returns:
//   currentPage    — which page the user is on (1-indexed)
//   totalPages     — total number of pages
//   paginatedItems — the slice of items for the current page
//   goToPage(n)    — call this to jump to a specific page number
// ─────────────────────────────────────────────────────────────────────────────
export function usePagination(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1)

  // Total pages — always at least 1, even when the list is empty
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // If items shrink (e.g. user narrows the search), clamp to the last valid page
  const safePage = Math.min(currentPage, totalPages)

  // Slice out just the items for this page
  const startIndex = (safePage - 1) * pageSize
  const paginatedItems = items.slice(startIndex, startIndex + pageSize)

  return {
    currentPage: safePage,
    totalPages,
    paginatedItems,
    goToPage: setCurrentPage,
  }
}
