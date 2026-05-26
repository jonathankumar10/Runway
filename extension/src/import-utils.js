export const DESCRIPTION_LIMIT = 5000

export function cleanText(value, limit = null) {
  const text = typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
  return limit ? text.slice(0, limit) : text
}

export function slugToName(slug) {
  return cleanText(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function detectPlatformFromUrl(url) {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'www.linkedin.com' || hostname === 'linkedin.com') return 'linkedin'
    if (hostname.includes('greenhouse.io')) return 'greenhouse'
    if (hostname === 'jobs.lever.co') return 'lever'
    if (hostname === 'jobs.ashbyhq.com') return 'ashby'
    if (hostname.includes('myworkdayjobs.com')) return 'workday'
    if (hostname.endsWith('.taleo.net')) return 'taleo'
    if (hostname.endsWith('.icims.com')) return 'icims'
    if (hostname.endsWith('.bamboohr.com')) return 'bamboohr'
    if (hostname === 'jobs.smartrecruiters.com') return 'smartrecruiters'
  } catch {
    return ''
  }
  return ''
}

export function hasEnoughJobData(job) {
  return Boolean(cleanText(job?.role) || cleanText(job?.jobDescription))
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeJobPayload(payload = {}) {
  const jobUrl = cleanText(payload.jobUrl)
  const atsPlatform = cleanText(payload.atsPlatform) || detectPlatformFromUrl(jobUrl)

  return {
    company: cleanText(payload.company),
    role: cleanText(payload.role),
    jobUrl,
    location: cleanText(payload.location),
    jobDescription: cleanText(payload.jobDescription, DESCRIPTION_LIMIT),
    salaryMin: normalizeNullableNumber(payload.salaryMin),
    salaryMax: normalizeNullableNumber(payload.salaryMax),
    keySkills: [],
    stage: 'saved',
    source: 'extension',
    importMethod: 'extension',
    atsPlatform,
    notes: '',
    createdAt: new Date(),
  }
}
