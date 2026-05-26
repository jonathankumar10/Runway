export const IMPORT_ERROR_MESSAGES = {
  FETCH_FAILED: 'Could not fetch this page (blocked or requires login)',
  PARSE_ERROR: 'Page was fetched but could not be parsed',
  INVALID_INPUT: 'Enter a valid http or https job URL',
  MISSING_ROLE: 'Page loaded but no job role found. Try the extension instead.',
  UNAUTHENTICATED: 'Sign in before importing jobs',
  UNKNOWN: 'Could not import this page',
}

const BLOCKED_PLATFORMS = [
  { match: h => h === 'www.linkedin.com' || h === 'linkedin.com', name: 'LinkedIn' },
  { match: h => h.endsWith('.myworkdayjobs.com'), name: 'Workday' },
  { match: h => h.endsWith('.taleo.net'), name: 'Taleo' },
  { match: h => h.endsWith('.icims.com'), name: 'iCIMS' },
  { match: h => h.endsWith('.bamboohr.com'), name: 'BambooHR' },
  { match: h => h === 'jobs.smartrecruiters.com', name: 'SmartRecruiters' },
]

export function normalizeUrl(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    parsed.hash = ''
    return parsed.href
  } catch {
    return null
  }
}

export function parseImportUrls(text) {
  const seen = new Set()
  const invalid = []
  const urls = []

  String(text ?? '')
    .split(/[\n,]+/)
    .map(u => u.trim())
    .filter(Boolean)
    .forEach(value => {
      const normalized = normalizeUrl(value)
      if (!normalized) {
        invalid.push(value)
        return
      }
      if (!seen.has(normalized)) {
        seen.add(normalized)
        urls.push(normalized)
      }
    })

  return { urls, invalid }
}

export function getBlockedPlatform(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null

  try {
    const { hostname } = new URL(normalized)
    return BLOCKED_PLATFORMS.find(platform => platform.match(hostname)) ?? null
  } catch {
    return null
  }
}

export function mapImportError(errorCode, fallbackMessage) {
  return IMPORT_ERROR_MESSAGES[errorCode] ?? fallbackMessage ?? IMPORT_ERROR_MESSAGES.UNKNOWN
}

function normalizeNullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeImportedFields(payload = {}) {
  return {
    company: normalizeNullableString(payload.company),
    role: normalizeNullableString(payload.role),
    location: normalizeNullableString(payload.location),
    salaryMin: normalizeNullableNumber(payload.salaryMin),
    salaryMax: normalizeNullableNumber(payload.salaryMax),
    jobDescription: normalizeNullableString(payload.jobDescription),
    keySkills: Array.isArray(payload.keySkills)
      ? payload.keySkills.filter(skill => typeof skill === 'string' && skill.trim()).map(skill => skill.trim()).slice(0, 8)
      : [],
  }
}

export function mapImportPayloadToResult(payload, sourceUrl) {
  const errorCode = payload?.error
  if (errorCode) {
    return {
      success: false,
      fields: null,
      errorCode,
      errorMessage: mapImportError(errorCode),
      sourceUrl,
    }
  }

  const fields = normalizeImportedFields(payload)
  if (!fields.role) {
    return {
      success: false,
      fields,
      errorCode: 'MISSING_ROLE',
      errorMessage: mapImportError('MISSING_ROLE'),
      sourceUrl,
    }
  }

  return {
    success: true,
    fields,
    errorCode: null,
    errorMessage: null,
    sourceUrl,
  }
}
