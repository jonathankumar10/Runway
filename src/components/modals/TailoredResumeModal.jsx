import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Download, Save, Eye, EyeOff, Pencil, Loader2, CheckCircle2, Copy, Check,
  ChevronDown, ChevronUp, GripVertical, GraduationCap, Briefcase, AlignLeft,
  Sparkles, User, FileText,
} from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ALL_TEMPLATE_META, getTemplateVars, FONT_OPTIONS, FONT_SIZE_OPTIONS, LINE_SPACING_OPTIONS, MARGIN_OPTIONS } from '../../constants/resumeTemplates'
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

function toTitleCase(str) {
  if (!str) return str
  const trimmed = str.trim()
  if (trimmed !== trimmed.toUpperCase()) return trimmed
  return trimmed.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function sectionsToHtml(sections) {
  if (!Array.isArray(sections) || !sections.length) return ''
  let html = ''

  for (const sec of sections) {
    switch (sec.type) {
      case 'header':
        html += `<h1 class="rp-name">${esc(toTitleCase(sec.name))}</h1>`
        if (sec.contact?.length) {
          html += `<p class="rp-contact">${sec.contact.map(esc).join(' | ')}</p>`
        }
        break

      case 'summary':
        html += `<h2 class="rp-section">${esc(sec.title)}</h2>`
        for (const b of sec.bullets ?? []) {
          html += `<p class="rp-body rp-summary-line">${renderBold(b)}</p>`
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
            const urlMatch = e.heading.match(/\s*\|\s*(https?:\/\/\S+)/)
            const headingText = urlMatch ? e.heading.slice(0, e.heading.indexOf(urlMatch[0])).trim() : e.heading
            const url = urlMatch ? urlMatch[1] : null
            const urlHtml = url ? ` <a href="${esc(url)}" class="rp-url">${esc(url)}</a>` : ''
            const right = e.subheading ? `<span class="rp-date">${esc(e.subheading)}</span>` : ''
            html += `<p class="rp-title-row"><span><strong>${esc(headingText)}</strong>${urlHtml}</span>${right}</p>`
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

// ── Print CSS builder ─────────────────────────────────────────────────────────

function buildPrintCss(vars) {
  const v = (key, fallback) => vars?.[key] ?? fallback
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: ${v('--rp-font-body', "'Georgia', serif")}; font-size: ${v('--rp-print-body-size', '9.5pt')}; color: #111; background: #fff; padding: ${v('--rp-print-padding', '0.44in')}; line-height: ${v('--rp-print-line-height', '1.3')}; }
    h1.rp-name { font-size: calc(${v('--rp-name-size', '18pt')} * 0.88); font-weight: bold; text-align: center; margin-bottom: 2px; }
    p.rp-contact { font-size: calc(${v('--rp-print-body-size', '9pt')} * 0.95); color: #444; text-align: center; font-family: ${v('--rp-font-heading', 'system-ui, sans-serif')}; line-height: ${v('--rp-print-line-height', '1.3')}; margin-bottom: 1px; }
    h2.rp-section { font-family: ${v('--rp-font-heading', 'system-ui, sans-serif')}; font-size: ${v('--rp-print-section-size', '8.5pt')}; font-weight: ${v('--rp-section-weight', '700')}; text-transform: ${v('--rp-section-case', 'uppercase')}; letter-spacing: 0.6px; color: ${v('--rp-accent', '#0369a1')}; border-bottom: ${v('--rp-section-border', '1.2px solid #0369a1')}; padding-bottom: 1px; margin: 7px 0 2px; }
    p.rp-title-row { overflow: hidden; font-weight: 600; font-size: ${v('--rp-print-body-size', '9.5pt')}; margin: 3px 0 1px; }
    .rp-date { float: right; font-weight: normal; font-size: calc(${v('--rp-print-body-size', '9pt')} * 0.95); color: #333; white-space: nowrap; margin-left: 8px; }
    p.rp-body { font-size: ${v('--rp-print-body-size', '9.5pt')}; margin: 0; line-height: ${v('--rp-print-line-height', '1.3')}; }
    p.rp-summary-line { margin-bottom: 2px; }
    ul.rp-list { list-style-type: disc; padding-left: 13px; margin: 1px 0 2px; }
    ul.rp-list li { font-size: ${v('--rp-print-body-size', '9.5pt')}; margin-bottom: 0; line-height: ${v('--rp-print-line-height', '1.3')}; }
    ul.rp-list li strong { font-weight: 700; }
    a.rp-url { color: ${v('--rp-accent', '#0369a1')}; font-size: 8pt; font-weight: normal; text-decoration: none; }
    .rp-spacer { height: 1px; }
    @media print { @page { margin: ${v('--rp-print-padding', '0.48in')}; size: Letter; } }
  `
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

// ── Section icon / label map ──────────────────────────────────────────────────

const SECTION_ICONS = {
  header: User,
  summary: AlignLeft,
  experience: Briefcase,
  education: GraduationCap,
  skills: Sparkles,
  generic: FileText,
}

function getSectionDisplayTitle(section) {
  if (section.type === 'header') return 'Name & Contact'
  return section.title ?? section.type ?? 'Section'
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
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

// Collapsible section used in both AnalysisPanel and BuilderPanel.
// noPadding skips the trm-section-body wrapper (builder rows handle their own padding).
function Section({ title, children, defaultOpen = true, noPadding = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="trm-section">
      <button className="trm-section-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        noPadding
          ? <div>{children}</div>
          : <div className="trm-section-body">{children}</div>
      )}
    </div>
  )
}

// ── SortableSectionItem ───────────────────────────────────────────────────────

function SortableSectionItem({ section, onToggleVisibility }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: section._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const SectionIcon = SECTION_ICONS[section.type] ?? FileText
  const isVisible = section._visible !== false

  return (
    <div ref={setNodeRef} style={style} className="trm-section-item" {...attributes}>
      <button className="trm-drag-handle" {...listeners} tabIndex={-1}>
        <GripVertical size={14} />
      </button>
      <SectionIcon size={13} className="trm-section-icon" />
      <span className={`trm-section-title-text ${isVisible ? '' : 'line-through opacity-50'}`}>
        {getSectionDisplayTitle(section)}
      </span>
      <button
        onClick={() => onToggleVisibility(section._id)}
        className="trm-visibility-btn"
        title={isVisible ? 'Hide section' : 'Show section'}
      >
        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  )
}

// ── SectionsSubPanel ──────────────────────────────────────────────────────────

function SectionsSubPanel({ sections, onSectionsChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = sections.findIndex(s => s._id === active.id)
      const newIdx = sections.findIndex(s => s._id === over.id)
      onSectionsChange(arrayMove(sections, oldIdx, newIdx))
    }
  }

  function handleToggleVisibility(id) {
    onSectionsChange(sections.map(s => {
      if (s._id !== id) return s
      const nowVisible = s._visible !== false
      return { ...s, _visible: !nowVisible }
    }))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map(s => s._id)} strategy={verticalListSortingStrategy}>
        {sections.map(s => (
          <SortableSectionItem
            key={s._id}
            section={s}
            onToggleVisibility={handleToggleVisibility}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

// ── StyleSubPanel ─────────────────────────────────────────────────────────────

function StyleSubPanel({ activeVars, onStyleOverride, onAccentChange }) {
  const colorDebounce = useRef(null)
  const currentFont        = activeVars?.['--rp-font-body']            ?? FONT_OPTIONS[0].value
  const currentBodySize    = activeVars?.['--rp-print-body-size']      ?? '9pt'
  const currentLineSpacing = activeVars?.['--rp-print-line-height']    ?? '1.3'
  const currentMargin      = activeVars?.['--rp-print-padding']        ?? '0.44in'
  const currentAccent      = activeVars?.['--rp-accent']               ?? '#1565C0'
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(currentAccent) ? currentAccent : '#1565C0'

  function handleFontChange(value) {
    onStyleOverride('--rp-font-body', value)
    onStyleOverride('--rp-font-heading', value)
  }

  function handleBodySizeChange(value) {
    const opt = FONT_SIZE_OPTIONS.find(f => f.value === value)
    onStyleOverride('--rp-print-body-size', value)
    if (opt?.sectionSize) onStyleOverride('--rp-print-section-size', opt.sectionSize)
  }

  function handleColorChange(e) {
    const hex = e.target.value
    if (colorDebounce.current) clearTimeout(colorDebounce.current)
    colorDebounce.current = setTimeout(() => onAccentChange(hex), 80)
  }

  return (
    <div>
      <div className="trm-builder-row">
        <span className="trm-builder-label">Font</span>
        <select className="trm-builder-select" value={currentFont} onChange={e => handleFontChange(e.target.value)}>
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="trm-builder-row">
        <span className="trm-builder-label">Font size</span>
        <select className="trm-builder-select" value={currentBodySize} onChange={e => handleBodySizeChange(e.target.value)}>
          {FONT_SIZE_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="trm-builder-row">
        <span className="trm-builder-label">Line spacing</span>
        <select className="trm-builder-select" value={currentLineSpacing} onChange={e => onStyleOverride('--rp-print-line-height', e.target.value)}>
          {LINE_SPACING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="trm-builder-row">
        <span className="trm-builder-label">Margins</span>
        <select className="trm-builder-select" value={currentMargin} onChange={e => onStyleOverride('--rp-print-padding', e.target.value)}>
          {MARGIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="trm-builder-row">
        <span className="trm-builder-label">Accent color</span>
        <input
          type="color"
          className="trm-color-input"
          defaultValue={safeAccent}
          key={safeAccent}
          onChange={handleColorChange}
        />
      </div>
    </div>
  )
}

// ── BuilderPanel ──────────────────────────────────────────────────────────────

function BuilderPanel({ sections, onSectionsChange, activeVars, onStyleOverride, onAccentChange }) {
  return (
    <div className="trm-builder">
      <Section title="Style" noPadding>
        <StyleSubPanel
          activeVars={activeVars}
          onStyleOverride={onStyleOverride}
          onAccentChange={onAccentChange}
        />
      </Section>
      <Section title="Sections" noPadding>
        {sections.length > 0
          ? (
            <SectionsSubPanel
              sections={sections}
              onSectionsChange={onSectionsChange}
            />
          )
          : (
            <p className="text-xs text-slate-500 px-4 py-3 leading-relaxed">
              Re-generate the resume to enable section editing.
            </p>
          )
        }
      </Section>
    </div>
  )
}

// ── Analysis Panel ────────────────────────────────────────────────────────────

function AnalysisPanel({ keywordAnalysis, rewrittenBullets, rewrittenSummary }) {
  const ka = keywordAnalysis ?? { extracted: [], mapped: [], unmappable: [] }
  const summaryText = (rewrittenSummary ?? []).join('\n')

  return (
    <div className="trm-analysis">

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
  initialTemplate,
  initialStyleOverrides,
  styleMap,
  keywordAnalysis,
  rewrittenBullets,
  rewrittenSummary,
  onSave,
  onClose,
}) {
  const editorRef = useRef(null)
  const sectionsEffectSkip = useRef(true)
  const [mode, setMode] = useState('edit')
  const [activeTab, setActiveTab] = useState('builder')
  const [activeLeftTab, setActiveLeftTab] = useState('builder')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templateId, setTemplateId] = useState(
    initialTemplate ?? localStorage.getItem('runway_resumeTemplate') ?? 'classic'
  )
  const [styleOverrides, setStyleOverrides] = useState(initialStyleOverrides ?? {})
  const [sections, setSections] = useState(() =>
    (initialSections ?? []).map((s, i) => ({
      ...s,
      _id: `${s.type ?? 'sec'}-${i}`,
      _visible: s._visible !== false,
    }))
  )

  const activeVars = useMemo(
    () => ({ ...getTemplateVars(templateId, styleMap), ...styleOverrides }),
    [templateId, styleMap, styleOverrides]
  )

  function handleSelectTemplate(id) {
    if (id === 'original' && !styleMap) return
    setTemplateId(id)
    localStorage.setItem('runway_resumeTemplate', id)
  }

  function handleStyleOverride(key, value) {
    setStyleOverrides(prev => ({ ...prev, [key]: value }))
  }

  function handleAccentChange(hex) {
    setStyleOverrides(prev => ({
      ...prev,
      '--rp-accent': hex,
      '--rp-section-border': `1.5px solid ${hex}`,
    }))
  }

  const hasAnalysis = !!(
    keywordAnalysis?.mapped?.length ||
    keywordAnalysis?.unmappable?.length ||
    rewrittenBullets?.length ||
    rewrittenSummary?.length
  )

  const startHtml = (() => {
    if (initialSections?.length) return sectionsToHtml(initialSections)
    if (initialHtml) return initialHtml
    return parseResumeToHtml(initialText || '')
  })()

  // Mount: populate paper with initial HTML
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = startHtml
    }
  }, [])

  // Reactive: rebuild paper when sections change (skip the initial fire on mount)
  useEffect(() => {
    if (sectionsEffectSkip.current) {
      sectionsEffectSkip.current = false
      return
    }
    if (!sections.length || !editorRef.current) return
    editorRef.current.innerHTML = sectionsToHtml(sections.filter(s => s._visible !== false))
  }, [sections])

  function handleSave() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const text = editorRef.current.innerText
    // Strip runtime _id field before saving; keep _visible so hidden sections stay hidden on reopen
    const cleanSections = sections.map(({ _id, ...rest }) => rest)
    setSaving(true)
    Promise.resolve(onSave(html, text, cleanSections, templateId, styleOverrides)).finally(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  function handleDownload() {
    const html = editorRef.current?.innerHTML ?? startHtml

    const autoFitScript = `
(function () {
  var MIN_SCALE = 0.82;
  var AVAILABLE_PX = (11 - 0.44 * 2) * 96;

  function fitAndPrint() {
    var contentH = document.body.scrollHeight;
    if (contentH > AVAILABLE_PX) {
      var scale = Math.max(MIN_SCALE, AVAILABLE_PX / contentH);
      document.documentElement.style.zoom = scale.toFixed(4);
      if ((AVAILABLE_PX / contentH) < MIN_SCALE) {
        var note = document.createElement('p');
        note.style.cssText = 'font-family:system-ui,sans-serif;font-size:6pt;color:#bbb;text-align:center;margin-top:8px;padding-top:4px;border-top:0.5px solid #eee;';
        note.textContent = 'Resume condensed to fit one page — consider trimming older experience.';
        document.body.appendChild(note);
      }
    }
    window.print();
    setTimeout(function () { window.close(); }, 2000);
  }

  if (document.readyState === 'complete') {
    setTimeout(fitAndPrint, 120);
  } else {
    window.addEventListener('load', function () { setTimeout(fitAndPrint, 120); });
  }
})();`

    const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${job?.company ?? 'Resume'} – ${job?.role ?? ''}</title>
<style>${buildPrintCss(activeVars)}</style>
</head>
<body>${html}</body>
<script>${autoFitScript}<\/script>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(printHtml)
      win.document.close()
      win.focus()
    } else {
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
      }, 400)
    }
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

            {/* Template swatch picker — desktop */}
            <TemplatePicker
              templateId={templateId}
              onSelect={handleSelectTemplate}
              hasStyleMap={!!styleMap}
              className="hidden sm:flex"
            />

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

        {/* Mobile tab bar — always shown */}
        <div className="trm-tab-bar lg:hidden">
          <button
            onClick={() => setActiveTab('builder')}
            className={`trm-tab ${activeTab === 'builder' ? 'trm-tab-active' : 'trm-tab-idle'}`}
          >
            Builder
          </button>
          {hasAnalysis && (
            <button
              onClick={() => setActiveTab('analysis')}
              className={`trm-tab ${activeTab === 'analysis' ? 'trm-tab-active' : 'trm-tab-idle'}`}
            >
              Analysis
            </button>
          )}
          <button
            onClick={() => setActiveTab('resume')}
            className={`trm-tab ${activeTab === 'resume' ? 'trm-tab-active' : 'trm-tab-idle'}`}
          >
            Resume
          </button>
        </div>

        {/* Mobile template strip — shown above paper when on resume tab */}
        {activeTab === 'resume' && (
          <div className="trm-template-strip sm:hidden">
            <span className="trm-template-strip-label">Style</span>
            <TemplatePicker
              templateId={templateId}
              onSelect={handleSelectTemplate}
              hasStyleMap={!!styleMap}
            />
          </div>
        )}

        {/* Main content — side by side on desktop, tabbed on mobile */}
        <div className="trm-content">

          {/* Left panel — Builder / Analysis */}
          <div className={`trm-analysis-col ${(activeTab === 'builder' || activeTab === 'analysis') ? 'flex' : 'hidden'} lg:flex`}>

            {/* Inner tab bar (desktop only, only when analysis data exists) */}
            {hasAnalysis && (
              <div className="trm-tab-bar sticky top-0 z-10">
                <button
                  onClick={() => setActiveLeftTab('builder')}
                  className={`trm-tab ${activeLeftTab === 'builder' ? 'trm-tab-active' : 'trm-tab-idle'}`}
                >
                  Builder
                </button>
                <button
                  onClick={() => setActiveLeftTab('analysis')}
                  className={`trm-tab ${activeLeftTab === 'analysis' ? 'trm-tab-active' : 'trm-tab-idle'}`}
                >
                  Analysis
                </button>
              </div>
            )}

            {/* Builder panel */}
            <div className={[
              activeTab === 'builder' ? '' : 'hidden',
              (!hasAnalysis || activeLeftTab === 'builder') ? 'lg:block' : 'lg:hidden',
            ].join(' ')}>
              <BuilderPanel
                sections={sections}
                onSectionsChange={setSections}
                activeVars={activeVars}
                onStyleOverride={handleStyleOverride}
                onAccentChange={handleAccentChange}
              />
            </div>

            {/* Analysis panel */}
            {hasAnalysis && (
              <div className={[
                activeTab === 'analysis' ? '' : 'hidden',
                activeLeftTab === 'analysis' ? 'lg:block' : 'lg:hidden',
              ].join(' ')}>
                <AnalysisPanel
                  keywordAnalysis={keywordAnalysis}
                  rewrittenBullets={rewrittenBullets}
                  rewrittenSummary={rewrittenSummary}
                />
              </div>
            )}
          </div>

          {/* Resume panel */}
          <div className={`trm-resume-col ${activeTab === 'resume' ? 'flex' : 'hidden'} lg:flex`}>
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
                style={activeVars}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── TemplatePicker ─────────────────────────────────────────────────────────────

const SWATCH_FONT_CHAR = { serif: 'S', sans: 'A', mono: 'M' }

function TemplatePicker({ templateId, onSelect, hasStyleMap, className = '' }) {
  return (
    <div className={`trm-template-picker ${className}`} title="Choose resume style">
      {ALL_TEMPLATE_META.map(t => {
        const isOriginal = t.id === 'original'
        const disabled = isOriginal && !hasStyleMap
        const active = templateId === t.id
        return (
          <button
            key={t.id}
            onClick={() => !disabled && onSelect(t.id)}
            className={`trm-swatch ${active ? 'trm-swatch-active' : ''} ${disabled ? 'trm-swatch-disabled' : ''}`}
            title={disabled ? `${t.label} — extract PDF style first` : t.label}
            style={{ borderColor: active ? '#7c3aed' : 'rgba(255,255,255,0.15)' }}
          >
            <span className="trm-swatch-stripe" style={{ background: t.swatchAccent }} />
            <span className="trm-swatch-label">{SWATCH_FONT_CHAR[t.swatchFont]}</span>
          </button>
        )
      })}
    </div>
  )
}
