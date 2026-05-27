import { setRunwayButtonContent } from './button-ui.js'

export function createRunwayPanel({ getContext, actions }) {
  let isOpen = true
  let refreshTimer = null

  const root = document.createElement('section')
  root.id = 'runway-assistant-panel'
  root.className = 'runway-panel'
  root.setAttribute('aria-label', 'Runway assistant')

  const launcher = document.createElement('button')
  launcher.type = 'button'
  launcher.className = 'runway-btn runway-panel__launcher'
  launcher.addEventListener('click', () => {
    isOpen = !isOpen
    render()
  })

  const panel = document.createElement('div')
  panel.className = 'runway-panel__body'

  root.append(launcher, panel)

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
    if (!document.body.contains(root)) {
      document.body.appendChild(root)
      root.classList.toggle('runway-panel--on-light', getPageLuminance() > 0.6)
    }
    return true
  }

  function refresh(delay = 0) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(render, delay)
  }

  function hide() {
    root.style.display = 'none'
    safeSendMessage({ type: 'SET_JOB_BADGE', count: 0 })
  }

  function render() {
    if (!attach()) return
    const context = getContext()
    if (!context?.visible) {
      hide()
      return
    }

    root.style.display = 'block'
    const mode = context.mode || 'job'
    const count = context.jobs?.length || 0
    safeSendMessage({ type: 'SET_JOB_BADGE', count: mode === 'job' ? count : 0 })

    setRunwayButtonContent(launcher, mode === 'apply' ? 'Apply with Runway' : count === 1 ? '1 job found' : `${count} jobs found`)
    launcher.setAttribute('aria-expanded', String(isOpen))
    panel.hidden = !isOpen
    panel.replaceChildren()
    if (!isOpen) return

    panel.appendChild(createHeader(context))
    if (mode === 'apply') renderApply(context)
    else renderJobs(context)
  }

  function createHeader(context) {
    const header = document.createElement('div')
    header.className = 'runway-panel__header'

    const copy = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = context.mode === 'apply' ? 'Runway apply assistant' : 'Runway'
    const subtitle = document.createElement('p')
    subtitle.textContent = context.subtitle || (context.mode === 'apply' ? 'Review before submitting.' : 'Save jobs and prepare your resume.')
    copy.append(title, subtitle)

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'runway-panel__close'
    close.textContent = 'Close'
    close.addEventListener('click', () => {
      isOpen = false
      render()
    })

    header.append(copy, close)
    return header
  }

  function renderJobs(context) {
    const list = document.createElement('div')
    list.className = 'runway-panel__list'
    for (const job of context.jobs || []) list.appendChild(createJobRow(job))
    panel.appendChild(list)
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

    const actionsWrap = document.createElement('div')
    actionsWrap.className = 'runway-panel__actions'
    if (job.jobUrl && job.jobUrl !== location.href) {
      const view = document.createElement('a')
      view.className = 'runway-panel__link'
      view.href = job.jobUrl
      view.textContent = 'View'
      actionsWrap.appendChild(view)
    }

    actionsWrap.appendChild(createActionButton('Add', async button => {
      button.textContent = 'Adding'
      const res = await actions.addJob(job)
      if (!res?.ok) throw new Error(res?.error || 'Failed to add job')
      button.textContent = 'Added'
      button.disabled = true
    }))

    row.append(meta, actionsWrap)
    return row
  }

  function renderApply(context) {
    if (context.applications?.length) {
      const select = document.createElement('select')
      select.className = 'runway-panel__select'
      for (const app of context.applications) {
        const option = document.createElement('option')
        option.value = app.id
        option.textContent = `${app.company || 'Unknown'} - ${app.role || 'Untitled'}${app.score ? ` (${app.score})` : ''}`
        select.appendChild(option)
      }
      select.value = context.selectedApplicationId || context.applications[0].id
      select.addEventListener('change', () => actions.selectApplication(select.value))
      panel.appendChild(select)
    }

    const grid = document.createElement('div')
    grid.className = 'runway-panel__grid'
    for (const action of [
      ['Autofill', actions.autofill, true],
      ['Attach base', actions.attachBaseResume, false],
      ['Attach tailored', actions.attachTailoredResume, false],
      ['Generate CV', actions.generateCoverLetter, false],
      ['Attach CV', actions.attachCoverLetter, false],
      ['Draft answer', actions.draftAnswer, false],
      ['Open Runway', actions.openRunway, false],
    ].filter(action => typeof action[1] === 'function')) {
      grid.appendChild(createActionButton(action[0], action[1], action[2]))
    }
    panel.appendChild(grid)

    const status = document.createElement('p')
    status.className = 'runway-panel__status'
    status.textContent = context.status || 'Choose actions as needed. You submit manually.'
    panel.appendChild(status)
  }

  function createActionButton(label, handler, primary = false) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `runway-panel__button${primary ? ' runway-panel__button--primary' : ''}`
    button.textContent = label
    button.addEventListener('click', async () => {
      button.disabled = true
      try {
        const result = await handler(button)
        if (typeof result === 'string') setStatus(result)
      } catch (err) {
        setStatus(err.message || 'Action failed.')
      } finally {
        if (button.textContent !== 'Added') button.disabled = false
      }
    })
    return button
  }

  function setStatus(message) {
    const status = panel.querySelector('.runway-panel__status')
    if (status) status.textContent = message
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
