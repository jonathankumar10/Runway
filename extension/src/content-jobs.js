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

  // Role: LinkedIn wraps the job title in an <a href="/jobs/view/{jobId}">
  const jobId = new URLSearchParams(location.search).get('currentJobId')
  const jobTitleLink =
    (jobId && pane.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    (jobId && document.querySelector(`a[href*="/jobs/view/${jobId}"]`)) ||
    pane.querySelector('a[href*="/jobs/view/"]')
  const role =
    jobTitleLink?.textContent?.trim() ||
    [...pane.querySelectorAll('h1, h2')]
      .map(h => h.textContent.trim())
      .find(t => t.length > 2 && !/^\d+$/.test(t) && !/notification/i.test(t) && !/^about the job$/i.test(t))

  // Company: the /company/ link inside the detail pane
  const company =
    pane.querySelector('a[href*="/company/"]')?.textContent?.trim() ||
    document.querySelector('a[href*="/company/"]')?.textContent?.trim()

  // Location: find "About the job" heading, then look at sibling/ancestor text
  // for city/state patterns before the description block
  const companyLink = pane.querySelector('a[href*="/company/"]')
  let jobLocation = ''
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

  const jobUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href

  console.log('[Runway] pane found:', pane !== document)
  console.log('[Runway] extracted:', { role, company, jobLocation, descLen: jobDescription.length })
  return { role, company, location: jobLocation, jobDescription, jobUrl }
}

function getOrCreateBtn() {
  const existing = document.getElementById('runway-job-btn')
  if (existing) return existing

  const btn = document.createElement('button')
  btn.id = 'runway-job-btn'
  btn.className = 'runway-btn runway-btn--floating'
  btn.textContent = '✈ Add to Runway'

  btn.addEventListener('click', async () => {
    setState('loading', 'Adding…')
    await expandDescription()
    const { role, company, location, jobDescription, jobUrl } = extractJob()
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_JOB',
        role: role || '',
        company: company || '',
        location: location || '',
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

function showBtn() {
  const btn = getOrCreateBtn()
  btn.style.display = 'inline-flex'
}

function hideBtn() {
  const btn = document.getElementById('runway-job-btn')
  if (btn) btn.style.display = 'none'
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
  }
}).observe(document.body, { childList: true, subtree: true })
