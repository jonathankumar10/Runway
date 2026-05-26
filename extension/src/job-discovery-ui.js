import { setRunwayButtonContent } from './button-ui.js'

const MAX_VISIBLE_JOBS = 8

export function createJobDiscoveryUI({ getJobs, addJob }) {
  let jobs = []
  let isOpen = false
  let refreshTimer = null
  let currentJobKey = ''
  let dismissedJobKey = ''

  const root = document.createElement('div')
  root.id = 'runway-job-discovery'
  root.className = 'runway-discovery'

  const launcher = document.createElement('button')
  launcher.type = 'button'
  launcher.className = 'runway-btn runway-btn--floating runway-discovery__launcher'
  launcher.addEventListener('click', () => {
    isOpen = !isOpen
    if (isOpen) dismissedJobKey = ''
    else dismissedJobKey = currentJobKey
    render()
  })

  const panel = document.createElement('section')
  panel.className = 'runway-discovery__panel'
  panel.setAttribute('aria-label', 'Runway job matches')

  root.append(launcher, panel)

  function attach() {
    if (!document.body.contains(root)) document.body.appendChild(root)
  }

  function setBadge(count) {
    safeSendMessage({ type: 'SET_JOB_BADGE', count })
  }

  function scheduleRefresh(delay = 250) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, delay)
  }

  function setVisible(visible) {
    root.style.display = visible ? 'block' : 'none'
    if (!visible) {
      isOpen = false
      setBadge(0)
    }
  }

  function refresh() {
    attach()
    jobs = dedupeJobs(getJobs()).slice(0, MAX_VISIBLE_JOBS)
    const nextJobKey = jobs.map(job => job.jobUrl).join('|')
    if (jobs.length > 0 && nextJobKey !== currentJobKey && nextJobKey !== dismissedJobKey) {
      isOpen = true
    }
    currentJobKey = nextJobKey
    setBadge(jobs.length)
    setVisible(jobs.length > 0)
    render()
  }

  function render() {
    const count = jobs.length
    const label = count === 1 ? '1 job found' : `${count} jobs found`
    setRunwayButtonContent(launcher, label)
    launcher.setAttribute('aria-expanded', String(isOpen))

    panel.replaceChildren()
    panel.hidden = !isOpen
    if (!isOpen) return

    const header = document.createElement('div')
    header.className = 'runway-discovery__header'

    const title = document.createElement('strong')
    title.textContent = count === 1 ? 'Job available' : 'Jobs available'

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'runway-discovery__close'
    close.textContent = 'Close'
    close.addEventListener('click', () => {
      isOpen = false
      dismissedJobKey = currentJobKey
      render()
    })

    header.append(title, close)
    panel.appendChild(header)

    const list = document.createElement('div')
    list.className = 'runway-discovery__list'
    for (const job of jobs) list.appendChild(createJobRow(job))
    panel.appendChild(list)
  }

  function createJobRow(job) {
    const row = document.createElement('article')
    row.className = 'runway-discovery__job'

    const meta = document.createElement('div')
    meta.className = 'runway-discovery__job-meta'

    const role = document.createElement('div')
    role.className = 'runway-discovery__role'
    role.textContent = job.role || 'Untitled role'

    const company = document.createElement('div')
    company.className = 'runway-discovery__company'
    company.textContent = [job.company, job.location].filter(Boolean).join(' · ') || new URL(job.jobUrl).hostname

    meta.append(role, company)

    const actions = document.createElement('div')
    actions.className = 'runway-discovery__actions'

    if (job.jobUrl && job.jobUrl !== location.href) {
      const view = document.createElement('a')
      view.className = 'runway-discovery__link'
      view.href = job.jobUrl
      view.textContent = 'View'
      actions.appendChild(view)
    }

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'runway-discovery__add'
    add.textContent = 'Add'
    add.addEventListener('click', async () => {
      add.disabled = true
      add.textContent = 'Adding'
      try {
        const res = await addJob(job)
        if (res?.ok) {
          add.textContent = 'Added'
          row.classList.add('runway-discovery__job--added')
        } else {
          add.disabled = false
          add.textContent = 'Retry'
          row.title = res?.error || 'Failed to add job'
        }
      } catch {
        add.disabled = false
        add.textContent = 'Retry'
        row.title = 'Open the Runway extension popup and sign in first'
      }
    })
    actions.appendChild(add)

    row.append(meta, actions)
    return row
  }

  refresh()
  return { refresh: scheduleRefresh, hide: () => setVisible(false) }
}

function safeSendMessage(message) {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return
    const result = chrome.runtime.sendMessage(message)
    if (result?.catch) result.catch(() => {})
  } catch {
    // The tab can outlive a reloaded extension context. Ignore stale-script sends.
  }
}

function dedupeJobs(items = []) {
  const seen = new Set()
  const jobs = []
  for (const item of items) {
    if (!item?.jobUrl) continue
    const key = item.jobUrl.replace(/[?#].*$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    jobs.push(item)
  }
  return jobs
}
