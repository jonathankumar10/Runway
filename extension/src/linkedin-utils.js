/** Collapses all whitespace to a single space and trims the result. */
export function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * Strips the follower count that LinkedIn appends to company names in the DOM,
 * e.g. "Acme Corp114,542 followers" → "Acme Corp".
 * Handles the edge case where the count runs directly into a trailing letter/digit.
 */
export function stripLinkedInFollowerCount(value) {
  const match = value.match(/(\d[\d,]*)\s+followers\b.*$/i)
  if (!match) return value

  const matchIndex = match.index ?? -1
  if (matchIndex <= 0) return value.slice(0, matchIndex).trim()

  const textBeforeCount = value.slice(0, matchIndex)
  const followerCount = match[1]
  const endsWithLetter = /[A-Za-z]$/.test(textBeforeCount)

  // LinkedIn can concatenate company names and follower counts without a space,
  // e.g. "A114,542 followers" for company "A1". Preserve any trailing digit that
  // was part of the company name, not the follower count.
  if (endsWithLetter && followerCount.includes(',')) {
    const [leadingGroup] = followerCount.split(',')
    if (leadingGroup.length > 1) {
      return `${textBeforeCount}${leadingGroup.slice(0, -2)}`.trim()
    }
  }

  return textBeforeCount.trim()
}

/**
 * Strips all LinkedIn-injected noise from a raw company name string:
 * follower counts, connection counts, "promoted by", timestamps, etc.
 */
export function cleanLinkedInCompany(value) {
  return stripLinkedInFollowerCount(cleanLine(value))
    .replace(/\s*\d+\s+connection(?:s)?\b.*$/i, '')
    .replace(/\s*\d+\s+month(?:s)?\s+ago\b.*$/i, '')
    .replace(/\s*over\s+\d+.*$/i, '')
    .replace(/\s*promoted by.*$/i, '')
    .replace(/\s*responses managed.*$/i, '')
    .trim()
}

/**
 * Matches text injected by third-party extensions (Jobright, etc.) that should
 * never be mistaken for a job title or location.
 */
export const INJECTED_TEXT_RE = /\b(low|medium|high|poor|great)\s+match\b|match for this job|be an early applicant|jobright|easy apply/i
