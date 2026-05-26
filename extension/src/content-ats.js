// Runway ATS content script
// Supports: Greenhouse, Lever, Ashby, Workday, Taleo, iCIMS, BambooHR, SmartRecruiters

import { cleanText, detectPlatformFromUrl, slugToName } from './import-utils.js'
import { setRunwayButtonContent } from './button-ui.js'

function detectPlatform() {
  return detectPlatformFromUrl(location.href) || null
}

function isJobPage() {
  const platform = detectPlatform()
  const segments = location.pathname.split('/').filter(Boolean)
  switch (platform) {
    case 'greenhouse': return segments.length >= 3 && segments.includes('jobs')
    case 'lever':      return segments.length >= 2 && /^[0-9a-f-]{36}$/i.test(segments[1])
    case 'ashby':      return segments.length >= 2
    case 'workday':    return location.pathname.includes('/job/')
    case 'taleo':      return location.pathname.includes('jobdetail') || location.search.includes('job=')
    case 'icims':      return segments.includes('jobs') && (segments.some(s => /^\d+$/.test(s)) || location.pathname.includes('/job'))
    case 'bamboohr':   return segments.includes('careers') && (segments.some(s => /^\d+$/.test(s)) || location.search.includes('id='))
    case 'smartrecruiters': return segments.length >= 2 && !segments[0].toLowerCase().includes('search')
    default:           return false
  }
}

// ── Meta tag helpers ────────────────────────────────────────────────────────

function metaContent(prop) {
  return (
    document.querySelector(`meta[property="${prop}"]`)?.content ||
    document.querySelector(`meta[name="${prop}"]`)?.content ||
    ''
  ).trim()
}

function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.innerText || document.querySelector(selector)?.textContent
    const cleaned = cleanText(text)
    if (cleaned) return cleaned
  }
  return ''
}

function metaTitleRole(separator = '-') {
  return cleanText(metaContent('og:title').split(separator)[0])
}

// ── Per-platform extractors ─────────────────────────────────────────────────

function extractGreenhouse() {
  const role =
    textFromSelectors(['#header h1', 'h1']) ||
    metaTitleRole(' - ')

  const siteName = metaContent('og:site_name')
  const company =
    siteName ||
    textFromSelectors(['.company-name']) ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    textFromSelectors(['[class*="location"]', '[id*="location"]'])

  const jobDescription =
    textFromSelectors(['#content', '.job-post', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractLever() {
  const role =
    textFromSelectors(['.posting-header h2', 'h2']) ||
    metaTitleRole(' - ')

  const company =
    metaContent('og:site_name') ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    textFromSelectors(['.sort-by-location', '[class*="location"]'])

  const jobDescription =
    textFromSelectors(['.posting-body', '[class*="posting-requirements"]', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractAshby() {
  const role =
    textFromSelectors(['h1']) ||
    metaTitleRole('|')

  const company =
    metaContent('og:site_name') ||
    metaContent('og:title').split('|')[1]?.trim() ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    textFromSelectors(['[class*="location"]', '[class*="department"]'])

  const jobDescription =
    textFromSelectors(['[class*="ashby-job-posting-description"]', '[class*="description"]', 'article', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractWorkday() {
  const role =
    textFromSelectors(['[data-automation-id="jobPostingHeader"]', 'h2']) ||
    metaTitleRole(' - ')

  const company =
    metaContent('og:site_name') ||
    slugToName(location.hostname.split('.')[0])

  const location_ =
    textFromSelectors(['[data-automation-id="locations"]', '[class*="location"]'])

  const jobDescription =
    textFromSelectors(['[data-automation-id="jobDescription"]', '[class*="description"]', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractTaleo() {
  const role =
    textFromSelectors(['#requisitionDescriptionInterface\\.reqTitleLinkAction\\.row1', '.titlepage', 'h1', 'h2']) ||
    metaTitleRole(' - ')

  const company =
    metaContent('og:site_name') ||
    textFromSelectors(['#companyName', '.companyName', '[class*="company"]']) ||
    slugToName(location.hostname.split('.')[0])

  const location_ =
    textFromSelectors(['[id*="location"]', '[class*="location"]', '[id*="Location"]', '[class*="Location"]'])

  const jobDescription =
    textFromSelectors(['#requisitionDescriptionInterface\\.ID1615\\.row1', '[id*="requisitionDescription"]', '[class*="description"]', 'main', 'body'])

  return { role, company, location: location_, jobDescription }
}

function extractIcims() {
  const role =
    textFromSelectors(['.iCIMS_Header h1', '.iCIMS_JobHeader h1', 'h1']) ||
    metaTitleRole('|')

  const company =
    metaContent('og:site_name') ||
    textFromSelectors(['[class*="company"]', '[id*="company"]']) ||
    slugToName(location.hostname.split('.')[0].replace(/^careers-/, ''))

  const location_ =
    textFromSelectors(['.iCIMS_JobHeader .iCIMS_JobHeaderData', '[class*="location"]', '[id*="location"]'])

  const jobDescription =
    textFromSelectors(['.iCIMS_JobContent', '.iCIMS_JobDescription', '[class*="description"]', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractBamboohr() {
  const role =
    textFromSelectors(['h1', '[class*="job-title"]', '[class*="JobTitle"]']) ||
    metaTitleRole('|')

  const company =
    metaContent('og:site_name') ||
    slugToName(location.hostname.split('.')[0])

  const location_ =
    textFromSelectors(['[class*="location"]', '[class*="Location"]', '[id*="location"]'])

  const jobDescription =
    textFromSelectors(['[class*="description"]', '[class*="Description"]', '[class*="posting"]', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractSmartRecruiters() {
  const role =
    textFromSelectors(['[data-testid="job-title"]', '.job-title', 'h1']) ||
    metaTitleRole('|')

  const company =
    metaContent('og:site_name') ||
    textFromSelectors(['[data-testid="company-name"]', '[class*="company"]']) ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    textFromSelectors(['[data-testid="job-location"]', '[class*="location"]'])

  const jobDescription =
    textFromSelectors(['[data-testid="job-description"]', '.job-description', '[class*="description"]', 'main'])

  return { role, company, location: location_, jobDescription }
}

function extractJob() {
  const platform = detectPlatform()
  let data = { role: '', company: '', location: '', jobDescription: '' }

  switch (platform) {
    case 'greenhouse': data = extractGreenhouse(); break
    case 'lever':      data = extractLever();      break
    case 'ashby':      data = extractAshby();      break
    case 'workday':    data = extractWorkday();    break
    case 'taleo':      data = extractTaleo();      break
    case 'icims':      data = extractIcims();      break
    case 'bamboohr':   data = extractBamboohr();   break
    case 'smartrecruiters': data = extractSmartRecruiters(); break
  }

  return {
    role: cleanText(data.role),
    company: cleanText(data.company),
    location: cleanText(data.location),
    jobDescription: cleanText(data.jobDescription, 5000),
    jobUrl: location.href,
    atsPlatform: platform,
  }
}

// ── Button ──────────────────────────────────────────────────────────────────

function getOrCreateBtn() {
  const existing = document.getElementById('runway-job-btn')
  if (existing) return existing

  const btn = document.createElement('button')
  btn.id = 'runway-job-btn'
  btn.className = 'runway-btn runway-btn--floating'
  setRunwayButtonContent(btn, 'Add to Runway')

  btn.addEventListener('click', async () => {
    setState('loading', 'Adding…')
    const { role, company, location, jobDescription, jobUrl, atsPlatform } = extractJob()
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_JOB',
        role,
        company,
        location,
        jobDescription,
        jobUrl,
        atsPlatform,
      })
      if (res?.ok) {
        setState('success', '✓ Added!')
        setTimeout(() => setState('idle'), 3000)
      } else {
        setState('error', '✗ ' + (res?.error || 'Failed'))
        setTimeout(() => setState('idle'), 3000)
      }
    } catch {
      setState('error', '✗ Sign in first')
      setTimeout(() => setState('idle'), 3000)
    }
  })

  function setState(state, label) {
    btn.disabled = state === 'loading'
    btn.className = `runway-btn runway-btn--floating${state !== 'idle' ? ` runway-btn--${state}` : ''}`
    setRunwayButtonContent(btn, label || 'Add to Runway')
    if (state === 'idle') setRunwayButtonContent(btn, 'Add to Runway')
  }

  document.body.appendChild(btn)
  return btn
}

// ── Init ────────────────────────────────────────────────────────────────────

function init() {
  if (!isJobPage()) return
  const btn = getOrCreateBtn()
  btn.style.display = 'inline-flex'
}

// ATS pages are mostly server-rendered, but Workday is a SPA
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// SPA watcher for Workday
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(init, 1000)
  }
}).observe(document.body, { childList: true, subtree: true })
