import { setRunwayButtonContent } from './button-ui.js'

const AVATAR_PALETTE = [
  ['#FEE4E2', '#B42318'],
  ['#FEF3C7', '#92400E'],
  ['#D1FAE5', '#065F46'],
  ['#DBEAFE', '#1E40AF'],
  ['#EDE9FE', '#5B21B6'],
  ['#FCE7F3', '#831843'],
  ['#CCFBF1', '#134E4A'],
  ['#E0F2FE', '#0369A1'],
]

function avatarColor(name) {
  const c = (name || 'A').toUpperCase().charCodeAt(0)
  return AVATAR_PALETTE[c % AVATAR_PALETTE.length]
}

// Build the Runway logo mark element (same structure as button-ui.js)
function createMark(size = 22) {
  const mark = document.createElement('span')
  mark.className = 'runway-btn__mark'
  mark.style.cssText = `width:${size}px;height:${size}px`
  for (const cls of [
    'runway-btn__runway runway-btn__runway--a',
    'runway-btn__runway runway-btn__runway--b',
    'runway-btn__plane runway-btn__plane--body',
    'runway-btn__plane runway-btn__plane--wing',
    'runway-btn__plane runway-btn__plane--tail',
  ]) {
    const s = document.createElement('span')
    s.className = cls
    mark.appendChild(s)
  }
  return mark
}

export function createRunwayPanel({ getContext, actions }) {
  let isOpen = false   // start closed — user clicks the tab to open
  let refreshTimer = null

  // ── Panel root (full-height sidebar) ────────────────────────────────────────
  const root = document.createElement('section')
  root.id = 'runway-assistant-panel'
  root.className = 'runway-panel'
  root.setAttribute('aria-label', 'Runway assistant')

  const panel = document.createElement('div')
  panel.className = 'runway-panel__body'
  root.appendChild(panel)

  // ── Floating circular launcher (separate from root) ──────────────────────────
  const launcher = document.createElement('button')
  launcher.type = 'button'
  launcher.className = 'runway-panel__launcher'
  launcher.setAttribute('aria-label', 'Open Runway panel')
  launcher.appendChild(createMark(26))
  launcher.addEventListener('click', () => {
    isOpen = true
    render()
  })

  function getPageLuminance() {
    try {
      const bg = window.getComputedStyle(document.body).backgroundColor
      const [, r, g, b] = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) || []
      if (r === undefined) return 1
      return (0.299 * +r + 0.587 * +g + 0.114 * +b) / 255
    } catch { return 1 }
  }

  function attach() {
    if (!document.body) return false
    for (const id of ['runway-job-discovery', 'runway-apply-assistant']) {
      const legacy = document.getElementById(id)
      if (legacy) legacy.remove()
    }
    if (!document.body.contains(root)) document.body.appendChild(root)
    if (!document.body.contains(launcher)) document.body.appendChild(launcher)
    const onLight = getPageLuminance() > 0.6
    root.classList.toggle('runway-panel--on-light', onLight)
    launcher.classList.toggle('runway-panel__launcher--on-light', onLight)
    return true
  }

  function refresh(delay = 0) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(render, delay)
  }

  function hide() {
    root.style.display = 'none'
    launcher.hidden = true
    safeSendMessage({ type: 'SET_JOB_BADGE', count: 0 })
  }

  function render() {
    if (!attach()) return
    const context = getContext()
    if (!context?.visible) {
      hide()
      return
    }

    root.style.display = ''
    root.classList.toggle('runway-panel--on-light', getPageLuminance() > 0.6)

    const mode = context.mode || 'job'
    const count = context.jobs?.length || 0
    safeSendMessage({ type: 'SET_JOB_BADGE', count: mode === 'job' ? count : 0 })

    // Slide panel in or out
    root.classList.toggle('runway-panel--open', isOpen)
    launcher.hidden = isOpen

    panel.replaceChildren()
    if (!isOpen) return

    panel.appendChild(createHeader(context))
    if (mode === 'apply') renderApply(context)
    else renderJobs(context)
  }

  // ── Header ───────────────────────────────────────────────────────────────────

  function createHeader(context) {
    const header = document.createElement('div')
    const isAddJob = context.mode !== 'apply' && (context.jobs || []).length === 1 && context.isDirectJobPage

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'rp-close'
    closeBtn.innerHTML = '&times;'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.addEventListener('click', () => { isOpen = false; render() })

    if (isAddJob) {
      header.className = 'rp-header rp-header--job'
      const title = document.createElement('span')
      title.className = 'rp-header__title'
      title.textContent = 'Add a New Job for This Page'
      header.append(closeBtn, title)
    } else {
      header.className = 'rp-header'
      const brand = document.createElement('div')
      brand.className = 'rp-header__brand'
      brand.textContent = 'Runway'
      header.append(brand, closeBtn)
    }

    return header
  }

  // ── Job listing mode ─────────────────────────────────────────────────────────

  function renderJobs(context) {
    const jobs = context.jobs || []
    // Review form only on a direct single-job page (e.g. boards.greenhouse.io/…/jobs/123)
    if (jobs.length === 1 && context.isDirectJobPage) {
      renderJobReview(jobs[0])
    } else {
      renderJobBrowse(jobs)
    }
  }

  // ── Job-detail parsing helpers ────────────────────────────────────────────

  function parseCompensation(desc) {
    if (!desc) return ''
    // Match "$120,000 – $150,000/yr", "$75/hr", "$120K+", "120,000 - 150,000 USD"
    const patterns = [
      /\$([\d,]+[kK]?)\s*[-–—]\s*\$([\d,]+[kK]?)(?:\s*\/?\s*(?:yr|year|hour|hr|annual))?/i,
      /\$([\d,]+[kK]?)(?:\s*\/?\s*(?:yr|year|hour|hr|annual|\+))/i,
      /([\d,]{5,})\s*[-–—]\s*([\d,]{5,})\s*(?:USD|usd)/i,
    ]
    for (const re of patterns) {
      const m = desc.match(re)
      if (m) return m[0].replace(/\s+/g, ' ').trim()
    }
    return ''
  }

  function parseWorkArrangement(location, tags, desc) {
    const combined = [location || '', ...(tags || []), (desc || '').slice(0, 800)].join(' ')
    if (/\bremote\b/i.test(combined)) return 'Remote'
    if (/\bhybrid\b/i.test(combined)) return 'Hybrid'
    if (/\bon-?site\b/i.test(combined)) return 'On-site'
    return ''
  }

  function parseJobType(tags, desc) {
    const combined = [...(tags || []), (desc || '').slice(0, 400)].join(' ')
    if (/full[-\s]?time/i.test(combined)) return 'Full-time'
    if (/part[-\s]?time/i.test(combined)) return 'Part-time'
    if (/\bcontract\b/i.test(combined)) return 'Contract'
    if (/\binternship\b/i.test(combined)) return 'Internship'
    return ''
  }

  function parseVisaStatus(desc) {
    if (!desc) return ''
    if (/not eligible for visa|will not sponsor|do not sponsor|does not sponsor|no visa sponsor|sponsorship (is )?not|unable to sponsor|cannot sponsor/i.test(desc))
      return 'No sponsorship'
    if (/visa sponsorship (is |will be |can be )?(available|provided|offered|considered)|we (do |will |can )?sponsor|h-?1b sponsor|sponsorship available/i.test(desc))
      return 'Visa sponsored'
    if (/\bsponsor(ship)?\b/i.test(desc))
      return 'Check posting'
    return ''
  }

  function infoRow(label, value, modifier = '') {
    const row = document.createElement('div')
    row.className = 'rp-info-row'
    const labelEl = document.createElement('span')
    labelEl.className = 'rp-info-row__label'
    labelEl.textContent = label
    const valueEl = document.createElement('span')
    valueEl.className = `rp-info-row__value${modifier ? ` rp-info-row__value--${modifier}` : ''}`
    valueEl.textContent = value
    row.append(labelEl, valueEl)
    return row
  }

  // Enriched browse view: structured card + other jobs list
  function renderJobBrowse(jobs) {
    const primary = jobs[0]
    if (!primary) return

    const desc = (primary.jobDescription || '').replace(/\s+/g, ' ').trim()
    // Prefer salary extracted directly from the DOM card (exact LinkedIn text),
    // fall back to regex parsing of the job description.
    const compensation = primary.salary || parseCompensation(desc)
    const arrangement = parseWorkArrangement(primary.location, primary.tags, desc)
    const jobType = parseJobType(primary.tags, desc)
    const visaStatus = parseVisaStatus(desc)

    // ── Focused job card ──────────────────────────────────────────────────────
    const card = document.createElement('div')
    card.className = 'rp-focus-card'

    // Company row
    const companyRow = document.createElement('div')
    companyRow.className = 'rp-focus-card__company-row'
    const avatar = document.createElement('div')
    avatar.className = 'rp-avatar rp-avatar--lg'
    const initial = (primary.company || '?')[0].toUpperCase()
    const [bg, fg] = avatarColor(primary.company || '')
    if (primary.logoUrl) {
      const img = document.createElement('img')
      img.src = primary.logoUrl
      img.className = 'rp-avatar__img'
      img.onerror = () => { img.remove(); avatar.textContent = initial; avatar.style.cssText = `background:${bg};color:${fg}` }
      avatar.appendChild(img)
    } else {
      avatar.textContent = initial
      avatar.style.cssText = `background:${bg};color:${fg}`
    }
    const companyNameEl = document.createElement('div')
    companyNameEl.className = 'rp-focus-card__company-name'
    companyNameEl.textContent = primary.company || ''
    companyRow.append(avatar, companyNameEl)
    card.appendChild(companyRow)

    // Job title
    if (primary.role) {
      const roleEl = document.createElement('div')
      roleEl.className = 'rp-focus-card__role'
      roleEl.textContent = primary.role
      card.appendChild(roleEl)
    }

    // Time + applicants sub-line
    const subLine = [primary.postedAt, primary.applicantCount].filter(Boolean).join('  ·  ')
    if (subLine) {
      const subEl = document.createElement('div')
      subEl.className = 'rp-focus-card__meta'
      subEl.textContent = subLine
      card.appendChild(subEl)
    }

    // ── Structured info grid ──────────────────────────────────────────────────
    const infoGrid = document.createElement('div')
    infoGrid.className = 'rp-info-grid'

    if (primary.role)           infoGrid.appendChild(infoRow('Job title', primary.role))
    if (primary.company)        infoGrid.appendChild(infoRow('Company', primary.company))
    if (primary.location)       infoGrid.appendChild(infoRow('Location', primary.location))
    if (arrangement)            infoGrid.appendChild(infoRow('Work type', arrangement, arrangement === 'Remote' ? 'green' : ''))
    if (jobType)                infoGrid.appendChild(infoRow('Job type', jobType))
    if (compensation)           infoGrid.appendChild(infoRow('Compensation', compensation, 'highlight'))
    if (visaStatus)             infoGrid.appendChild(infoRow('Visa', visaStatus, visaStatus === 'No sponsorship' ? 'warn' : visaStatus === 'Visa sponsored' ? 'green' : ''))
    if (primary.connections)    infoGrid.appendChild(infoRow('Connections', primary.connections))

    if (infoGrid.children.length) card.appendChild(infoGrid)

    // Description preview
    if (desc) {
      const preview = document.createElement('p')
      preview.className = 'rp-focus-card__desc'
      preview.textContent = desc.length > 160 ? desc.slice(0, 160) + '…' : desc
      card.appendChild(preview)
    }

    panel.appendChild(card)

    // ── Add to Runway button ──────────────────────────────────────────────────
    const addSection = document.createElement('div')
    addSection.className = 'rp-autofill-section'
    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'rp-autofill-btn'
    addBtn.textContent = 'Add to Runway'
    addBtn.addEventListener('click', async () => {
      addBtn.disabled = true
      addBtn.textContent = 'Adding…'
      try {
        const res = await actions.addJob(primary)
        if (!res?.ok) throw new Error(res?.error || 'Failed to add job')
        addBtn.textContent = 'Added ✓'
      } catch (err) {
        addBtn.textContent = 'Add to Runway'
        addBtn.disabled = false
        setStatusMsg(err.message || 'Failed.')
      }
    })
    addSection.appendChild(addBtn)
    panel.appendChild(addSection)

    const statusEl = document.createElement('p')
    statusEl.className = 'rp-status'
    panel.appendChild(statusEl)

    // ── Other detected jobs ───────────────────────────────────────────────────
    if (jobs.length > 1) {
      const divider = document.createElement('div')
      divider.className = 'rp-browse-divider'
      divider.textContent = `${jobs.length - 1} other job${jobs.length > 2 ? 's' : ''} on this page`
      panel.appendChild(divider)
      const list = document.createElement('div')
      list.className = 'rp-browse-list'
      for (const job of jobs.slice(1)) list.appendChild(createJobRow(job))
      panel.appendChild(list)
    }
  }

  function renderJobReview(job) {
    const banner = document.createElement('div')
    banner.className = 'rp-banner'
    const dot = document.createElement('span')
    dot.className = 'rp-banner__dot'
    const msg = document.createElement('span')
    msg.textContent = 'Job details are ready to review.'
    banner.append(dot, msg)
    panel.appendChild(banner)

    const form = document.createElement('div')
    form.className = 'rp-form'

    const titleField = makeField('* Job Title', job.role || '')
    const urlField = makeField('* URL for Original Posting', job.jobUrl || '', 'url')
    const companyField = makeField('* Company Name', job.company || '')

    const descField = document.createElement('div')
    descField.className = 'rp-field'
    const descLabel = document.createElement('label')
    descLabel.className = 'rp-field__label'
    descLabel.textContent = '* Job Description'
    const descInput = document.createElement('textarea')
    descInput.className = 'rp-field__textarea'
    descInput.value = job.jobDescription || ''
    descField.append(descLabel, descInput)

    const errEl = document.createElement('p')
    errEl.className = 'rp-form__error'

    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'rp-save-btn'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true
      saveBtn.textContent = 'Saving…'
      errEl.textContent = ''
      try {
        const res = await actions.addJob({
          ...job,
          role: titleField.input.value.trim(),
          company: companyField.input.value.trim(),
          jobUrl: urlField.input.value.trim(),
          jobDescription: descInput.value,
        })
        if (!res?.ok) throw new Error(res?.error || 'Failed to save job')
        saveBtn.textContent = 'Saved ✓'
        msg.textContent = 'Job saved to Runway!'
      } catch (err) {
        errEl.textContent = err.message || 'Failed to save.'
        saveBtn.disabled = false
        saveBtn.textContent = 'Save'
      }
    })

    form.append(titleField.el, urlField.el, companyField.el, descField, errEl, saveBtn)
    panel.appendChild(form)
  }

  function makeField(labelText, value, type = 'text') {
    const el = document.createElement('div')
    el.className = 'rp-field'
    const label = document.createElement('label')
    label.className = 'rp-field__label'
    label.textContent = labelText
    const input = document.createElement('input')
    input.type = type
    input.className = 'rp-field__input'
    input.value = value
    el.append(label, input)
    return { el, input }
  }

  function createJobRow(job) {
    const row = document.createElement('article')
    row.className = 'runway-panel__row'

    const meta = document.createElement('div')
    meta.className = 'runway-panel__meta'
    const role = document.createElement('div')
    role.className = 'runway-panel__title'
    role.textContent = job.role || 'Untitled role'
    const company = document.createElement('div')
    company.className = 'runway-panel__sub'
    company.textContent = [job.company, job.location].filter(Boolean).join(' · ') || new URL(job.jobUrl).hostname
    meta.append(role, company)

    const actWrap = document.createElement('div')
    actWrap.className = 'runway-panel__actions'
    if (job.jobUrl && job.jobUrl !== location.href) {
      const view = document.createElement('a')
      view.className = 'runway-panel__link'
      view.href = job.jobUrl
      view.textContent = 'View'
      actWrap.appendChild(view)
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'runway-panel__button'
    addBtn.textContent = 'Add'
    addBtn.addEventListener('click', async () => {
      addBtn.textContent = 'Adding…'
      addBtn.disabled = true
      const res = await actions.addJob(job)
      if (res?.ok) { addBtn.textContent = 'Added' } else { addBtn.textContent = 'Add'; addBtn.disabled = false }
    })
    actWrap.appendChild(addBtn)

    row.append(meta, actWrap)
    return row
  }

  // ── Apply mode ───────────────────────────────────────────────────────────────

  function renderApply(context) {
    const selectedApp = context.applications?.find(a => a.id === context.selectedApplicationId)
      || context.applications?.[0]
      || null

    if (selectedApp) {
      panel.appendChild(buildJobCard(selectedApp))
    } else {
      const note = document.createElement('p')
      note.className = 'rp-empty'
      note.textContent = 'Application form detected. Save and prepare the job in Runway first.'
      panel.appendChild(note)
    }

    if (context.applications?.length > 1) {
      const wrap = document.createElement('div')
      wrap.className = 'rp-select-wrap'
      const select = document.createElement('select')
      select.className = 'runway-panel__select'
      for (const app of context.applications) {
        const opt = document.createElement('option')
        opt.value = app.id
        opt.textContent = `${app.company || 'Unknown'} — ${app.role || 'Untitled'}`
        select.appendChild(opt)
      }
      select.value = context.selectedApplicationId || context.applications[0].id
      select.addEventListener('change', () => actions.selectApplication(select.value))
      wrap.appendChild(select)
      panel.appendChild(wrap)
    }

    const autofillSection = document.createElement('div')
    autofillSection.className = 'rp-autofill-section'
    const autofillBtn = document.createElement('button')
    autofillBtn.type = 'button'
    autofillBtn.className = 'rp-autofill-btn'
    autofillBtn.textContent = 'Autofill'
    autofillBtn.addEventListener('click', async () => {
      autofillBtn.disabled = true
      autofillBtn.textContent = 'Autofilling…'
      try {
        const result = await actions.autofill()
        if (typeof result === 'string') setStatusMsg(result)
      } catch (err) {
        setStatusMsg(err.message || 'Autofill failed.')
      } finally {
        autofillBtn.disabled = false
        autofillBtn.textContent = 'Autofill'
      }
    })
    autofillSection.appendChild(autofillBtn)
    panel.appendChild(autofillSection)

    panel.appendChild(buildSection('📋', 'Your Autofill Information', buildAutofillInfoBody))
    panel.appendChild(buildSection('📄', 'Upload Resume', () => buildResumeBody(context)))
    panel.appendChild(buildSection('✉', 'Upload Cover Letter', buildCoverLetterBody))

    const statusEl = document.createElement('p')
    statusEl.className = 'rp-status'
    panel.appendChild(statusEl)

    const bottom = document.createElement('div')
    bottom.className = 'rp-bottom'
    for (const [label, handler, isAsync] of [
      ['Draft answer', actions.draftAnswer, true],
      ['Autofill for Another Job', actions.openRunway, false],
    ]) {
      if (typeof handler !== 'function') continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rp-bottom__link'
      btn.textContent = label
      btn.addEventListener('click', async () => {
        try {
          const r = await handler()
          if (isAsync && typeof r === 'string') setStatusMsg(r)
        } catch (e) { setStatusMsg(e.message || 'Failed.') }
      })
      bottom.appendChild(btn)
    }
    if (bottom.children.length) panel.appendChild(bottom)
  }

  function buildJobCard(app) {
    const card = document.createElement('div')
    card.className = 'rp-job-card'

    const topRow = document.createElement('div')
    topRow.className = 'rp-job-card__top'

    const avatar = document.createElement('div')
    avatar.className = 'rp-avatar'
    const initial = (app.company || '?')[0].toUpperCase()
    const [bg, fg] = avatarColor(app.company || '')
    if (app.logoUrl) {
      const img = document.createElement('img')
      img.src = app.logoUrl
      img.className = 'rp-avatar__img'
      img.onerror = () => { img.remove(); avatar.textContent = initial; avatar.style.cssText = `background:${bg};color:${fg}` }
      avatar.appendChild(img)
    } else {
      avatar.textContent = initial
      avatar.style.cssText = `background:${bg};color:${fg}`
    }

    const nameEl = document.createElement('div')
    nameEl.className = 'rp-job-card__company'
    nameEl.textContent = app.company || ''

    topRow.append(avatar, nameEl)

    if (app.matchScore) {
      const badge = document.createElement('span')
      badge.className = 'rp-match-badge'
      badge.textContent = `${Math.round(app.matchScore)}%`
      topRow.appendChild(badge)
    }

    card.appendChild(topRow)

    if (app.role) {
      const roleEl = document.createElement('div')
      roleEl.className = 'rp-job-card__role'
      roleEl.textContent = app.role
      card.appendChild(roleEl)
    }

    return card
  }

  function buildSection(icon, title, buildBody) {
    const section = document.createElement('div')
    section.className = 'rp-section'

    const row = document.createElement('div')
    row.className = 'rp-section__row'

    const iconEl = document.createElement('span')
    iconEl.className = 'rp-section__icon'
    iconEl.textContent = icon

    const titleEl = document.createElement('span')
    titleEl.className = 'rp-section__title'
    titleEl.textContent = title

    const arrow = document.createElement('span')
    arrow.className = 'rp-section__arrow'
    arrow.textContent = '›'

    row.append(iconEl, titleEl, arrow)
    section.appendChild(row)

    const body = document.createElement('div')
    body.className = 'rp-section__body'
    body.appendChild(buildBody())
    section.appendChild(body)

    return section
  }

  function buildAutofillInfoBody() {
    const wrap = document.createElement('div')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rp-ghost-btn'
    btn.textContent = 'Edit your profile in Runway →'
    btn.addEventListener('click', () => actions.openRunway?.())
    wrap.appendChild(btn)
    return wrap
  }

  function buildResumeBody(context) {
    const wrap = document.createElement('div')
    if (context.defaultResume?.filename || context.defaultResume?.label) {
      const name = document.createElement('p')
      name.className = 'rp-file-name'
      name.textContent = context.defaultResume.filename || context.defaultResume.label
      wrap.appendChild(name)
    }
    wrap.appendChild(makeGhostBtn('Attach base resume', actions.attachBaseResume))
    if (typeof actions.attachTailoredResume === 'function')
      wrap.appendChild(makeGhostBtn('✨ Generate Custom Resume', actions.attachTailoredResume))
    return wrap
  }

  function buildCoverLetterBody() {
    const wrap = document.createElement('div')
    if (typeof actions.generateCoverLetter === 'function')
      wrap.appendChild(makeGhostBtn('✨ Generate Cover Letter', actions.generateCoverLetter))
    if (typeof actions.attachCoverLetter === 'function')
      wrap.appendChild(makeGhostBtn('Attach Cover Letter', actions.attachCoverLetter))
    return wrap
  }

  function makeGhostBtn(label, handler) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rp-ghost-btn'
    btn.textContent = label
    btn.addEventListener('click', async () => {
      btn.disabled = true
      try {
        const r = await handler()
        if (typeof r === 'string') setStatusMsg(r)
      } catch (e) {
        setStatusMsg(e.message || 'Failed.')
      } finally {
        btn.disabled = false
      }
    })
    return btn
  }

  function setStatusMsg(msg) {
    const el = panel.querySelector('.rp-status')
    if (el) el.textContent = msg
  }

  render()
  return { refresh, hide }
}

function safeSendMessage(message) {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return
    const result = chrome.runtime.sendMessage(message)
    if (result?.catch) result.catch(() => {})
  } catch {
    // Ignore stale content scripts after extension reload.
  }
}
