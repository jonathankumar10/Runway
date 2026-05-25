export const TEMPLATE_IDS = ['original', 'classic', 'modern', 'minimal', 'technical']

export const FONT_OPTIONS = [
  { label: 'Georgia (Serif)',     value: "'Georgia', 'Times New Roman', serif" },
  { label: 'Times New Roman',     value: "'Times New Roman', Georgia, serif" },
  { label: 'System Sans-Serif',   value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Courier New (Mono)',  value: "'Courier New', Courier, monospace" },
]

export const FONT_SIZE_OPTIONS = [
  { label: '7.5 pt',  value: '7.5pt',  sectionSize: '6.5pt'  },
  { label: '8 pt',    value: '8pt',    sectionSize: '7pt'    },
  { label: '8.5 pt',  value: '8.5pt',  sectionSize: '7pt'    },
  { label: '9 pt',    value: '9pt',    sectionSize: '7.5pt'  },
  { label: '9.5 pt',  value: '9.5pt',  sectionSize: '8pt'    },
  { label: '10 pt',   value: '10pt',   sectionSize: '8.5pt'  },
  { label: '10.5 pt', value: '10.5pt', sectionSize: '9pt'    },
  { label: '11 pt',   value: '11pt',   sectionSize: '9pt'    },
]

export const LINE_SPACING_OPTIONS = [
  { label: '1.0 — Compact',  value: '1.0'  },
  { label: '1.15',            value: '1.15' },
  { label: '1.2',             value: '1.2'  },
  { label: '1.3 — Default',  value: '1.3'  },
  { label: '1.4',             value: '1.4'  },
  { label: '1.5',             value: '1.5'  },
  { label: '1.6 — Spacious', value: '1.6'  },
]

export const MARGIN_OPTIONS = [
  { label: 'Narrow (0.35")', value: '0.35in' },
  { label: 'Normal (0.44")', value: '0.44in' },
  { label: 'Wide (0.55")',   value: '0.55in' },
]

// All templates share the same print sizing — font choice varies but sizes don't.
// This guarantees 1-page output for SDE-level resumes across all styles.
const PRINT_BASE = {
  '--rp-print-body-size':    '9pt',
  '--rp-print-section-size': '7.5pt',
  '--rp-print-padding':      '0.44in',
  '--rp-print-line-height':  '1.3',
}

export const STATIC_TEMPLATES = [
  {
    id: 'classic',
    label: 'Classic',
    swatchAccent: '#1565C0',
    swatchFont: 'serif',
    vars: {
      '--rp-font-body':       "'Georgia', 'Times New Roman', serif",
      '--rp-font-heading':    "system-ui, -apple-system, sans-serif",
      '--rp-accent':          '#1565C0',
      '--rp-name-size':       '22pt',
      '--rp-body-size':       '10.5pt',
      '--rp-section-size':    '10.5pt',
      '--rp-section-weight':  '700',
      '--rp-section-case':    'uppercase',
      '--rp-section-border':  '1.5px solid #1565C0',
      '--rp-line-height':     '1.55',
      '--rp-paper-padding':   '40px 48px',
      '--rp-section-spacing': '16px 0 6px',
      ...PRINT_BASE,
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    swatchAccent: '#0f172a',
    swatchFont: 'sans',
    vars: {
      '--rp-font-body':       "system-ui, -apple-system, sans-serif",
      '--rp-font-heading':    "system-ui, -apple-system, sans-serif",
      '--rp-accent':          '#0f172a',
      '--rp-name-size':       '24pt',
      '--rp-body-size':       '10pt',
      '--rp-section-size':    '9pt',
      '--rp-section-weight':  '800',
      '--rp-section-case':    'uppercase',
      '--rp-section-border':  '2px solid #0f172a',
      '--rp-line-height':     '1.5',
      '--rp-paper-padding':   '40px 48px',
      '--rp-section-spacing': '14px 0 5px',
      ...PRINT_BASE,
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    swatchAccent: '#000000',
    swatchFont: 'sans',
    vars: {
      '--rp-font-body':       "system-ui, -apple-system, sans-serif",
      '--rp-font-heading':    "system-ui, -apple-system, sans-serif",
      '--rp-accent':          '#000000',
      '--rp-name-size':       '20pt',
      '--rp-body-size':       '10pt',
      '--rp-section-size':    '9pt',
      '--rp-section-weight':  '600',
      '--rp-section-case':    'uppercase',
      '--rp-section-border':  'none',
      '--rp-line-height':     '1.65',
      '--rp-paper-padding':   '48px 56px',
      '--rp-section-spacing': '20px 0 6px',
      ...PRINT_BASE,
    },
  },
  {
    id: 'technical',
    label: 'Technical',
    swatchAccent: '#065f46',
    swatchFont: 'mono',
    vars: {
      '--rp-font-body':       "'Courier New', 'Courier', monospace",
      '--rp-font-heading':    "system-ui, -apple-system, sans-serif",
      '--rp-accent':          '#065f46',
      '--rp-name-size':       '18pt',
      '--rp-body-size':       '9.5pt',
      '--rp-section-size':    '8.5pt',
      '--rp-section-weight':  '700',
      '--rp-section-case':    'uppercase',
      '--rp-section-border':  '1px solid #065f46',
      '--rp-line-height':     '1.4',
      '--rp-paper-padding':   '36px 44px',
      '--rp-section-spacing': '12px 0 4px',
      ...PRINT_BASE,
    },
  },
]

export function buildOriginalVars(styleMap) {
  const body = styleMap?.bodyFontSizePt ?? 10.5
  const heading = styleMap?.headingFontSizePt ?? 11.5
  return {
    '--rp-font-body':       "'Georgia', 'Times New Roman', serif",
    '--rp-font-heading':    "system-ui, -apple-system, sans-serif",
    '--rp-accent':          '#374151',
    '--rp-name-size':       `${(body * 2.0).toFixed(1)}pt`,
    '--rp-body-size':       `${body}pt`,
    '--rp-section-size':    `${heading}pt`,
    '--rp-section-weight':  '700',
    '--rp-section-case':    'uppercase',
    '--rp-section-border':  '1.5px solid #374151',
    '--rp-line-height':     '1.45',
    '--rp-paper-padding':   '40px 48px',
    '--rp-section-spacing': '14px 0 5px',
    ...PRINT_BASE,
  }
}

export const ORIGINAL_TEMPLATE_META = {
  id: 'original',
  label: 'Original',
  swatchAccent: '#374151',
  swatchFont: 'serif',
}

export function getTemplateVars(templateId, styleMap) {
  if (templateId === 'original') return buildOriginalVars(styleMap)
  return STATIC_TEMPLATES.find(t => t.id === templateId)?.vars ?? STATIC_TEMPLATES[0].vars
}

export const ALL_TEMPLATE_META = [
  ORIGINAL_TEMPLATE_META,
  ...STATIC_TEMPLATES.map(({ id, label, swatchAccent, swatchFont }) => ({ id, label, swatchAccent, swatchFont })),
]
