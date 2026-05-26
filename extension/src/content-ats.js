// Runway ATS content script
// Supports: Greenhouse, Lever, Ashby, Workday, Taleo, iCIMS, BambooHR, SmartRecruiters
/* global __RUNWAY_APP_URL__ */

import { cleanText, detectPlatformFromUrl, slugToName } from './import-utils.js'
import { createRunwayPanel } from './runway-panel.js'

const RUNWAY_APP_URL = __RUNWAY_APP_URL__

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

function imageFromSelectors(selectors) {
  for (const selector of selectors) {
    const src = document.querySelector(selector)?.src || document.querySelector(selector)?.content
    if (src) return new URL(src, location.href).href
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]', '#header img'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]', '.main-header-logo img'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
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

  const logoUrl =
    imageFromSelectors(['meta[property="og:image"]', 'img[class*="logo"]'])

  return { role, company, location: location_, jobDescription, logoUrl }
}

function extractJob() {
  const platform = detectPlatform()
  let data = { role: '', company: '', location: '', jobDescription: '', logoUrl: '' }

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
    logoUrl: cleanText(data.logoUrl),
    atsPlatform: platform,
  }
}

function isLikelyJobUrl(url) {
  const platform = detectPlatformFromUrl(url)
  if (!platform) return false

  const parsed = new URL(url)
  const segments = parsed.pathname.split('/').filter(Boolean)
  switch (platform) {
    case 'greenhouse': return segments.includes('jobs') && segments.some(segment => /^\d+$/.test(segment))
    case 'lever': return segments.length >= 2 && /^[0-9a-f-]{36}$/i.test(segments[1])
    case 'ashby': return segments.length >= 2
    case 'workday': return parsed.pathname.includes('/job/')
    case 'taleo': return parsed.pathname.includes('jobdetail') || parsed.search.includes('job=')
    case 'icims': return segments.includes('jobs') && (segments.some(segment => /^\d+$/.test(segment)) || parsed.pathname.includes('/job'))
    case 'bamboohr': return segments.includes('careers') && (segments.some(segment => /^\d+$/.test(segment)) || parsed.search.includes('id='))
    case 'smartrecruiters': return segments.length >= 2 && !segments[0].toLowerCase().includes('search')
    default: return false
  }
}

function extractJobsFromListings() {
  const platform = detectPlatform()
  const company =
    metaContent('og:site_name') ||
    slugToName(location.pathname.split('/')[1] || location.hostname.split('.')[0])

  return [...document.querySelectorAll('a[href]')]
    .map(anchor => {
      const jobUrl = new URL(anchor.href, location.href).href
      if (!isLikelyJobUrl(jobUrl)) return null

      const card = anchor.closest('li, article, [class*="job"], [data-automation-id*="job"]') || anchor.parentElement
      const role =
        cleanText(anchor.textContent) ||
        cleanText(card?.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]')?.textContent)
      const location_ =
        cleanText(card?.querySelector('[class*="location"], [class*="Location"], [data-automation-id*="location"]')?.textContent)
      const logoUrl =
        card?.querySelector('img[class*="logo"], img[src]')?.src ||
        imageFromSelectors(['meta[property="og:image"]'])

      return {
        role,
        company,
        location: location_,
        jobDescription: '',
        jobUrl,
        logoUrl,
        atsPlatform: platform,
      }
    })
    .filter(job => job?.role || job?.jobUrl)
}

function getDiscoverableJobs() {
  if (isJobPage()) {
    const job = extractJob()
    return job.role || job.jobDescription ? [job] : extractJobsFromListings()
  }
  return extractJobsFromListings()
}

function addDiscoveredJob(job) {
  return sendRuntimeMessage({
    type: 'ADD_JOB',
    role: job.role || '',
    company: job.company || '',
    location: job.location || '',
    jobDescription: job.jobDescription || '',
    jobUrl: job.jobUrl,
    atsPlatform: job.atsPlatform || detectPlatform(),
  })
}

function sendRuntimeMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    throw new Error('Extension was reloaded. Refresh this tab and try again.')
  }
  return chrome.runtime.sendMessage(message)
}

// ── Apply Assistant ─────────────────────────────────────────────────────────

let applyResources = null
let applyResourcesPromise = null
let selectedApplicationId = ''
let runwayPanel = null

function detectApplicationForm() {
  const fields = getAutofillFields()
  return fields.length >= 3 || Boolean(document.querySelector('input[type="file"], select'))
}

function getAutofillFields() {
  return [...document.querySelectorAll('input, textarea, select')]
    .filter(field => {
      if (field.disabled || field.readOnly) return false
      if (field.type && ['hidden', 'submit', 'button', 'file', 'password'].includes(field.type)) return false
      return field.offsetParent !== null
    })
}

function fieldSignature(field) {
  const label = field.id
    ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent
    : ''
  const parentText = field.closest('label, div, p, section')?.innerText || ''
  return cleanText([
    label,
    field.getAttribute('aria-label'),
    field.getAttribute('placeholder'),
    field.getAttribute('name'),
    field.id,
    parentText,
  ].filter(Boolean).join(' ')).toLowerCase()
}

function valueForField(field, profile) {
  const sig = fieldSignature(field)
  const type = field.type?.toLowerCase()

  if (/sponsor|visa/.test(sig)) return profile.sponsorship
  if (/authorized|authorization|eligible to work|legally work|work in/.test(sig)) return profile.workAuthorization
  if (/salary|compensation|desired pay|expected pay/.test(sig)) return profile.salaryExpectation
  if (/remote|hybrid|on-?site|work preference|work arrangement/.test(sig)) return profile.remotePreference
  if (type === 'email' || /\bemail\b/.test(sig)) return profile.email
  if (type === 'tel' || /phone|mobile|cell/.test(sig)) return profile.phone
  if (/first\s*name|given\s*name/.test(sig)) return profile.firstName
  if (/last\s*name|family\s*name|surname/.test(sig)) return profile.lastName
  if (/full\s*name|legal\s*name|preferred\s*name/.test(sig)) return profile.fullName
  if (/linkedin|linked\s*in/.test(sig)) return profile.linkedInUrl
  if (/github/.test(sig)) return profile.githubUrl
  if (/portfolio|website|personal\s*site/.test(sig)) return profile.portfolioUrl
  if (/city|location|address/.test(sig)) return profile.location

  return ''
}

function setFieldValue(field, value) {
  if (!value) return false
  if (field.tagName === 'SELECT') return setSelectValue(field, value)
  if (field.type === 'radio' || field.type === 'checkbox') return setChoiceValue(field, value)

  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set
  setter ? setter.call(field, value) : field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function normalizeChoice(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function choiceSynonyms(value) {
  const normalized = normalizeChoice(value)
  const synonyms = new Set([normalized])
  if (normalized === 'yes') ['yes', 'true', 'y', 'i need sponsorship', 'require sponsorship'].forEach(v => synonyms.add(v))
  if (normalized === 'no') ['no', 'false', 'n', 'do not need sponsorship', 'no sponsorship'].forEach(v => synonyms.add(v))
  if (normalized === 'authorized') ['yes', 'authorized', 'legally authorized', 'eligible'].forEach(v => synonyms.add(v))
  if (normalized === 'not authorized') ['no', 'not authorized', 'not eligible'].forEach(v => synonyms.add(v))
  if (normalized === 'onsite') synonyms.add('on site')
  return [...synonyms]
}

function setSelectValue(select, value) {
  const wanted = choiceSynonyms(value)
  const option = [...select.options].find(opt => {
    const haystack = normalizeChoice(`${opt.value} ${opt.textContent}`)
    return wanted.some(item => haystack.includes(item) || item.includes(haystack))
  })
  if (!option) return false
  select.value = option.value
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function setChoiceValue(field, value) {
  const name = field.name
  const group = name
    ? [...document.querySelectorAll(`input[type="${field.type}"][name="${CSS.escape(name)}"]`)]
    : [field]
  const wanted = choiceSynonyms(value)
  const target = group.find(input => {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent : ''
    const haystack = normalizeChoice(`${input.value} ${label} ${input.closest('label, div')?.innerText || ''}`)
    return wanted.some(item => haystack.includes(item) || item.includes(haystack))
  })

  if (!target) return false
  target.checked = true
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function safeFilePart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'runway-resume'
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sectionsToHtml(sections) {
  if (!Array.isArray(sections) || !sections.length) return ''
  const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const bold = value => escape(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const chunks = []

  for (const section of sections) {
    if (section.type === 'header') {
      if (section.name) chunks.push(`<h1>${escape(section.name)}</h1>`)
      if (section.contact?.length) chunks.push(`<p class="contact">${section.contact.map(escape).join(' | ')}</p>`)
      continue
    }

    if (section.title) chunks.push(`<h2>${escape(section.title)}</h2>`)
    if (section.type === 'summary') {
      for (const item of section.bullets || []) chunks.push(`<p>${bold(item)}</p>`)
    }
    if (section.type === 'experience') {
      for (const entry of section.entries || []) {
        chunks.push(`<p><strong>${escape(entry.role)}</strong>${entry.company ? `, ${escape(entry.company)}` : ''}<span>${[entry.location, entry.dates].filter(Boolean).map(escape).join(' | ')}</span></p>`)
        chunks.push(`<ul>${(entry.bullets || []).map(item => `<li>${bold(item)}</li>`).join('')}</ul>`)
      }
    }
    if (section.type === 'education') {
      for (const entry of section.entries || []) {
        chunks.push(`<p><strong>${escape(entry.degree)}</strong>${entry.school ? `, ${escape(entry.school)}` : ''}<span>${[entry.location, entry.dates].filter(Boolean).map(escape).join(' | ')}</span></p>`)
        for (const detail of entry.details || []) chunks.push(`<p>${escape(detail)}</p>`)
      }
    }
    if (section.type === 'skills') {
      for (const group of section.groups || []) {
        chunks.push(`<p>${group.label ? `<strong>${escape(group.label)}</strong>: ` : ''}${(group.items || []).map(escape).join(', ')}</p>`)
      }
    }
    if (section.type === 'generic') {
      for (const entry of section.entries || []) {
        chunks.push(`<p><strong>${escape(entry.heading)}</strong>${entry.subheading ? `<span>${escape(entry.subheading)}</span>` : ''}</p>`)
        chunks.push(`<ul>${(entry.bullets || []).map(item => `<li>${bold(item)}</li>`).join('')}</ul>`)
      }
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Runway Resume</title><style>
    body{font-family:Arial,sans-serif;max-width:760px;margin:32px auto;color:#111827;line-height:1.35}
    h1{font-size:24px;text-align:center;margin:0 0 4px} .contact{text-align:center;font-size:12px;color:#475569}
    h2{font-size:13px;border-bottom:1px solid #111827;margin:16px 0 8px;letter-spacing:.04em}
    p{font-size:12px;margin:4px 0} p span{float:right;color:#475569} ul{margin:4px 0 8px 18px;padding:0}
    li{font-size:12px;margin:3px 0}
  </style></head><body>${chunks.join('\n')}</body></html>`
}

function downloadHtmlFile(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function printHtmlDocument(html) {
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    downloadHtmlFile('runway-tailored-resume.html', html)
    return false
  }

  win.document.write(html.replace('</body>', '<script>setTimeout(function(){ window.print(); }, 250);</script></body>'))
  win.document.close()
  win.focus()
  return true
}

function openSelectedApplication() {
  if (!selectedApplicationId) throw new Error('Choose a Runway application first.')
  const base = RUNWAY_APP_URL.replace(/\/$/, '')
  window.open(`${base}/applications/${selectedApplicationId}`, '_blank', 'noopener,noreferrer')
}

function getApplyPageText() {
  return cleanText(document.body.innerText, 10000)
}

async function loadApplyResources(force = false) {
  if (applyResources && !force) return applyResources
  if (!applyResourcesPromise || force) {
    applyResourcesPromise = sendRuntimeMessage({
      type: 'GET_APPLY_RESOURCES',
      pageUrl: location.href,
      pageText: getApplyPageText(),
    }).then(res => {
      if (!res?.ok) throw new Error(res?.error || 'Could not load Runway applications')
      applyResources = res
      selectedApplicationId ||= res.tailoredResumes?.[0]?.id || ''
      return res
    }).finally(() => {
      applyResourcesPromise = null
    })
  }
  return applyResourcesPromise
}

function getQuestionField() {
  const active = document.activeElement
  if (active?.tagName === 'TEXTAREA' && !active.disabled && !active.readOnly) return active
  return [...document.querySelectorAll('textarea')]
    .find(field => !field.disabled && !field.readOnly && !field.value && field.offsetParent !== null) || null
}

function questionForField(field) {
  if (!field) return ''
  const label = field.id
    ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent
    : ''
  return cleanText([
    label,
    field.getAttribute('aria-label'),
    field.getAttribute('placeholder'),
    field.closest('label, div, section')?.innerText,
  ].filter(Boolean).join(' '))
}

async function autofillApplication() {
  const res = await sendRuntimeMessage({ type: 'GET_AUTOFILL_PROFILE' })
  if (!res?.ok) throw new Error(res?.error || 'Could not load Runway profile')

  let filled = 0
  for (const field of getAutofillFields()) {
    if (field.type !== 'radio' && field.type !== 'checkbox' && field.value) continue
    if ((field.type === 'radio' || field.type === 'checkbox') && field.checked) continue
    if (setFieldValue(field, valueForField(field, res.profile))) filled += 1
  }
  filled += await fillCustomChoiceFields(res.profile)
  return filled
}

async function fillCustomChoiceFields(profile) {
  let filled = 0
  const controls = [...document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], button, [tabindex="0"]')]
    .filter(control => control.offsetParent !== null && !control.disabled)

  for (const control of controls) {
    const sig = fieldSignature(control)
    const value = valueForField(control, profile)
    if (!value || !/(sponsor|visa|authorized|authorization|eligible|remote|hybrid|on-?site|work preference|work arrangement)/.test(sig)) continue
    if (await chooseCustomOption(control, value)) filled += 1
  }
  return filled
}

async function chooseCustomOption(control, value) {
  const before = document.body.innerText
  control.click()
  await new Promise(resolve => setTimeout(resolve, 250))
  if (document.body.innerText === before) return false

  const wanted = choiceSynonyms(value)
  const options = [...document.querySelectorAll('[role="option"], li, div, span, button')]
    .filter(option => option.offsetParent !== null)
    .filter(option => {
      const text = normalizeChoice(option.innerText || option.textContent)
      return text && wanted.some(item => text.includes(item) || item.includes(text))
    })

  const option = options[0]
  if (!option) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return false
  }

  option.click()
  await new Promise(resolve => setTimeout(resolve, 100))
  return true
}

async function downloadResume(kind, format = 'txt') {
  const res = await loadApplyResources()

  if (kind === 'base') {
    if (!res.defaultResume?.resumeText) throw new Error('No base resume found.')
    downloadTextFile(`${safeFilePart(res.defaultResume.label)}.txt`, res.defaultResume.resumeText)
    return res.defaultResume.label || 'base resume'
  }

  const tailored = res.tailoredResumes?.find(item => item.id === selectedApplicationId) || res.tailoredResumes?.[0]
  if (!tailored?.tailoredResumeText) throw new Error('No tailored resume is ready yet.')
  const basename = `${safeFilePart(tailored.company)}-${safeFilePart(tailored.role)}-tailored-resume`
  if (format === 'html' && tailored.tailoredResumeSections?.length) {
    downloadHtmlFile(`${basename}.html`, sectionsToHtml(tailored.tailoredResumeSections))
  } else {
    downloadTextFile(`${basename}.txt`, tailored.tailoredResumeText)
  }
  return `${tailored.company || 'Runway'} ${tailored.role || 'tailored resume'}`.trim()
}

async function printTailoredResume() {
  const res = await loadApplyResources()
  const tailored = res.tailoredResumes?.find(item => item.id === selectedApplicationId) || res.tailoredResumes?.[0]
  if (!tailored?.tailoredResumeSections?.length) throw new Error('No printable tailored resume is ready yet.')

  const opened = printHtmlDocument(sectionsToHtml(tailored.tailoredResumeSections))
  return opened ? 'Opened print dialog for tailored resume.' : 'Popup blocked. Downloaded HTML instead.'
}

async function draftApplicationAnswer() {
  const field = getQuestionField()
  if (!field) throw new Error('Click into an answer text box first.')

  const question = questionForField(field)
  if (!question) throw new Error('Could not read the question for this field.')

  const res = await sendRuntimeMessage({ type: 'DRAFT_APPLICATION_ANSWER', question, applicationId: selectedApplicationId })
  if (!res?.ok || !res.answer) throw new Error(res?.error || 'Could not draft an answer.')

  setFieldValue(field, res.answer)
}

function getPanelContext() {
  const isApplicationForm = detectApplicationForm()
  if (isApplicationForm) {
    if (!applyResources && !applyResourcesPromise) {
      loadApplyResources()
        .then(() => runwayPanel?.refresh())
        .catch(() => {})
    }

    const applications = applyResources?.tailoredResumes || []
    return {
      visible: true,
      mode: 'apply',
      applications,
      selectedApplicationId,
      subtitle: applications.length
        ? 'Choose the matching Runway application, then use the actions below.'
        : 'Application form detected. Save and prepare the job in Runway for tailored resume actions.',
      status: applications.length
        ? 'Choose actions as needed. You submit manually.'
        : 'No prepared Runway application matched this page yet.',
    }
  }

  const jobs = getDiscoverableJobs()
  return {
    visible: jobs.length > 0,
    mode: 'job',
    jobs,
    subtitle: isJobPage()
      ? 'Save this job and prepare your resume.'
      : 'Save detected jobs to Runway.',
  }
}

function refreshRunwayPanel(delay = 0) {
  runwayPanel?.refresh(delay)
  annotateFileInputs()
}

function annotateFileInputs() {
  for (const input of document.querySelectorAll('input[type="file"]')) {
    if (input.dataset.runwayAnnotated) continue
    input.dataset.runwayAnnotated = 'true'

    const note = document.createElement('div')
    note.className = 'runway-upload-note'
    note.textContent = 'Use Runway to download your tailored or base resume, then upload it here.'
    input.insertAdjacentElement('afterend', note)
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

function init() {
  ensureRunwayPanel()
  const btn = document.getElementById('runway-job-btn')
  if (btn) btn.style.display = 'none'
  applyResources = null
  applyResourcesPromise = null
  selectedApplicationId = ''
  refreshRunwayPanel()
}

function ensureRunwayPanel() {
  if (runwayPanel) return runwayPanel
  runwayPanel = createRunwayPanel({
    getContext: getPanelContext,
    actions: {
      addJob: addDiscoveredJob,
      selectApplication: id => {
        selectedApplicationId = id
        refreshRunwayPanel()
      },
      autofill: async () => {
        const count = await autofillApplication()
        return count ? `Filled ${count} field${count === 1 ? '' : 's'}.` : 'No empty matching fields found.'
      },
      downloadResume: async (kind, format) => {
        const label = await downloadResume(kind, format)
        return `Downloaded ${label}. Upload it manually.`
      },
      printResume: printTailoredResume,
      draftAnswer: async () => {
        await draftApplicationAnswer()
        return 'Inserted a draft answer. Review before submitting.'
      },
      openRunway: () => {
        openSelectedApplication()
        return 'Opened selected application in Runway.'
      },
    },
  })
  return runwayPanel
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
  } else {
    refreshRunwayPanel(700)
  }
}).observe(document.body, { childList: true, subtree: true })
