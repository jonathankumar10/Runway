import { useEffect, useRef, useState } from 'react'
import { X, Download, Save, Eye, Pencil, Loader2, CheckCircle2 } from 'lucide-react'
import './TailoredResumeModal.css'

// ── HTML helpers ──────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Structured sections → HTML ────────────────────────────────────────────────

export function sectionsToHtml(sections) {
  if (!Array.isArray(sections) || !sections.length) return ''
  let html = ''

  for (const sec of sections) {
    switch (sec.type) {
      case 'header':
        html += `<h1 class="rp-name">${esc(sec.name)}</h1>`
        if (sec.contact?.length) {
          html += `<p class="rp-contact">${sec.contact.map(esc).join(' | ')}</p>`
        }
        break

      case 'experience':
        html += `<h2 class="rp-section">${esc(sec.title)}</h2>`
        for (const e of sec.entries ?? []) {
          const left = [
            e.role ? `<strong>${esc(e.role)}</strong>` : null,
            e.company ? esc(e.company) : null,
          ].filter(Boolean).join(', ')
          const right = [e.dates, e.location].filter(Boolean).map(esc).join(' | ')
          html += `<p class="rp-title-row"><span>${left}</span><span class="rp-date">${right}</span></p>`
          if (e.bullets?.length) {
            html += '<ul class="rp-list">'
            for (const b of e.bullets) html += `<li>${esc(b)}</li>`
            html += '</ul>'
          }
        }
        break

      case 'education':
        html += `<h2 class="rp-section">${esc(sec.title)}</h2>`
        for (const e of sec.entries ?? []) {
          const left = [
            e.degree ? `<strong>${esc(e.degree)}</strong>` : null,
            e.school ? esc(e.school) : null,
          ].filter(Boolean).join(', ')
          const right = [e.dates, e.location].filter(Boolean).map(esc).join(' | ')
          html += `<p class="rp-title-row"><span>${left}</span><span class="rp-date">${right}</span></p>`
          for (const d of e.details ?? []) html += `<p class="rp-body">${esc(d)}</p>`
        }
        break

      case 'skills':
        html += `<h2 class="rp-section">${esc(sec.title)}</h2>`
        for (const grp of sec.groups ?? []) {
          const items = (grp.items ?? []).map(esc).join(', ')
          html += grp.label
            ? `<p class="rp-body"><strong>${esc(grp.label)}</strong> — ${items}</p>`
            : `<p class="rp-body">${items}</p>`
        }
        break

      case 'generic':
        html += `<h2 class="rp-section">${esc(sec.title)}</h2>`
        for (const e of sec.entries ?? []) {
          if (e.heading) {
            const right = e.subheading ? `<span class="rp-date">${esc(e.subheading)}</span>` : ''
            html += `<p class="rp-title-row"><span><strong>${esc(e.heading)}</strong></span>${right}</p>`
          }
          if (e.bullets?.length) {
            html += '<ul class="rp-list">'
            for (const b of e.bullets) html += `<li>${esc(b)}</li>`
            html += '</ul>'
          }
        }
        break

      default:
        break
    }
  }

  return html
}

// ── Fallback text → HTML parser (for legacy saved resumes) ───────────────────

const isHeader = line =>
  line.length > 2 &&
  line === line.toUpperCase() &&
  /[A-Z]/.test(line) &&
  !/^\d/.test(line) &&
  !/[|@]/.test(line)

const isBullet = line => /^[\-•]\s/.test(line)

export function parseResumeToHtml(text) {
  if (!text) return ''
  const lines = text.split('\n')
  let html = ''
  let inList = false
  let headerDone = false
  let nameWritten = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) {
      if (inList) { html += '</ul>'; inList = false }
      html += '<div class="rp-spacer"></div>'
      continue
    }

    if (isHeader(line)) {
      if (inList) { html += '</ul>'; inList = false }
      headerDone = true
      html += `<h2 class="rp-section">${esc(line)}</h2>`
      continue
    }

    if (isBullet(line)) {
      if (!inList) { html += '<ul class="rp-list">'; inList = true }
      html += `<li>${esc(line.replace(/^[\-•]\s/, ''))}</li>`
      continue
    }

    if (inList) { html += '</ul>'; inList = false }

    if (!headerDone) {
      if (!nameWritten) {
        html += `<h1 class="rp-name">${esc(line)}</h1>`
        nameWritten = true
      } else {
        html += `<p class="rp-contact">${esc(line)}</p>`
      }
    } else {
      const isTitleRow = /\|/.test(line) || /\b(20\d{2}|Present|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(line)
      html += isTitleRow
        ? `<p class="rp-title-row">${esc(line)}</p>`
        : `<p class="rp-body">${esc(line)}</p>`
    }
  }

  if (inList) html += '</ul>'
  return html
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function TailoredResumeModal({ job, initialSections, initialHtml, initialText, onSave, onClose }) {
  const editorRef = useRef(null)
  const sectionsRef = useRef(initialSections)   // keep for save callback
  const [mode, setMode] = useState('edit')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Derive starting HTML: structured sections first, then stored HTML, then parse text
  const startHtml = (() => {
    if (initialSections?.length) return sectionsToHtml(initialSections)
    if (initialHtml) return initialHtml
    return parseResumeToHtml(initialText || '')
  })()

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = startHtml
    }
  }, []) // only seed on mount

  function handleSave() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const text = editorRef.current.innerText
    setSaving(true)
    Promise.resolve(onSave(html, text, sectionsRef.current)).finally(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  function handleDownload() {
    const html = editorRef.current?.innerHTML ?? startHtml
    const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${job?.company ?? 'Resume'} – ${job?.role ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: #fff; padding: 0.75in; }
  h1.rp-name { font-size: 22pt; font-weight: bold; text-align: center; letter-spacing: -0.3px; margin-bottom: 4px; }
  p.rp-contact { font-size: 10pt; color: #555; text-align: center; margin-bottom: 2px; font-family: system-ui, sans-serif; }
  h2.rp-section { font-family: system-ui, sans-serif; font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1565C0; border-bottom: 1.5px solid #1565C0; padding-bottom: 2px; margin: 16px 0 6px; }
  p.rp-title-row { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; font-size: 10.5pt; margin: 6px 0 2px; }
  .rp-date { font-weight: normal; font-size: 10pt; color: #333; white-space: nowrap; margin-left: 8px; }
  p.rp-body { font-size: 10.5pt; margin: 2px 0; }
  ul.rp-list { padding-left: 18px; margin: 2px 0 4px; }
  ul.rp-list li { font-size: 10.5pt; margin-bottom: 2px; line-height: 1.45; }
  .rp-spacer { height: 4px; }
  @page { margin: 0.75in; size: Letter; }
</style>
</head>
<body>${html}</body>
</html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    iframe.contentDocument.open()
    iframe.contentDocument.write(printHtml)
    iframe.contentDocument.close()
    iframe.contentWindow.focus()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }

  return (
    <div className="trm-overlay" onClick={onClose}>
      <div className="trm-modal" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="trm-toolbar">
          <div className="flex items-center gap-3 min-w-0">
            <div className="trm-toolbar-icon" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                Tailored Resume — {job?.company}
              </p>
              <p className="text-xs text-slate-400 truncate">{job?.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="trm-mode-toggle">
              <button
                onClick={() => setMode('edit')}
                className={`trm-mode-btn ${mode === 'edit' ? 'trm-mode-btn-active' : 'trm-mode-btn-idle'}`}
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`trm-mode-btn ${mode === 'preview' ? 'trm-mode-btn-active' : 'trm-mode-btn-idle'}`}
              >
                <Eye size={11} /> Preview
              </button>
            </div>

            <button onClick={handleDownload} className="trm-action-btn">
              <Download size={13} /> Download PDF
            </button>

            <button onClick={handleSave} disabled={saving} className="trm-save-btn">
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : saved ? (
                <CheckCircle2 size={13} className="text-green-400" />
              ) : (
                <Save size={13} />
              )}
              {saved ? 'Saved!' : 'Save'}
            </button>

            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resume paper */}
        <div className="trm-body">
          {mode === 'edit' && (
            <p className="trm-edit-hint">Click anywhere on the resume to edit</p>
          )}
          <div className="trm-paper-wrap">
            <div
              ref={editorRef}
              contentEditable={mode === 'edit'}
              suppressContentEditableWarning
              spellCheck={mode === 'edit'}
              className={`trm-paper ${mode === 'edit' ? 'trm-paper-editable' : ''}`}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
