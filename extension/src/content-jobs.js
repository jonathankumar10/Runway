import { createRunwayPanel } from './runway-panel.js'

function waitForAnyElement(selectors, timeout = 8000) {
  return new Promise((resolve) => {
    const check = () => {
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el) return el
      }
      return null
    }
    const found = check()
    if (found) { resolve(found); return }
    const observer = new MutationObserver(() => {
      const el = check()
      if (el) { observer.disconnect(); resolve(el) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

function isOnJobPage() {
  return (
    /\/jobs\/view\//.test(location.pathname) ||
    (/\/jobs\/search/.test(location.pathname) && new URLSearchParams(location.search).has('currentJobId'))
  )
}

function getDetailsPane() {
  // Try known LinkedIn class patterns for the job detail panel first.
  for (const sel of [
    '[class*="job-details-jobs-unified-top-card"]',
    '[class*="jobs-unified-top-card"]',
    '[class*="jobs-details__main"]',
    '.jobs-details',
    '[data-job-id]',
  ]) {
    const el = document.querySelector(sel)
    if (el?.querySelector('h1')) return el
  }

  // Walk up from h1 until we find a container that also has a company link.
  const h1 = document.querySelector('main h1, [role="main"] h1, h1')
  if (h1) {
    let el = h1.parentElement
    for (let i = 0; i < 12; i++) {
      if (!el || el === document.body) break
      if (el.querySelector('a[href*="/company/"]') && el.querySelectorAll('p, li').length > 1) return el
      el = el.parentElement
    }
  }

  return document
}

function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanLinkedInCompany(value) {
  return stripLinkedInFollowerCount(cleanLine(value))
    .replace(/\s*\d+\s+connection(?:s)?\b.*$/i, '')
    .replace(/\s*\d+\s+month(?:s)?\s+ago\b.*$/i, '')
    .replace(/\s*over\s+\d+.*$/i, '')
    .replace(/\s*promoted by.*$/i, '')
    .replace(/\s*responses managed.*$/i, '')
    .trim()
}

function stripLinkedInFollowerCount(value) {
  const match = value.match(/(\d[\d,]*)\s+followers\b.*$/i)
  if (!match) return value

  const matchIndex = match.index ?? -1
  if (matchIndex <= 0) return value.slice(0, matchIndex).trim()

  const before = value.slice(0, matchIndex)
  const count = match[1]
  const startsAfterLetter = /[A-Za-z]$/.test(before)

  // LinkedIn can concatenate company names and follower counts, e.g.
  // "A114,542 followers" for company "A1". Preserve a likely trailing
  // company digit when the count begins immediately after a letter.
  if (startsAfterLetter && count.includes(',')) {
    const [leadingGroup] = count.split(',')
    if (leadingGroup.length > 1) {
      return `${before}${leadingGroup.slice(0, -2)}`.trim()
    }
  }

  return before.trim()
}

function extractCompanyFromJobCard(card) {
  if (!card) return ''
  const explicit =
    card.querySelector('[class*="job-card-container__primary-description"], [class*="company-name"], a[href*="/company/"]')?.textContent
  if (explicit) return cleanLinkedInCompany(explicit)

  const lines = (card.innerText || '')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const roleLine = lines.find(line => /engineer|developer|manager|designer|analyst|intern|lead|director|specialist/i.test(line))
  return cleanLinkedInCompany(lines.find(line =>
    line !== roleLine &&
    !/viewed|saved|easy apply|applicant|benefit|connection|medical|dental|401|remote|hybrid|on-site/i.test(line)
  ) || '')
}

function findCompanyLogo(scope, company = '') {
  const companyName = cleanLine(company).toLowerCase()
  const images = [...(scope || document).querySelectorAll('img[src]')]
  return images.find(img => {
    const src = img.src || ''
    const alt = cleanLine(img.alt).toLowerCase()
    const className = cleanLine(img.className).toLowerCase()
    const ancestorText = cleanLine(img.closest('li, article, section, div')?.innerText).toLowerCase()
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height

    if (!src.includes('media.licdn.com')) return false
    if (/profile-displayphoto|ghost-person|presence-entity|messaging|member|avatar/i.test(src + ' ' + alt + ' ' + className)) return false
    if (img.closest('a[href*="/in/"], [class*="presence"], [class*="messaging"], [class*="people"]')) return false
    if (width && height && (width < 24 || height < 24)) return false

    if (companyName && (alt.includes(companyName) || ancestorText.includes(companyName))) return true
    return /logo|company|organization|jobs-unified-top-card|entity|artdeco-entity-image/i.test(src + ' ' + alt + ' ' + className)
  })?.src || ''
}

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

  return uniqueElements(candidates)
    .map(card => ({ card, score: scoreLinkedInJobCard(card, jobId, role, company) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.card || null
}

function uniqueElements(elements) {
  return [...new Set(elements)]
}

function scoreLinkedInJobCard(card, jobId, role = '', company = '') {
  const rect = card.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 40) return 0

  const className = cleanLine(card.className).toLowerCase()
  const text = cleanLine(card.innerText).toLowerCase()
  const normalizedRole = cleanLine(role).toLowerCase()
  const normalizedCompany = cleanLine(company).toLowerCase()
  const ariaSelected = card.getAttribute('aria-selected') === 'true'
  const current = card.getAttribute('aria-current') === 'true'
  const isLeftColumn = rect.right < window.innerWidth * 0.62
  const hasJobId = jobId && (
    card.getAttribute('data-job-id') === jobId ||
    card.getAttribute('data-occludable-job-id') === jobId ||
    Boolean(card.querySelector(`a[href*="/jobs/view/${jobId}"], a[href*="currentJobId=${jobId}"]`))
  )

  const textMatchesCurrentJob =
    (normalizedRole && text.includes(normalizedRole)) ||
    (normalizedCompany && text.includes(normalizedCompany))

  if (!isLeftColumn && !hasJobId) return 0

  let score = 0
  if (hasJobId) score += 20
  if (isLeftColumn) score += 12
  if (textMatchesCurrentJob) score += 18
  if (normalizedRole && normalizedCompany && text.includes(normalizedRole) && text.includes(normalizedCompany)) score += 10
  if (ariaSelected || current || /active|selected|highlighted/.test(className)) score += 10
  if (card.querySelector('img[src*="media.licdn.com"]')) score += 4
  if (card.matches('li, [class*="jobs-search-results__list-item"]')) score += 2

  return score
}

// Text patterns injected by third-party extensions (Jobright, etc.) that should
// never be mistaken for a job title or location.
const INJECTED_TEXT_RE = /\b(low|medium|high|poor|great)\s+match\b|match for this job|be an early applicant|jobright|easy apply/i

function extractTopCardDetails(pane) {
  const topCard =
    pane.querySelector('[class*="job-details-jobs-unified-top-card"], [class*="jobs-unified-top-card"]') ||
    pane.querySelector('h1')?.closest('section, div') ||
    pane

  // Use the first h1 that isn't injected third-party text.
  const roleH1 = [...topCard.querySelectorAll('h1')].find(el => {
    const t = cleanLine(el.textContent)
    return t.length > 1 && !INJECTED_TEXT_RE.test(t)
  })
  const role = cleanLine(roleH1?.textContent)

  // Company: the /company/ link is the most authoritative source.
  const companyLink = topCard.querySelector('a[href*="/company/"]')
  const company = cleanLinkedInCompany(companyLink?.textContent || '')

  // Location: find the subtitle dot-separated line, skipping injected/noisy lines.
  const lines = (topCard.innerText || '').split('\n').map(cleanLine).filter(Boolean)
  const dotLine = lines.find(line =>
    line.includes(' · ') &&
    !INJECTED_TEXT_RE.test(line) &&
    !/^beta\b/i.test(line) &&
    !/easy apply|applicants|save/i.test(line)
  )

  let jobLocation = ''
  if (dotLine) {
    const parts = dotLine.split(' · ').map(s => cleanLine(s))
    // The first part is typically the company name; look for the first location-like part.
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

async function expandDescription() {
  // Click "See more" / "Show more" to get full JD text.
  const btn = [...document.querySelectorAll('button')]
    .find(b => /see more|show more/i.test(b.textContent))
  if (btn) {
    btn.click()
    await new Promise(r => setTimeout(r, 400))
  }
}

function extractJob() {
  const pane = getDetailsPane()
  const topCard = extractTopCardDetails(pane)

  // Role: LinkedIn wraps the job title in an <a href="/jobs/view/{jobId}">
  const jobId = new URLSearchParams(location.search).get('currentJobId')
  const preliminaryJobCard = getCurrentJobCard(jobId, topCard.role, topCard.company)
  const cardCompany = extractCompanyFromJobCard(preliminaryJobCard)

  // The anchor pointing to the specific job view URL is the most reliable title source.
  const jobTitleLink =
    (jobId && pane.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    (jobId && document.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    pane.querySelector('a[href*="/jobs/view/"]')

  // Prioritise the URL-linked title (immune to third-party injections), then the
  // top-card h1, then a filtered h1/h2 scan.
  const role =
    cleanLine(jobTitleLink?.textContent).replace(INJECTED_TEXT_RE, '').trim() ||
    topCard.role ||
    [...pane.querySelectorAll('h1, h2')]
      .map(h => cleanLine(h.textContent))
      .find(t => t.length > 2 && !/^\d+$/.test(t) && !INJECTED_TEXT_RE.test(t) && !/^about the job$/i.test(t))

  // Company: the /company/ link inside the detail pane
  const company =
    cardCompany ||
    cleanLinkedInCompany(topCard.company) ||
    cleanLinkedInCompany(pane.querySelector('a[href*="/company/"]')?.textContent) ||
    cleanLinkedInCompany(document.querySelector('a[href*="/company/"]')?.textContent)

  // Location: use the top card extraction; fall back to work-arrangement text.
  let jobLocation = topCard.location
  if (!jobLocation && pane !== document) {
    jobLocation = (pane.innerText || '').match(/\b(Remote|Hybrid|On-site)\b/i)?.[0] || ''
  }

  // Description: prefer known LinkedIn description containers (less likely to include
  // third-party injected nodes).
  let jobDescription = ''
  const descEl =
    document.querySelector('[class*="jobs-description__content"]') ||
    pane.querySelector('[class*="jobs-description"]') ||
    document.querySelector('[class*="jobs-description"]') ||
    pane.querySelector('[class*="description__text"]') ||
    document.querySelector('[class*="description__text"]')
  if (descEl) jobDescription = (descEl.innerText || '').trim().slice(0, 5000)

  // Fallback: walk up from "About the job" heading.
  if (!jobDescription) {
    const aboutHeading = [...pane.querySelectorAll('*')]
      .find(el => el.children.length === 0 && /^about the job$/i.test(el.textContent.trim()))
    if (aboutHeading) {
      let el = aboutHeading.parentElement
      for (let i = 0; i < 6; i++) {
        if (!el || el === document.body) break
        const text = el.innerText?.trim() || ''
        if (text.length > 100) {
          jobDescription = text.replace(/^about the job\s*/i, '').trim().slice(0, 5000)
          break
        }
        el = el.parentElement
      }
    }
  }

  const jobUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href
  const currentJobCard = getCurrentJobCard(jobId, role, company)
  const logoUrl =
    findCompanyLogo(currentJobCard, company) ||
    topCard.logoUrl ||
    findCompanyLogo(pane, company)

  // Posted time — look for relative time text near the top card
  const postedEl = [...(pane === document ? document : pane).querySelectorAll('span, li')]
    .find(el => /\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i.test(el.textContent) && el.children.length === 0)
  const postedAt = cleanLine(postedEl?.textContent?.match(/\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i)?.[0] || '')

  // Applicant count
  const applicantEl = [...(pane === document ? document : pane).querySelectorAll('span, li')]
    .find(el => /\b(over\s+)?[\d,]+\s+(people|applicants?)\b/i.test(el.textContent) && el.children.length === 0)
  const applicantCount = cleanLine(applicantEl?.textContent?.match(/\b(over\s+[\d,]+|[\d,]+)\s+(people|applicants?)\b/i)?.[0] || '')

  // Job-type and work-arrangement tags — LinkedIn renders these as pill buttons or list items.
  const tagScope = pane === document ? document : pane
  const tagEls = tagScope.querySelectorAll(
    '[class*="job-details-preferences"] li, [class*="job-type"] li, ' +
    '[class*="workplace-type"] li, [class*="job-insight"] li, ' +
    '[class*="jobs-unified-top-card__job-insight"] span, ' +
    '[class*="ui-label"] li'
  )
  const tags = [...tagEls]
    .map(el => cleanLine(el.textContent))
    .filter(t => t && /remote|hybrid|on-?site|full[-\s]?time|part[-\s]?time|contract|internship/i.test(t) && t.length < 35)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 4)

  // Salary — LinkedIn shows it as a prominent line in the detail pane header area
  const salaryScope = pane === document ? document : pane
  const salaryEl =
    salaryScope.querySelector('[class*="salary"], [class*="compensation"]') ||
    [...salaryScope.querySelectorAll('span, li, div')]
      .find(el =>
        /\$[\d,]+[kK]?/i.test(el.textContent) &&
        el.children.length === 0 &&
        el.textContent.length < 70
      )
  const salary = salaryEl?.textContent?.trim()
    ?.match(/\$[\d,]+[kK]?(?:\s*[-–—]\s*\$[\d,]+[kK]?)?\s*(?:\/\s*(?:yr|year|hour|hr|annual))?/i)?.[0]?.trim() || ''

  // Connections working at the company
  const connectionEl = [...salaryScope.querySelectorAll('span, li, a')]
    .find(el => /\b\d+\s+(school\s+alumni|company\s+alumni|connection|people)\b.*\bwork\b/i.test(el.textContent) && el.textContent.length < 80)
  const connections = cleanLine(connectionEl?.textContent || '')

  return { role, company, location: jobLocation, jobDescription, jobUrl, logoUrl, postedAt, applicantCount, salary, connections, tags }
}

function extractJobsFromListings() {
  const anchors = [...document.querySelectorAll('a[href*="/jobs/view/"]')]
  return anchors
    .map(anchor => {
      const url = new URL(anchor.href, location.origin)
      const match = url.pathname.match(/\/jobs\/view\/(\d+)/)
      const jobId = match?.[1] || url.searchParams.get('currentJobId')
      if (!jobId) return null

      const card = anchor.closest('li, [data-job-id], [class*="job-card"], [class*="jobs-search-results"]') || anchor.parentElement
      const role = anchor.textContent?.trim() || card?.querySelector('[class*="job-title"], strong')?.textContent?.trim() || ''
      const company = extractCompanyFromJobCard(card)
      const jobLocation =
        card?.querySelector('[class*="job-card-container__metadata"], [class*="job-card-container__metadata-item"], [class*="location"]')?.textContent?.trim() ||
        ''
      const logoUrl = findCompanyLogo(card, company)

      // Posted time from the card footer
      const timeEl = card?.querySelector('time, [class*="listed-date"], [class*="listdate"]') ||
        [...(card?.querySelectorAll('span, li') || [])].find(el =>
          /\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i.test(el.textContent) && el.children.length === 0
        )
      const postedAt = cleanLine(timeEl?.textContent?.match(/\b\d+\s+(minute|hour|day|week|month)s?\s+ago\b/i)?.[0] || '')

      // Work arrangement from the card metadata
      const metaText = cleanLine(card?.querySelector('[class*="metadata"]')?.textContent || '')
      const arrangement = /(remote|hybrid|on-?site)/i.exec(jobLocation + ' ' + metaText)?.[1] || ''

      // Salary — LinkedIn renders it directly in card metadata (e.g. "$146K/yr–$213K/yr")
      const salaryText = [...(card?.querySelectorAll('span, li, div') || [])]
        .map(el => cleanLine(el.textContent))
        .find(t => /\$[\d,]+[kK]?/i.test(t) && t.length < 60 && !/^\d+$/.test(t))
      const salary = salaryText?.match(/\$[\d,]+[kK]?(?:\s*[-–—]\s*\$[\d,]+[kK]?)?\s*(?:\/\s*(?:yr|year|hour|hr|annual))?/i)?.[0]?.trim() || ''

      // Employee count / connections
      const connectionEl = [...(card?.querySelectorAll('span, li') || [])]
        .find(el => /\b\d+\s+(school\s+alumni|company\s+alumni|connection|people)\b/i.test(el.textContent) && el.children.length === 0)
      const connections = cleanLine(connectionEl?.textContent || '')

      return {
        role,
        company,
        location: jobLocation,
        jobDescription: '',
        jobUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
        logoUrl,
        atsPlatform: 'linkedin',
        postedAt,
        salary,
        connections,
        tags: arrangement ? [arrangement.charAt(0).toUpperCase() + arrangement.slice(1).toLowerCase()] : [],
      }
    })
    .filter(job => job?.role || job?.jobUrl)
}

function getDiscoverableJobs() {
  if (isOnJobPage()) {
    const job = extractJob()
    return job.role || job.jobDescription ? [{ ...job, atsPlatform: 'linkedin' }] : extractJobsFromListings()
  }
  return extractJobsFromListings()
}

async function addDiscoveredJob(job) {
  let payload = job
  if (isOnJobPage() && stripUrl(job.jobUrl) === stripUrl(location.href)) {
    await expandDescription()
    payload = { ...extractJob(), atsPlatform: 'linkedin' }
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

function stripUrl(url) {
  return String(url || '').replace(/[?#].*$/, '').replace(/\/$/, '')
}

function sendRuntimeMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    throw new Error('Extension was reloaded. Refresh this tab and try again.')
  }
  return chrome.runtime.sendMessage(message)
}

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

function showBtn() {
  const btn = document.getElementById('runway-job-btn')
  if (btn) btn.style.display = 'none'
  runwayPanel.refresh()
}

function hideBtn() {
  const btn = document.getElementById('runway-job-btn')
  if (btn) btn.style.display = 'none'
  runwayPanel.refresh()
}

async function handleNavigation() {
  console.log('[Runway] handleNavigation, isJobPage:', isOnJobPage(), location.href)
  if (!isOnJobPage()) { hideBtn(); return }
  await waitForAnyElement([
    '[class*="job-details-jobs-unified-top-card__job-title"]',
    '[class*="jobs-unified-top-card__job-title"]',
    '[class*="top-card-layout__title"]',
    '[class*="jobs-description"]',
    'h1',
  ])
  console.log('[Runway] job content detected, showing button')
  if (isOnJobPage()) showBtn()
}

// Initial load
console.log('[Runway] content-jobs loaded, url:', location.href, 'isJobPage:', isOnJobPage())
handleNavigation()

// SPA navigation watcher
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(handleNavigation, 1000)
  } else {
    runwayPanel.refresh(700)
  }
}).observe(document.body, { childList: true, subtree: true })
