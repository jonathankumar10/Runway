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
  // Anchor on "About the job" then walk up until the container also includes
  // the top card (which has the company link and job title heading).
  const aboutHeading = [...document.querySelectorAll('h2, h3, span, div, p')]
    .find(el => el.children.length === 0 && /^about the job$/i.test(el.textContent.trim()))

  if (aboutHeading) {
    let el = aboutHeading.parentElement
    for (let i = 0; i < 16; i++) {
      if (!el || el === document.body) break
      if (el.querySelector('a[href*="/company/"]') && el.querySelectorAll('p, li').length > 1) return el
      el = el.parentElement
    }
  }

  // Fallback: walk up from Apply button until we find a container with both a
  // company link and heading elements.
  const applyBtn = [...document.querySelectorAll('button, a')]
    .find(b => /^Apply$/.test(b.textContent.trim()))
  if (applyBtn) {
    let el = applyBtn.parentElement
    for (let i = 0; i < 12; i++) {
      if (!el || el === document.body) break
      if (el.querySelector('a[href*="/company/"]') && el.querySelectorAll('h1, h2').length >= 1) return el
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

function extractTopCardDetails(pane) {
  const topCard =
    pane.querySelector('[class*="job-details-jobs-unified-top-card"], [class*="jobs-unified-top-card"]') ||
    pane.querySelector('h1')?.closest('section, div') ||
    pane

  const role = cleanLine(topCard.querySelector('h1')?.textContent)
  const lines = (topCard.innerText || '')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const companyLocationLine = lines.find(line =>
    line.includes(' · ') &&
    !/^beta\b/i.test(line) &&
    !/easy apply|applicants|save/i.test(line)
  )

  let company = ''
  let jobLocation = ''
  if (companyLocationLine) {
    const [companyPart, locationPart] = companyLocationLine.split(' · ')
    company = cleanLinkedInCompany(companyPart)
    jobLocation = cleanLine(locationPart)
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
  const jobTitleLink =
    (jobId && pane.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    (jobId && document.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    pane.querySelector('a[href*="/jobs/view/"]')
  const role =
    topCard.role ||
    jobTitleLink?.textContent?.trim() ||
    [...pane.querySelectorAll('h1, h2')]
      .map(h => h.textContent.trim())
      .find(t => t.length > 2 && !/^\d+$/.test(t) && !/notification/i.test(t) && !/^about the job$/i.test(t))

  // Company: the /company/ link inside the detail pane
  const company =
    cardCompany ||
    cleanLinkedInCompany(topCard.company) ||
    cleanLinkedInCompany(pane.querySelector('a[href*="/company/"]')?.textContent) ||
    cleanLinkedInCompany(document.querySelector('a[href*="/company/"]')?.textContent)

  // Location: find "About the job" heading, then look at sibling/ancestor text
  // for city/state patterns before the description block
  const companyLink = pane.querySelector('a[href*="/company/"]')
  let jobLocation = topCard.location || ''
  if (companyLink) {
    const parent = companyLink.closest('div, section, li') || companyLink.parentElement
    const parentText = parent?.textContent || ''
    // Location usually appears as "City, State" or "City, Country" in the top card
    const locMatch = parentText.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s*\((?:Remote|Hybrid|On-site)\))?)/)?.[1] ||
                     parentText.match(/(?:Remote|Hybrid|On-site)/i)?.[0]
    jobLocation = locMatch?.trim() || ''
  }

  // Description: find "About the job" heading then grab the following content
  const aboutHeading = [...pane.querySelectorAll('*')]
    .find(el => el.children.length === 0 && /^about the job$/i.test(el.textContent.trim()))
  let jobDescription = ''
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

  const snapshotLocation = jobDescription.match(/Location:\s*([^•\n]+?)(?:\s+About The Company|\s+Why you should|\s*$)/i)?.[1]
  if (!jobLocation && snapshotLocation) {
    jobLocation = snapshotLocation.replace(/\s*\|\s*/g, ' ').trim()
  }

  const jobUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href
  const currentJobCard = getCurrentJobCard(jobId, role, company)
  const logoUrl =
    findCompanyLogo(currentJobCard, company) ||
    topCard.logoUrl ||
    findCompanyLogo(pane, company)

  console.log('[Runway] pane found:', pane !== document)
  console.log('[Runway] extracted:', { role, company, jobLocation, descLen: jobDescription.length })
  return { role, company, location: jobLocation, jobDescription, jobUrl, logoUrl }
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

      return {
        role,
        company,
        location: jobLocation,
        jobDescription: '',
        jobUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
        logoUrl,
        atsPlatform: 'linkedin',
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
