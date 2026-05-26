import { setRunwayButtonContent } from './button-ui.js'

const RECRUITER_KEYWORDS = /recruit|talent|hiring|hr\b|human resource|people ops|people partner|staffing|sourcer|acquisition/i

function waitForElement(selector, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector)
    if (el) { resolve(el); return }
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) { observer.disconnect(); resolve(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); reject(new Error('timeout')) }, timeout)
  })
}

function extractProfile() {
  const name =
    document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() ||
    document.querySelector('h1[class*="heading"]')?.textContent?.trim()

  const headline =
    document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
    document.querySelector('[class*="headline"]')?.textContent?.trim()

  // Best-effort company from headline ("... at Stripe") or first experience entry
  const companyFromHeadline = headline?.match(/\bat\s+(.+)$/i)?.[1]?.trim()
  const companyFromExperience =
    document.querySelector('.pvs-list__item--line-separated [aria-hidden="true"] span')?.textContent?.trim()
  const company = companyFromHeadline || companyFromExperience || ''

  return { name, headline, company, linkedInUrl: window.location.href }
}

async function injectButton() {
  if (document.getElementById('runway-recruiter-btn')) return

  try {
    await waitForElement('h1.text-heading-xlarge, h1[class*="heading"]')
  } catch {
    return
  }

  const headline = document.querySelector('.text-body-medium.break-words')?.textContent || ''
  if (!RECRUITER_KEYWORDS.test(headline)) return

  const actionBar =
    document.querySelector('.pvs-profile-actions') ||
    document.querySelector('[class*="profile-actions"]') ||
    document.querySelector('.pv-top-card--list-bullet')
  if (!actionBar) return

  const btn = document.createElement('button')
  btn.id = 'runway-recruiter-btn'
  btn.className = 'runway-btn'
  setRunwayButtonContent(btn, 'Track in Runway')

  btn.addEventListener('click', async () => {
    setState('loading', 'Adding…')
    const { name, headline, company } = extractProfile()
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_RECRUITER',
        name: name || '',
        title: headline || '',
        company,
        linkedInUrl: window.location.href,
      })
      if (res?.ok) {
        setState('success', '✓ Tracked!')
      } else {
        setState('error', res?.error?.includes('sign in') ? '✗ Sign in first' : '✗ Failed')
        setTimeout(() => setState('idle'), 3000)
      }
    } catch {
      setState('error', '✗ Sign in first')
      setTimeout(() => setState('idle'), 3000)
    }
  })

  function setState(state, label) {
    btn.disabled = state === 'loading' || state === 'success'
    btn.className = `runway-btn${state !== 'idle' ? ` runway-btn--${state}` : ''}`
    setRunwayButtonContent(btn, label || 'Track in Runway')
    if (state === 'idle') setRunwayButtonContent(btn, 'Track in Runway')
  }

  actionBar.appendChild(btn)
}

let lastUrl = location.href
injectButton()

new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    if (/\/in\//.test(location.pathname)) {
      document.getElementById('runway-recruiter-btn')?.remove()
      setTimeout(injectButton, 1500)
    }
  }
}).observe(document.body, { childList: true, subtree: true })
