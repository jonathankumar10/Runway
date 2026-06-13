export const DESCRIPTION_LIMIT = 5000

/** Collapses whitespace and trims a string. Optionally truncates to a character limit. */
export function cleanText(value, limit = null) {
  const text = typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
  return limit ? text.slice(0, limit) : text
}

/** Returns 'linkedin' if the URL is a LinkedIn URL, otherwise empty string. */
export function detectPlatformFromUrl(url) {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'www.linkedin.com' || hostname === 'linkedin.com') return 'linkedin'
  } catch {
    return ''
  }
  return ''
}

/** Returns true if the job payload has enough data to be worth saving. */
export function hasEnoughJobData(job) {
  return Boolean(cleanText(job?.role) || cleanText(job?.jobDescription))
}

/**
 * Guesses a company domain from the company name (e.g. "Stripe Inc" → "stripe.com").
 * Used as a fallback for logo lookup when no explicit domain is available.
 */
export function inferCompanyDomain({ company = '' } = {}) {
  const normalizedCompany = cleanText(company)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|technologies|technology|systems|group)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')
  return normalizedCompany ? `${normalizedCompany}.com` : ''
}

/** Builds a Google Favicons URL for a given domain, used to display company logos. */
export function buildLogoUrl(domain) {
  const cleaned = cleanText(domain).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return cleaned ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(cleaned)}` : ''
}

/**
 * Parses a salary range from free text (e.g. "$120K – $160K/yr").
 * Returns salaryMin and salaryMax as integers in full dollar amounts, or null if not found.
 */
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

/** Normalizes a raw ADD_JOB message payload into the shape stored in Firestore. */
export function normalizeJobPayload(payload = {}) {
  const jobUrl = cleanText(payload.jobUrl)
  const atsPlatform = cleanText(payload.atsPlatform) || detectPlatformFromUrl(jobUrl)
  const inferredSalary = extractSalaryRange(payload.jobDescription)
  const company = cleanText(payload.company)
  const logoDomain = inferCompanyDomain({ company })

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
