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

export function inferCompanyDomain({ company = '', jobUrl = '', atsPlatform = '' } = {}) {
  const fromUrl = domainFromAtsUrl(jobUrl, atsPlatform)
  if (fromUrl) return fromUrl

  const normalizedCompany = cleanText(company)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|technologies|technology|systems|group)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')

  return normalizedCompany ? `${normalizedCompany}.com` : ''
}

export function buildLogoUrl(domain) {
  const cleaned = cleanText(domain).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return cleaned ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(cleaned)}` : ''
}

function domainFromAtsUrl(jobUrl, atsPlatform) {
  try {
    const url = new URL(jobUrl)
    const segments = url.pathname.split('/').filter(Boolean)

    switch (atsPlatform || detectPlatformFromUrl(jobUrl)) {
      case 'greenhouse':
      case 'lever':
      case 'ashby':
      case 'smartrecruiters':
        return segments[0] ? `${segments[0].toLowerCase()}.com` : ''
      case 'bamboohr':
      case 'workday':
      case 'taleo':
        return url.hostname.split('.')[0] ? `${url.hostname.split('.')[0].replace(/^careers-/, '').toLowerCase()}.com` : ''
      case 'icims':
        return url.hostname.split('.')[0] ? `${url.hostname.split('.')[0].replace(/^careers-/, '').toLowerCase()}.com` : ''
      default:
        return ''
    }
  } catch {
    return ''
  }
}

export function extractSalaryRange(text) {
  const source = cleanText(text)
  if (!source) return { salaryMin: null, salaryMax: null }

  const salaryPattern = /(?:\$|USD\s*)\s*(\d{2,3}\s*k|\d{2,3}(?:,\d{3})?)(?:\s*(?:-|–|—|to)\s*(?:\$|USD\s*)?\s*(\d{2,3}\s*k|\d{2,3}(?:,\d{3})?))?/i
  const match = source.match(salaryPattern)
  if (!match) return { salaryMin: null, salaryMax: null }

  const first = parseSalaryNumber(match[1])
  const second = parseSalaryNumber(match[2])
  if (!first) return { salaryMin: null, salaryMax: null }

  return {
    salaryMin: first,
    salaryMax: second && second >= first ? second : null,
  }
}

function parseSalaryNumber(value) {
  if (!value) return null
  const normalized = String(value).toLowerCase().replace(/[$,\s]/g, '')
  const number = Number(normalized.replace(/k$/, ''))
  if (!Number.isFinite(number)) return null
  return normalized.endsWith('k') || number < 1000 ? Math.round(number * 1000) : Math.round(number)
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeJobPayload(payload = {}) {
  const jobUrl = cleanText(payload.jobUrl)
  const atsPlatform = cleanText(payload.atsPlatform) || detectPlatformFromUrl(jobUrl)
  const inferredSalary = extractSalaryRange(payload.jobDescription)
  const company = cleanText(payload.company)
  const logoDomain = inferCompanyDomain({ company, jobUrl, atsPlatform })

  return {
    company,
    role: cleanText(payload.role),
    jobUrl,
    logoUrl: buildLogoUrl(logoDomain),
    location: cleanText(payload.location),
    jobDescription: cleanText(payload.jobDescription, DESCRIPTION_LIMIT),
    salaryMin: normalizeNullableNumber(payload.salaryMin) ?? inferredSalary.salaryMin,
    salaryMax: normalizeNullableNumber(payload.salaryMax) ?? inferredSalary.salaryMax,
    keySkills: [],
    stage: 'saved',
    source: 'extension',
    importMethod: 'extension',
    atsPlatform,
    notes: '',
    createdAt: new Date(),
  }
}
