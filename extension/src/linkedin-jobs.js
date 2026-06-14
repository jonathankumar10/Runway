import { createRunwayPanel } from './runway-panel.js'
import { cleanLine, cleanLinkedInCompany, INJECTED_TEXT_RE } from './linkedin-utils.js'

/**
 * Waits for any one of the given CSS selectors to appear in the DOM.
 * Needed because LinkedIn is a SPA — content is injected after navigation,
 * not present when the script first runs.
 */
function waitForAnyElement(selectors, timeout = 8000) {
  return new Promise((resolve) => {
    const findMatch = () => {
      for (const selector of selectors) {
        const el = document.querySelector(selector)
        if (el) return el
      }
      return null
    }

    const immediateMatch = findMatch()
    if (immediateMatch) { resolve(immediateMatch); return }

    const observer = new MutationObserver(() => {
      const el = findMatch()
      if (el) { observer.disconnect(); resolve(el) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

/**
 * Returns true if the current URL is a LinkedIn job detail page.
 * Covers both direct links (/jobs/view/{id}) and search pages with a selected job (?currentJobId=).
 */
function isOnJobPage() {
  if (/\/jobs\/view\//.test(location.pathname)) return true
  return /\/jobs\//.test(location.pathname) && new URLSearchParams(location.search).has('currentJobId')
}

/**
 * Extracts the LinkedIn job ID from the current URL.
 * Handles both /jobs/view/{id} paths and ?currentJobId= query params.
 */
function getPageJobId() {
  const directMatch = location.pathname.match(/\/jobs\/view\/(\d+)/)
  if (directMatch) return directMatch[1]
  return new URLSearchParams(location.search).get('currentJobId') || ''
}

/**
 * Finds the right-hand job detail container in the DOM.
 * Tries known LinkedIn class patterns first, then walks up from the h1.
 * Falls back to the full document if no specific container is found.
 */
function getDetailsPane() {
  for (const selector of [
    '[class*="job-details-jobs-unified-top-card"]',
    '[class*="jobs-unified-top-card"]',
    '[class*="jobs-details__main"]',
    '.jobs-details',
    '[data-job-id]',
  ]) {
    const el = document.querySelector(selector)
    if (el?.querySelector('h1')) return el
  }

  // Walk up from the h1 until we find a container that also holds a company link.
  const heading = document.querySelector('main h1, [role="main"] h1, h1')
  if (heading) {
    let el = heading.parentElement
    for (let i = 0; i < 12; i++) {
      if (!el || el === document.body) break
      if (el.querySelector('a[href*="/company/"]') && el.querySelectorAll('p, li').length > 1) return el
      el = el.parentElement
    }
  }

  return document
}

/**
 * Extracts the company name from a job card in the left-hand list.
 * Tries explicit class selectors first, then falls back to scanning
 * the card's text lines and filtering out known noise words.
 */
function extractCompanyFromJobCard(card) {
  if (!card) return ''

  const explicitEl = card.querySelector(
    '[class*="job-card-container__primary-description"], [class*="company-name"], a[href*="/company/"]'
  )
  if (explicitEl) return cleanLinkedInCompany(explicitEl.textContent)

  const lines = (card.innerText || '').split('\n').map(cleanLine).filter(Boolean)
  const titleLine = lines.find(line =>
    /engineer|developer|manager|designer|analyst|intern|lead|director|specialist/i.test(line)
  )

  return cleanLinkedInCompany(lines.find(line =>
    line !== titleLine &&
    !/viewed|saved|easy apply|applicant|benefit|connection|medical|dental|401|remote|hybrid|on-site/i.test(line)
  ) || '')
}

/**
 * Returns true if an image element could plausibly be a company logo.
 * Filters out profile photos, avatars, tiny icons, and non-LinkedIn CDN images.
 */
function isLogoCandidate(img) {
  const src = img.src || ''
  const alt = cleanLine(img.alt).toLowerCase()
  const className = cleanLine(img.className).toLowerCase()
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height

  if (!src.includes('media.licdn.com')) return false
  if (/profile-displayphoto|ghost-person|presence-entity|messaging|member|avatar/i.test(src + ' ' + alt + ' ' + className)) return false
  if (img.closest('a[href*="/in/"], [class*="presence"], [class*="messaging"], [class*="people"]')) return false
  if (width && height && (width < 24 || height < 24)) return false
  return true
}

/**
 * Returns true if an image element appears to belong to the given company,
 * either by alt text, ancestor text, or logo-related class/src patterns.
 */
function logoMatchesCompany(img, companyName) {
  const src = img.src || ''
  const alt = cleanLine(img.alt).toLowerCase()
  const className = cleanLine(img.className).toLowerCase()
  const ancestorText = cleanLine(img.closest('li, article, section, div')?.innerText).toLowerCase()

  if (companyName && (alt.includes(companyName) || ancestorText.includes(companyName))) return true
  return /logo|company|organization|jobs-unified-top-card|entity|artdeco-entity-image/i.test(src + ' ' + alt + ' ' + className)
}

/** Finds and returns the src URL of the company logo within a given DOM scope. */
function findCompanyLogo(scope, company = '') {
  const companyName = cleanLine(company).toLowerCase()
  const images = [...(scope || document).querySelectorAll('img[src]')]
  return images.find(img => isLogoCandidate(img) && logoMatchesCompany(img, companyName))?.src || ''
}

/**
 * Finds the job card in the left-hand list that corresponds to the currently viewed job.
 * Collects candidates from data attributes and aria state, then picks the highest scorer.
 */
function getCurrentJobCard(jobId, role = '', company = '') {
  const cardsFromJobLinks = jobId
    ? [...document.querySelectorAll(`a[href*="/jobs/view/${jobId}"], a[href*="currentJobId=${jobId}"]`)]
        .map(link => link.closest('li, [data-job-id], [data-occludable-job-id], [class*="job-card"], [class*="jobs-search-results__list-item"]'))
        .filter(Boolean)
    : []

  const candidates = [
    ...(jobId ? document.querySelectorAll(`[data-job-id="${jobId}"], [data-occludable-job-id="${jobId}"]`) : []),
    ...cardsFromJobLinks,
    ...document.querySelectorAll('[aria-selected="true"], [aria-current="true"], li[class*="active"], li[class*="selected"], [class*="jobs-search-results__list-item"]'),
  ]

  return dedupeElements(candidates)
    .map(card => ({ card, score: scoreJobCard(card, jobId, role, company) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.card || null
}

/** Removes duplicate DOM elements from an array. */
function dedupeElements(elements) {
  return [...new Set(elements)]
}

/**
 * Scores a candidate job card on how likely it is to be the currently selected job.
 * Higher score = better match. Returns 0 to disqualify cards that are off-screen
 * or in the wrong column (LinkedIn shows the list on the left, detail on the right).
 */
function scoreJobCard(card, jobId, role = '', company = '') {
  const rect = card.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 40) return 0

  const cardClassName = cleanLine(card.className).toLowerCase()
  const cardText = cleanLine(card.innerText).toLowerCase()
  const normalizedRole = cleanLine(role).toLowerCase()
  const normalizedCompany = cleanLine(company).toLowerCase()
  const isAriaSelected = card.getAttribute('aria-selected') === 'true'
  const isAriaCurrent = card.getAttribute('aria-current') === 'true'
  const isInLeftColumn = rect.right < window.innerWidth * 0.62
  const hasMatchingJobId = jobId && (
    card.getAttribute('data-job-id') === jobId ||
    card.getAttribute('data-occludable-job-id') === jobId ||
    Boolean(card.querySelector(`a[href*="/jobs/view/${jobId}"], a[href*="currentJobId=${jobId}"]`))
  )

  const textMatchesJob =
    (normalizedRole && cardText.includes(normalizedRole)) ||
    (normalizedCompany && cardText.includes(normalizedCompany))

  // Cards not in the left column and without a matching job ID are not the right card.
  if (!isInLeftColumn && !hasMatchingJobId) return 0

  let score = 0
  if (hasMatchingJobId) score += 20
  if (isInLeftColumn) score += 12
  if (textMatchesJob) score += 18
  if (normalizedRole && normalizedCompany && cardText.includes(normalizedRole) && cardText.includes(normalizedCompany)) score += 10
  if (isAriaSelected || isAriaCurrent || /active|selected|highlighted/.test(cardClassName)) score += 10
  if (card.querySelector('img[src*="media.licdn.com"]')) score += 4
  if (card.matches('li, [class*="jobs-search-results__list-item"]')) score += 2

  return score
}

/**
 * Scrapes role, company, location, and logo from the top card area of the job detail pane.
 * Used as a preliminary pass — extractJob() refines these further with card-level data.
 */
function extractTopCardDetails(pane) {
  const topCard =
    pane.querySelector('[class*="job-details-jobs-unified-top-card"], [class*="jobs-unified-top-card"]') ||
    pane.querySelector('h1')?.closest('section, div') ||
    pane

  const titleHeading = [...topCard.querySelectorAll('h1')].find(el => {
    const text = cleanLine(el.textContent)
    return text.length > 1 && !INJECTED_TEXT_RE.test(text)
  })
  const role = cleanLine(titleHeading?.textContent)

  // The /company/ anchor is the most authoritative source for the company name.
  const companyLink = topCard.querySelector('a[href*="/company/"]')
  const company = cleanLinkedInCompany(companyLink?.textContent || '')

  // Location lives in the dot-separated subtitle line, e.g. "Acme · San Francisco, CA · Hybrid".
  const lines = (topCard.innerText || '').split('\n').map(cleanLine).filter(Boolean)
  const subtitleLine = lines.find(line =>
    line.includes(' · ') &&
    !INJECTED_TEXT_RE.test(line) &&
    !/^beta\b/i.test(line) &&
    !/easy apply|applicants|save/i.test(line)
  )

  let jobLocation = ''
  if (subtitleLine) {
    const parts = subtitleLine.split(' · ').map(s => cleanLine(s))
    const locationPart = parts.find(p =>
      p &&
      !INJECTED_TEXT_RE.test(p) &&
      !/^\d/.test(p) &&
      !/^(actively[\s+]hiring|promoted|following|connections?)$/i.test(p) &&
      !/^(full[-\s]?time|part[-\s]?time|contract|internship|temporary)$/i.test(p) &&
      p !== company
    )
    if (locationPart) jobLocation = locationPart
  }

  const logoUrl = findCompanyLogo(topCard, company)
  return { role, company, location: jobLocation, logoUrl }
}

/**
 * Clicks LinkedIn's "See more" button in the description area so the full
 * text is rendered in the DOM before we scrape it.
 */
async function expandDescription() {
  const descriptionContainer =
    document.querySelector('#job-details') ||
    document.querySelector('[class*="jobs-description"]') ||
    document

  const showMoreButton = [...descriptionContainer.querySelectorAll('button, [role="button"]')]
    .find(btn => /see more|show more/i.test(btn.textContent))

  if (showMoreButton) {
    showMoreButton.click()
    await new Promise(resolve => setTimeout(resolve, 600))
  }
}

/**
 * Extracts the job title from the detail pane.
 * Prefers the URL-anchored title (immune to third-party text injections),
 * then the top-card h1, then a filtered heading scan.
 */
function extractRole(pane, jobId, topCardRole) {
  const jobTitleAnchor =
    (jobId && pane.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    (jobId && document.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    pane.querySelector('a[href*="/jobs/view/"]')

  return (
    cleanLine(jobTitleAnchor?.textContent).replace(INJECTED_TEXT_RE, '').trim() ||
    topCardRole ||
    [...pane.querySelectorAll('h1, h2')]
      .map(h => cleanLine(h.textContent))
      .find(t => t.length > 2 && !/^\d+$/.test(t) && !INJECTED_TEXT_RE.test(t) && !/^about the job$/i.test(t))
  )
}

/**
 * Extracts the company name for the current job.
 * Prioritises the job card (most specific), then the top card, then any /company/ link on the page.
 */
function extractCompany(pane, topCardCompany, jobCard) {
  return (
    extractCompanyFromJobCard(jobCard) ||
    cleanLinkedInCompany(topCardCompany) ||
    cleanLinkedInCompany(pane.querySelector('a[href*="/company/"]')?.textContent) ||
    cleanLinkedInCompany(document.querySelector('a[href*="/company/"]')?.textContent)
  )
}

/**
 * Extracts the job location.
 * Uses the top card value if present; falls back to a work-arrangement keyword in the pane text.
 */
function extractLocation(pane, topCardLocation) {
  if (topCardLocation) return topCardLocation
  if (pane !== document) return (pane.innerText || '').match(/\b(Remote|Hybrid|On-site)\b/i)?.[0] || ''
  return ''
}

/**
 * Extracts the full job description text, capped at 5000 characters.
 * Three-tier fallback: known description selectors → "About the job" heading walk-up → largest text block.
 */
/**
 * Walks a DOM subtree and produces structured plain text, preserving headings,
 * paragraphs, and list items as newline-separated content. More reliable than
 * innerText when LinkedIn uses flexbox or inline layouts that suppress newlines.
 */
function domToStructuredText(root) {
  const parts = []

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent
      if (t.trim()) parts.push(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tag = node.tagName.toLowerCase()
    if (['script', 'style', 'button', 'svg', 'noscript'].includes(tag)) return

    if (tag === 'li') {
      parts.push('\n• ')
      for (const child of node.childNodes) walk(child)
      return
    }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      parts.push('\n\n')
      for (const child of node.childNodes) walk(child)
      parts.push('\n')
      return
    }
    if (['p', 'div', 'section', 'article', 'br'].includes(tag)) {
      parts.push('\n')
    }

    for (const child of node.childNodes) walk(child)
  }

  walk(root)
  return parts.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function extractDescription(pane) {
  const descriptionEl =
    document.querySelector('#job-details') ||
    document.querySelector('[class*="jobs-description__content"]') ||
    document.querySelector('[class*="jobs-description-content"]') ||
    pane.querySelector('[class*="jobs-description"]') ||
    document.querySelector('[class*="jobs-description"]') ||
    pane.querySelector('[class*="description__text"]') ||
    document.querySelector('[class*="description__text"]')
  if (descriptionEl) return domToStructuredText(descriptionEl).slice(0, 5000)

  // Walk up from the "About the job" heading to find its parent content block.
  const root = pane === document ? document.body : pane
  const aboutHeading = [...root.querySelectorAll('*')]
    .find(el => el.children.length === 0 && /^about the job$/i.test(el.textContent.trim()))
  if (aboutHeading) {
    let el = aboutHeading.parentElement
    for (let i = 0; i < 8; i++) {
      if (!el || el === document.body) break
      const text = domToStructuredText(el)
      if (text.length > 200) return text.replace(/^about the job\s*/i, '').trim().slice(0, 5000)
      el = el.parentElement
    }
  }

  // Last resort: grab the largest text block in the detail pane that isn't the header.
  if (pane !== document) {
    const largestBlock = [...pane.querySelectorAll('div, section, article')]
      .filter(el => !el.querySelector('[class*="top-card"], [class*="unified-top-card"]'))
      .map(el => ({ el, length: domToStructuredText(el).length }))
      .filter(({ length }) => length > 200)
      .sort((a, b) => b.length - a.length)[0]
    if (largestBlock) return domToStructuredText(largestBlock.el).slice(0, 5000)
  }

  return ''
}

/**
 * Extracts the relative posted time (e.g. "3 days ago").
 * Tries a time element or date class first, then scans for the text pattern in leaf nodes.
 */
function extractPostedAt(scope) {
  const timeEl =
    scope?.querySelector('time, [class*="listed-date"], [class*="listdate"]') ||
    [...(scope?.querySelectorAll('span, li') || [])].find(el =>
      /\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i.test(el.textContent) && el.children.length === 0
    )
  return cleanLine(timeEl?.textContent?.match(/\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i)?.[0] || '')
}

/** Extracts the applicant count shown on a job posting (e.g. "Over 200 applicants"). */
function extractApplicantCount(scope) {
  const applicantEl = [...scope.querySelectorAll('span, li')]
    .find(el => /\b(over\s+)?[\d,]+\s+(people|applicants?)\b/i.test(el.textContent) && el.children.length === 0)
  return cleanLine(applicantEl?.textContent?.match(/\b(over\s+[\d,]+|[\d,]+)\s+(people|applicants?)\b/i)?.[0] || '')
}

/**
 * Extracts work arrangement and job type tags (e.g. "Remote", "Full-time", "Contract").
 * LinkedIn renders these as pill buttons or list items in several different class patterns.
 */
function extractTags(scope) {
  const tagElements = scope.querySelectorAll(
    '[class*="job-details-preferences"] li, [class*="job-type"] li, ' +
    '[class*="workplace-type"] li, [class*="job-insight"] li, ' +
    '[class*="jobs-unified-top-card__job-insight"] span, ' +
    '[class*="ui-label"] li'
  )
  return [...tagElements]
    .map(el => cleanLine(el.textContent))
    .filter(tag => tag && /remote|hybrid|on-?site|full[-\s]?time|part[-\s]?time|contract|internship/i.test(tag) && tag.length < 35)
    .filter((tag, index, arr) => arr.indexOf(tag) === index)
    .slice(0, 4)
}

/**
 * Extracts the salary range if LinkedIn displays one (e.g. "$120K/yr – $160K/yr").
 * Tries a salary/compensation class first, then scans leaf nodes for a dollar-amount pattern.
 */
function extractSalary(scope) {
  const salaryEl =
    scope.querySelector('[class*="salary"], [class*="compensation"]') ||
    [...scope.querySelectorAll('span, li, div')]
      .find(el => /\$[\d,]+[kK]?/i.test(el.textContent) && el.children.length === 0 && el.textContent.length < 70)
  return salaryEl?.textContent?.trim()
    ?.match(/\$[\d,]+[kK]?(?:\s*[-–—]\s*\$[\d,]+[kK]?)?\s*(?:\/\s*(?:yr|year|hour|hr|annual))?/i)?.[0]?.trim() || ''
}

/** Extracts the number of LinkedIn connections working at the company, if shown. */
function extractConnections(scope) {
  const connectionEl = [...scope.querySelectorAll('span, li, a')]
    .find(el =>
      /\b\d+\s+(school\s+alumni|company\s+alumni|connection|people)\b.*\bwork\b/i.test(el.textContent) &&
      el.textContent.length < 80
    )
  return cleanLine(connectionEl?.textContent || '')
}

/**
 * Orchestrates all field extractors to build a complete job object from the current detail pane.
 * Calls getCurrentJobCard twice: first with preliminary data to get the company name,
 * then again with the final role/company to find the best logo source.
 */
function extractJob() {
  const pane = getDetailsPane()
  const topCard = extractTopCardDetails(pane)
  const jobId = getPageJobId()
  const scope = pane === document ? document : pane

  const preliminaryCard = getCurrentJobCard(jobId, topCard.role, topCard.company)
  const role = extractRole(pane, jobId, topCard.role)
  const company = extractCompany(pane, topCard.company, preliminaryCard)

  const jobUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href
  const currentCard = getCurrentJobCard(jobId, role, company)
  const logoUrl =
    findCompanyLogo(currentCard, company) ||
    topCard.logoUrl ||
    findCompanyLogo(pane, company)

  return {
    role,
    company,
    location: extractLocation(pane, topCard.location),
    jobDescription: extractDescription(pane),
    jobUrl,
    logoUrl,
    postedAt: extractPostedAt(scope),
    applicantCount: extractApplicantCount(scope),
    tags: extractTags(scope),
    salary: extractSalary(scope),
    connections: extractConnections(scope),
  }
}

/**
 * Scrapes all visible job cards from a LinkedIn search or collections page.
 * Returns a lighter data set per card — no full description, since those require
 * clicking into each job individually.
 */
function extractJobsFromListings() {
  const jobAnchors = [...document.querySelectorAll('a[href*="/jobs/view/"]')]

  return jobAnchors
    .map(anchor => {
      const url = new URL(anchor.href, location.origin)
      const pathMatch = url.pathname.match(/\/jobs\/view\/(\d+)/)
      const jobId = pathMatch?.[1] || url.searchParams.get('currentJobId')
      if (!jobId) return null

      const card = anchor.closest('li, [data-job-id], [class*="job-card"], [class*="jobs-search-results"]') || anchor.parentElement
      const role = anchor.textContent?.trim() || card?.querySelector('[class*="job-title"], strong')?.textContent?.trim() || ''
      const company = extractCompanyFromJobCard(card)
      const jobLocation =
        card?.querySelector('[class*="job-card-container__metadata"], [class*="job-card-container__metadata-item"], [class*="location"]')?.textContent?.trim() ||
        ''
      const logoUrl = findCompanyLogo(card, company)
      const metaText = cleanLine(card?.querySelector('[class*="metadata"]')?.textContent || '')
      const workArrangement = /(remote|hybrid|on-?site)/i.exec(jobLocation + ' ' + metaText)?.[1] || ''

      return {
        role,
        company,
        location: jobLocation,
        jobDescription: '',
        jobUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
        logoUrl,
        atsPlatform: 'linkedin',
        postedAt: extractPostedAt(card),
        salary: extractSalary(card),
        connections: extractConnections(card),
        tags: workArrangement ? [workArrangement.charAt(0).toUpperCase() + workArrangement.slice(1).toLowerCase()] : [],
      }
    })
    .filter(job => job?.role || job?.jobUrl)
}

/**
 * Returns the set of jobs the panel should display for the current page.
 * On a job detail page: the single selected job (falls back to listings if extraction fails).
 * On a search/collections page: all visible job cards.
 */
function getDiscoverableJobs() {
  if (isOnJobPage()) {
    const job = extractJob()
    return job.role || job.jobDescription ? [{ ...job, atsPlatform: 'linkedin' }] : extractJobsFromListings()
  }
  return extractJobsFromListings()
}

/**
 * Handles the user clicking "Save" on a job in the Runway panel.
 * If saving the job that's currently open in the detail pane, first expands the
 * description so we capture the full text before extracting.
 */
async function addDiscoveredJob(job) {
  let payload = job

  if (isOnJobPage()) {
    const currentPageJobId = getPageJobId()
    const clickedJobId = String(job.jobUrl || '').match(/\/jobs\/view\/(\d+)/)?.[1] || ''

    if (!currentPageJobId || !clickedJobId || currentPageJobId === clickedJobId) {
      await expandDescription()
      payload = { ...extractJob(), atsPlatform: 'linkedin' }
    }
  }

  return sendRuntimeMessage({
    type: 'ADD_JOB',
    role: payload.role || '',
    company: payload.company || '',
    location: payload.location || '',
    jobDescription: payload.jobDescription || '',
    jobUrl: payload.jobUrl,
    atsPlatform: payload.atsPlatform || 'linkedin',
  })
}

/**
 * Sends a message to the extension background script.
 * Guards against the extension being reloaded mid-session, which invalidates chrome.runtime.id.
 */
function sendRuntimeMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    throw new Error('Extension was reloaded. Refresh this tab and try again.')
  }
  return chrome.runtime.sendMessage(message)
}

// Initialise the Runway floating panel. getContext() is called on every refresh
// so the panel always reflects the current page state.
const runwayPanel = createRunwayPanel({
  getContext: () => {
    const jobs = getDiscoverableJobs()
    return {
      visible: jobs.length > 0,
      mode: 'job',
      jobs,
      subtitle: isOnJobPage()
        ? 'Save this job and prepare your resume.'
        : 'Save detected jobs to Runway.',
    }
  },
  actions: {
    addJob: addDiscoveredJob,
  },
})

/**
 * Checks the current URL and shows or hides the Runway panel accordingly.
 * Waits for LinkedIn's job content to render before refreshing, since the page
 * is a SPA and content arrives after navigation, not on load.
 */
async function handleNavigation() {
  if (!isOnJobPage()) { runwayPanel.refresh(); return }

  await waitForAnyElement([
    '[class*="job-details-jobs-unified-top-card__job-title"]',
    '[class*="jobs-unified-top-card__job-title"]',
    '[class*="top-card-layout__title"]',
    '[class*="jobs-description"]',
    'h1',
  ])

  if (isOnJobPage()) runwayPanel.refresh()
}

handleNavigation()

// Watch for LinkedIn SPA navigations. URL changes trigger a full handleNavigation;
// DOM mutations without a URL change trigger a lighter panel refresh to keep state current.
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(handleNavigation, 1000)
  } else {
    runwayPanel.refresh(700)
  }
}).observe(document.body, { childList: true, subtree: true })
