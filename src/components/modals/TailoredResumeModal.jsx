import { useEffect, useRef, useState } from 'react'
import { X, Download, Save, Eye, Pencil, Loader2, CheckCircle2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import './TailoredResumeModal.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Converts **text** markdown bold to <strong> after HTML-escaping
function renderBold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
            for (const b of e.bullets) html += `<li>${renderBold(b)}</li>`
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
            for (const b of e.bullets) html += `<li>${renderBold(b)}</li>`
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

// ── Fallback text → HTML parser ───────────────────────────────────────────────

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
      html += `<li>${renderBold(line.replace(/^[\-•]\s/, ''))}</li>`
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

// ── Small UI helpers ──────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    // Strip **bold** markdown for plain-text copy
    const plain = text.replace(/\*\*(.+?)\*\*/g, '$1')
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={handleCopy} className={`trm-copy-btn ${className}`} title="Copy">
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="trm-section">
      <button className="trm-section-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && <div className="trm-section-body">{children}</div>}
    </div>
  )
}

// ── Analysis Panel ────────────────────────────────────────────────────────────

function AnalysisPanel({ keywordAnalysis, rewrittenBullets, rewrittenSummary }) {
  const ka = keywordAnalysis ?? { extracted: [], mapped: [], unmappable: [] }
  const summaryText = (rewrittenSummary ?? []).join('\n')

  return (
    <div className="trm-analysis">

      {/* Professional Summary */}
      {rewrittenSummary?.length > 0 && (
        <Section title="Professional Summary">
          <div className="trm-summary-card">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs text-slate-400">Mirrors the JD's top 3 requirements. Ready to paste.</p>
              <CopyButton text={summaryText} className="shrink-0" />
            </div>
            {rewrittenSummary.map((line, i) => (
              <p key={i} className="trm-summary-line">{line}</p>
            ))}
          </div>
        </Section>
      )}

      {/* Rewritten Bullet Points */}
      {rewrittenBullets?.length > 0 && (
        <Section title={`ATS Bullet Points (${rewrittenBullets.length})`}>
          <p className="trm-hint">Keywords in <strong className="text-violet-400">bold</strong>. Copy individual bullets or paste into your resume.</p>
          <ol className="trm-bullet-list">
            {rewrittenBullets.map((bullet, i) => (
              <li key={i} className="trm-bullet-item">
                <span className="trm-bullet-num">{i + 1}</span>
                <span
                  className="trm-bullet-text"
                  dangerouslySetInnerHTML={{ __html: renderBold(bullet) }}
                />
                <CopyButton text={bullet} />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Keywords Added / Strengthened */}
      {ka.mapped.length > 0 && (
        <Section title={`Keywords Mapped (${ka.mapped.length})`}>
          <p className="trm-hint">JD keywords addressed in your tailored resume.</p>
          <div className="trm-keyword-list">
            {ka.mapped.map((m, i) => (
              <div key={i} className="trm-keyword-row trm-keyword-row--green">
                <span className="trm-kw-badge trm-kw-badge--green">{m.keyword}</span>
                <span className="trm-kw-detail">{m.action === 'added' ? 'Added' : 'Strengthened'} via {m.experience}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Keywords That Could Not Be Added */}
      {ka.unmappable.length > 0 && (
        <Section title={`Gaps — Cannot Add (${ka.unmappable.length})`} defaultOpen={false}>
          <p className="trm-hint">These JD requirements have no matching experience in your resume.</p>
          <div className="trm-keyword-list">
            {ka.unmappable.map((kw, i) => (
              <span key={i} className="trm-kw-badge trm-kw-badge--red">{kw}</span>
            ))}
          </div>
        </Section>
      )}

      {/* All Extracted Keywords */}
      {ka.extracted.length > 0 && (
        <Section title={`All JD Keywords (${ka.extracted.length})`} defaultOpen={false}>
          <p className="trm-hint">Every hard skill, tool, and framework found in the job description.</p>
          <div className="trm-keyword-list">
            {ka.extracted.map((kw, i) => {
              const isUnmappable = ka.unmappable.includes(kw)
              return (
                <span key={i} className={`trm-kw-badge ${isUnmappable ? 'trm-kw-badge--red' : 'trm-kw-badge--slate'}`}>
                  {kw}
                </span>
              )
            })}
          </div>
        </Section>
      )}

    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function TailoredResumeModal({
  job,
  initialSections,
  initialHtml,
  initialText,
  keywordAnalysis,
  rewrittenBullets,
  rewrittenSummary,
  onSave,
  onClose,
}) {
  const editorRef = useRef(null)
  const sectionsRef = useRef(initialSections)
  const [mode, setMode] = useState('edit')
  const [activeTab, setActiveTab] = useState('analysis')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasAnalysis = (keywordAnalysis?.mapped?.length || keywordAnalysis?.unmappable?.length || rewrittenBullets?.length || rewrittenSummary?.length)

  const startHtml = (() => {
    if (initialSections?.length) return sectionsToHtml(initialSections)
    if (initialHtml) return initialHtml
    return parseResumeToHtml(initialText || '')
  })()

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = startHtml
    }
  }, [])

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
  ul.rp-list li strong { font-weight: 700; }
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Resume edit/preview toggle — shown only when resume tab is active or on desktop */}
            <div className={`trm-mode-toggle ${activeTab !== 'resume' ? 'hidden lg:flex' : 'flex'}`}>
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

            <button onClick={handleDownload} className="trm-action-btn hidden sm:flex">
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

        {/* Mobile tab bar */}
        {hasAnalysis && (
          <div className="trm-tab-bar lg:hidden">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`trm-tab ${activeTab === 'analysis' ? 'trm-tab-active' : 'trm-tab-idle'}`}
            >
              Analysis
            </button>
            <button
              onClick={() => setActiveTab('resume')}
              className={`trm-tab ${activeTab === 'resume' ? 'trm-tab-active' : 'trm-tab-idle'}`}
            >
              Resume
            </button>
          </div>
        )}

        {/* Main content — side by side on desktop, tabbed on mobile */}
        <div className="trm-content">

          {/* Analysis panel */}
          {hasAnalysis && (
            <div className={`trm-analysis-col ${activeTab === 'analysis' ? 'flex' : 'hidden'} lg:flex`}>
              <AnalysisPanel
                keywordAnalysis={keywordAnalysis}
                rewrittenBullets={rewrittenBullets}
                rewrittenSummary={rewrittenSummary}
              />
            </div>
          )}

          {/* Resume panel */}
          <div className={`trm-resume-col ${activeTab === 'resume' || !hasAnalysis ? 'flex' : 'hidden'} lg:flex`}>
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
    </div>
  )
}
