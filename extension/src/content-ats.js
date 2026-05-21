// Runway ATS content script
// Supports: Greenhouse, Lever, Ashby, Workday

function detectPlatform() {
  const host = location.hostname
  if (host.includes('greenhouse.io')) return 'greenhouse'
  if (host === 'jobs.lever.co') return 'lever'
  if (host === 'jobs.ashbyhq.com') return 'ashby'
  if (host.includes('myworkdayjobs.com')) return 'workday'
  return null
}

function isJobPage() {
  const platform = detectPlatform()
  const segments = location.pathname.split('/').filter(Boolean)
  switch (platform) {
    case 'greenhouse': return segments.length >= 3 && segments.includes('jobs')
    case 'lever':      return segments.length >= 2 && /^[0-9a-f-]{36}$/i.test(segments[1])
    case 'ashby':      return segments.length >= 2
    case 'workday':    return location.pathname.includes('/job/')
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

function slugToName(slug) {
  // "mongodb" → "MongoDB", "stripe-inc" → "Stripe Inc"
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Per-platform extractors ─────────────────────────────────────────────────

function extractGreenhouse() {
  const role =
    document.querySelector('#header h1')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    metaContent('og:title').split(' - ')[0]

  const siteName = metaContent('og:site_name')
  const company =
    siteName ||
    document.querySelector('.company-name')?.textContent?.trim() ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    document.querySelector('[class*="location"]')?.textContent?.trim() ||
    document.querySelector('[id*="location"]')?.textContent?.trim() || ''

  const jobDescription =
    document.querySelector('#content')?.innerText?.trim() ||
    document.querySelector('.job-post')?.innerText?.trim() ||
    document.querySelector('main')?.innerText?.trim() || ''

  return { role, company, location: location_, jobDescription }
}

function extractLever() {
  const role =
    document.querySelector('.posting-header h2')?.textContent?.trim() ||
    document.querySelector('h2')?.textContent?.trim() ||
    metaContent('og:title').split(' - ')[0]

  const company =
    metaContent('og:site_name') ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    document.querySelector('.sort-by-location')?.textContent?.trim() ||
    document.querySelector('[class*="location"]')?.textContent?.trim() || ''

  const jobDescription =
    document.querySelector('.posting-body')?.innerText?.trim() ||
    document.querySelector('[class*="posting-requirements"]')?.innerText?.trim() ||
    document.querySelector('main')?.innerText?.trim() || ''

  return { role, company, location: location_, jobDescription }
}

function extractAshby() {
  const role =
    document.querySelector('h1')?.textContent?.trim() ||
    metaContent('og:title').split('|')[0].trim()

  const company =
    metaContent('og:site_name') ||
    metaContent('og:title').split('|')[1]?.trim() ||
    slugToName(location.pathname.split('/')[1] || '')

  const location_ =
    document.querySelector('[class*="location"]')?.textContent?.trim() ||
    document.querySelector('[class*="department"]')?.textContent?.trim() || ''

  const jobDescription =
    document.querySelector('[class*="ashby-job-posting-description"]')?.innerText?.trim() ||
    document.querySelector('[class*="description"]')?.innerText?.trim() ||
    document.querySelector('article')?.innerText?.trim() ||
    document.querySelector('main')?.innerText?.trim() || ''

  return { role, company, location: location_, jobDescription }
}

function extractWorkday() {
  const role =
    document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
    document.querySelector('h2')?.textContent?.trim() ||
    metaContent('og:title').split(' - ')[0]

  const company =
    metaContent('og:site_name') ||
    slugToName(location.hostname.split('.')[0])

  const location_ =
    document.querySelector('[data-automation-id="locations"]')?.textContent?.trim() ||
    document.querySelector('[class*="location"]')?.textContent?.trim() || ''

  const jobDescription =
    document.querySelector('[data-automation-id="jobDescription"]')?.innerText?.trim() ||
    document.querySelector('[class*="description"]')?.innerText?.trim() ||
    document.querySelector('main')?.innerText?.trim() || ''

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
  }

  return {
    role: data.role || '',
    company: data.company || '',
    location: data.location || '',
    jobDescription: (data.jobDescription || '').slice(0, 5000),
    jobUrl: location.href,
  }
}

// ── Button ──────────────────────────────────────────────────────────────────

function getOrCreateBtn() {
  const existing = document.getElementById('runway-job-btn')
  if (existing) return existing

  const btn = document.createElement('button')
  btn.id = 'runway-job-btn'
  btn.className = 'runway-btn runway-btn--floating'
  btn.textContent = '✈ Add to Runway'

  btn.addEventListener('click', async () => {
    setState('loading', 'Adding…')
    const { role, company, location, jobDescription, jobUrl } = extractJob()
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_JOB',
        role,
        company,
        location,
        jobDescription,
        jobUrl,
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
    if (label) btn.textContent = label
    if (state === 'idle') btn.textContent = '✈ Add to Runway'
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
