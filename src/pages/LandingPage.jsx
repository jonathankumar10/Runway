import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Kanban,
  CheckCircle2, FileText, Target, LayoutDashboard, Puzzle,
  ArrowRight, Zap, ChevronRight,
} from 'lucide-react'
import './LandingPage.css'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'

/**
 * Reveals an element once it enters the viewport.
 */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

const FEATURE_GROUPS = [
  {
    icon: Kanban,
    color: 'sky',
    title: 'Track',
    desc: 'Run your application pipeline from saved role to offer.',
    items: ['Kanban board', 'Stage filters', 'Quick view panel'],
  },
  {
    icon: FileText,
    color: 'indigo',
    title: 'Tailor',
    desc: 'Keep resumes organized and adapt them to the roles that matter.',
    items: ['Default resume library', 'AI match scoring', 'Tailored resume builder'],
  },
  {
    icon: Target,
    color: 'rose',
    title: 'Connect',
    desc: 'Turn target companies into recruiter conversations.',
    items: ['Target company tracker', 'Recruiter discovery', 'Outreach drafts'],
  },
  {
    icon: LayoutDashboard,
    color: 'amber',
    title: 'Review',
    desc: 'Use dashboard signals to decide what needs action next.',
    items: ['Weekly activity', 'Interview countdowns', 'Follow-up reminders'],
  },
]

const WORKFLOW_STEPS = [
  {
    color: 'violet',
    title: 'Get Ready',
    desc: 'Build the proof before you apply.',
    tasks: ['Upload your default resume', 'Score fit against target roles', 'Create a tailored resume version', 'Identify gaps before applying'],
    tools: [
      { name: 'Resume Library', desc: 'Store resumes in one place and reuse the right version.' },
      { name: 'AI Match Analysis', badge: 'Killer', desc: 'See strengths, gaps, and focused resume suggestions.' },
      { name: 'Tailored Resume Builder', badge: 'Killer', desc: 'Generate an editable version for high-value roles.' },
    ],
  },
  {
    color: 'sky',
    title: 'Find the Right Jobs',
    desc: 'Stop random applying and choose better targets.',
    tasks: ['Save promising roles', 'Organize target companies', 'Prioritize roles by fit', 'Keep every opportunity visible'],
    tools: [
      { name: 'Application Board', badge: 'Core', desc: 'Track every role from Saved through Offer.' },
      { name: 'Target Companies', desc: 'Rank companies and monitor recruiter discovery.' },
      { name: 'Browser Import', desc: 'Capture roles from job pages into your board.' },
    ],
  },
  {
    color: 'emerald',
    title: 'Apply & Connect',
    desc: 'Send better applications and create warm paths in.',
    tasks: ['Submit tailored applications', 'Find recruiter contacts', 'Draft outreach emails', 'Track LinkedIn and email follow-ups'],
    tools: [
      { name: 'Recruiter Discovery', badge: 'Killer', desc: 'Find contacts from target company domains.' },
      { name: 'Outreach Tracker', badge: 'Core', desc: 'Track email, LinkedIn, and follow-up status.' },
      { name: 'Gmail Drafts', desc: 'Create outreach drafts without rewriting from scratch.' },
    ],
  },
  {
    color: 'amber',
    title: 'Prepare & Improve',
    desc: 'Review signals and keep improving until offers land.',
    tasks: ['Watch upcoming interviews', 'Review stale applications', 'Plan follow-ups', 'Measure weekly progress'],
    tools: [
      { name: 'Dashboard', badge: 'Core', desc: 'See pipeline health, weekly activity, and next moves.' },
      { name: 'Interview Countdown', desc: 'Keep scheduled interviews visible.' },
      { name: 'Quick View', desc: 'Act on one application without leaving the board.' },
    ],
  },
]

const PREVIEW_STATS = [
  { label: 'Active Pipeline', value: '8' },
  { label: 'Need Action', value: '3' },
  { label: 'Interviews', value: '2' },
  { label: 'Avg Match', value: '86%' },
]

const PREVIEW_COLUMNS = [
  {
    title: 'Saved',
    jobs: [
      { company: 'Linear', role: 'Backend Engineer', match: '82%' },
      { company: 'Vanta', role: 'Platform Engineer', match: '76%' },
    ],
  },
  {
    title: 'Applied',
    jobs: [
      { company: 'Stripe', role: 'Infrastructure Engineer', match: '91%' },
      { company: 'Mercury', role: 'Product Engineer', match: '84%' },
    ],
  },
  {
    title: 'Interview',
    jobs: [
      { company: 'Notion', role: 'Senior Software Engineer', match: '88%' },
    ],
  },
]

const PREVIEW_NAV = ['Dashboard', 'Applications', 'Resumes', 'Targets', 'Outreach']

const STATS_BAR = [
  { value: '5', label: 'Tools in one workspace' },
  { value: 'AI', label: 'Resume match scoring' },
  { value: '$0', label: 'To get started' },
  { value: '∞', label: 'Applications to track' },
]

function handleGlowMove(e) {
  const card = e.currentTarget
  const rect = card.getBoundingClientRect()
  const angle = Math.atan2(
    e.clientY - rect.top - rect.height / 2,
    e.clientX - rect.left - rect.width / 2
  ) * (180 / Math.PI) + 180
  card.style.setProperty('--start', angle)
  card.style.setProperty('--active', '1')
}

function handleGlowLeave(e) {
  e.currentTarget.style.setProperty('--active', '0')
}

/**
 * Renders the static product preview shown in the landing hero.
 */
function AppPreview() {
  return (
    <div className="lp-browser">
      <div className="lp-browser-bar">
        <div className="lp-browser-dots">
          <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
        </div>
        <div className="lp-browser-url">runway.app/board</div>
      </div>

      <div className="lp-browser-body">
        <div className="lp-browser-sidebar">
          <div className="lp-browser-brand">
            <RunwayLogoMark size="sm" />
            <span>Runway</span>
          </div>
          {PREVIEW_NAV.map(item => (
            <div
              key={item}
              className={`lp-browser-nav-item ${item === 'Applications' ? 'lp-browser-nav-item--active' : ''}`}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="lp-browser-content">
          <div className="lp-browser-toolbar">
            <span className="lp-browser-toolbar-title">Runway Board</span>
            <div className="lp-browser-toolbar-badge">next moves ready</div>
          </div>

          <div className="lp-preview-stats">
            {PREVIEW_STATS.map(stat => (
              <div key={stat.label} className="lp-preview-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>

          <div className="lp-preview-workspace">
            <div className="lp-preview-board">
              {PREVIEW_COLUMNS.map(column => (
                <div key={column.title} className="lp-preview-column">
                  <div className="lp-preview-column-header">
                    <span>{column.title}</span>
                    <strong>{column.jobs.length}</strong>
                  </div>
                  {column.jobs.map(job => (
                    <div key={`${job.company}-${job.role}`} className="lp-preview-card">
                      <div className="lp-preview-logo">{job.company[0]}</div>
                      <div className="lp-preview-card-copy">
                        <strong>{job.company}</strong>
                        <span>{job.role}</span>
                      </div>
                      <em>{job.match}</em>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="lp-preview-panel">
              <div className="lp-preview-panel-head">
                <span>N</span>
                <div>
                  <strong>Notion</strong>
                  <p>Senior Software Engineer</p>
                </div>
              </div>
              <div className="lp-preview-panel-score">88% resume match</div>
              <p className="lp-preview-panel-copy">
                Next: send recruiter follow-up and review system design notes before Thursday.
              </p>
            </div>
          </div>

          <div className="lp-browser-score-strip">
            <div className="lp-browser-score-item">
              <Sparkles size={11} className="text-blue-400" />
              <span>Resume match</span>
            </div>
            <div className="lp-browser-score-item">
              <CheckCircle2 size={11} className="text-green-400" />
              <span>Recruiter found</span>
            </div>
            <div className="lp-browser-score-item">
              <Zap size={11} className="text-amber-400" />
              <span>Follow-up due</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Landing-page feature card with scroll-reveal animation.
 */
function FeatureGroup({ icon: Icon, color, title, desc, items, delay }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      className={`lp-feature-card lp-feature-card--${color} glow-card ${inView ? 'lp-reveal' : 'lp-hidden'}`}
      style={{ transitionDelay: `${delay}ms` }}
      onMouseMove={handleGlowMove}
      onMouseLeave={handleGlowLeave}
    >
      <div className="glows" />
      <div className="relative z-[1]">
        <div className={`lp-feature-icon lp-feature-icon--${color}`}><Icon size={18} /></div>
        <h3 className="lp-feature-title">{title}</h3>
        <p className="lp-feature-desc">{desc}</p>
        <ul className="lp-feature-list">
          {items.map(item => (
            <li key={item}>
              <CheckCircle2 size={12} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Blueprint-style workflow section for the landing page.
 */
function WorkflowBlueprint() {
  const [ref, inView] = useInView()
  const [activeIndex, setActiveIndex] = useState(0)
  const activeStep = WORKFLOW_STEPS[activeIndex]

  return (
    <div
      ref={ref}
      className={`lp-blueprint ${inView ? 'lp-reveal' : 'lp-hidden'}`}
    >
      <div className="lp-blueprint-tabs">
        {WORKFLOW_STEPS.map((step, index) => (
          <button
            type="button"
            key={step.title}
            className={`lp-blueprint-tab lp-blueprint-tab--${step.color} ${index === activeIndex ? 'lp-blueprint-tab--active' : ''}`}
            onClick={() => setActiveIndex(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step.title}</strong>
            <p>{step.desc}</p>
          </button>
        ))}
      </div>

      <div className={`lp-blueprint-detail lp-blueprint-detail--${activeStep.color}`}>
        <div>
          <p className="lp-blueprint-step-label">Step {String(activeIndex + 1).padStart(2, '0')}</p>
          <h3>{activeStep.title}</h3>
          <p>{activeStep.desc}</p>
        </div>

        <div className="lp-blueprint-grid">
          <div className="lp-blueprint-panel">
            <span className="lp-blueprint-panel-label">What you do</span>
            <ul>
              {activeStep.tasks.map(task => (
                <li key={task}>
                  <CheckCircle2 size={13} />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-blueprint-panel">
            <span className="lp-blueprint-panel-label">Runway tools</span>
            <div className="lp-blueprint-tools">
              {activeStep.tools.map(tool => (
                <div key={tool.name} className="lp-blueprint-tool glow-card" onMouseMove={handleGlowMove} onMouseLeave={handleGlowLeave}>
                  <div className="glows" />
                  <div className="relative z-[1]">
                    <div className="lp-blueprint-tool-title">
                      <strong>{tool.name}</strong>
                      {tool.badge && <span>{tool.badge}</span>}
                    </div>
                    <p>{tool.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Public landing page shown before authentication.
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const [featRef, featInView] = useInView(0.05)
  const [statsRef, statsInView] = useInView(0.2)
  const [ctaRef, ctaInView] = useInView(0.3)

  function handleSignIn() {
    navigate('/login?mode=signup')
  }

  return (
    <div className="lp-root">
      <div className="lp-dot-grid" aria-hidden />

      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-logo">
            <RunwayLogoMark size="md" className="lp-nav-icon" />
            <span className="lp-nav-wordmark">Runway</span>
          </div>
          <div className="lp-nav-actions">
            <button onClick={() => navigate('/login?mode=signin')} className="lp-nav-signin">
              Sign in
            </button>
            <button onClick={() => navigate('/login?mode=signup')} className="lp-nav-signup">
              Sign up <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <div className="lp-hero-badge">
              <Sparkles size={11} className="text-blue-400" />
              Job search operating system
            </div>
            <h1 className="lp-hero-h1">
              Run your search from{' '}
              <span className="lp-hero-gradient">one focused cockpit</span>
            </h1>
            <p className="lp-hero-sub">
              Track applications, tailor resumes, build a target-company list,
              find recruiters, and keep every follow-up moving.
            </p>
            <div className="lp-hero-actions">
              <button onClick={handleSignIn} className="lp-cta-primary">
                Get started free
                <ArrowRight size={15} />
              </button>
              <button onClick={() => navigate('/login?mode=signin')} className="lp-cta-secondary">
                Sign in
              </button>
            </div>
            <div className="lp-hero-tags">
              <span>Free to start</span>
              <span className="lp-hero-tag-dot">·</span>
              <span>No credit card</span>
              <span className="lp-hero-tag-dot">·</span>
              <span>Everything in one app</span>
            </div>
          </div>

          <div className="lp-hero-visual">
            <AppPreview />
          </div>
        </div>
      </section>

      <section className="lp-stats-bar">
        <div ref={statsRef} className={`lp-stats-inner ${statsInView ? 'stats-visible' : ''}`}>
          {STATS_BAR.map(stat => (
            <div key={stat.label} className="lp-stat-item">
              <div className="lp-stat-value">{stat.value}</div>
              <div className="lp-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-header" ref={featRef}>
            <p className={`lp-section-eyebrow ${featInView ? 'lp-reveal' : 'lp-hidden'}`}>What Runway manages</p>
            <h2 className={`lp-section-h2 ${featInView ? 'lp-reveal' : 'lp-hidden'}`} style={{ transitionDelay: '80ms' }}>The whole job search loop</h2>
            <p className={`lp-section-sub ${featInView ? 'lp-reveal' : 'lp-hidden'}`} style={{ transitionDelay: '160ms' }}>
              Each section maps to a real workflow inside the app, not a separate spreadsheet or notes doc.
            </p>
          </div>
          <div className="lp-features-grid">
            {FEATURE_GROUPS.map((feature, i) => (
              <FeatureGroup key={feature.title} {...feature} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <p className="lp-section-eyebrow">Research-backed workflow</p>
            <h2 className="lp-section-h2">The Runway Job Search Blueprint</h2>
            <p className="lp-section-sub">
              A compact flow for turning scattered job-search tasks into consistent progress.
              Pick a phase, see what matters, and use the right Runway tools to move forward.
            </p>
          </div>
          <WorkflowBlueprint />
        </div>
      </section>

      <section className="lp-section lp-extension-section">
        <div className="lp-extension-card glow-card" onMouseMove={handleGlowMove} onMouseLeave={handleGlowLeave}>
          <div className="glows" />
          <div className="lp-extension-icon relative z-[1]">
            <Puzzle size={20} />
          </div>
          <div className="lp-extension-copy relative z-[1]">
            <p className="lp-section-eyebrow">Browser extension</p>
            <h2 className="lp-extension-title">Capture roles without breaking your browsing flow</h2>
            <p className="lp-extension-desc">
              Runway includes an extension workflow for pulling job postings into your board,
              especially when a site is easier to inspect from the browser than from a pasted URL.
            </p>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div ref={ctaRef} className={`lp-cta-box glow-card ${ctaInView ? 'lp-reveal' : 'lp-hidden'}`} onMouseMove={handleGlowMove} onMouseLeave={handleGlowLeave}>
          <div className="glows" />
          <div className="lp-cta-orb" />
          <div className="relative z-[1]">
            <p className="lp-cta-eyebrow">Ready to get started?</p>
            <h2 className="lp-cta-h2">Give your search a system</h2>
            <p className="lp-cta-sub">Start with your board, then add resumes, targets, outreach, and dashboard signals as you go.</p>
            <button onClick={handleSignIn} className="lp-cta-primary lp-cta-primary--large">
              Get started — it's free
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-nav-logo">
            <RunwayLogoMark size="md" className="lp-nav-icon" />
            <span className="lp-nav-wordmark">Runway</span>
          </div>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Runway. Built for job seekers.</p>
        </div>
      </footer>

    </div>
  )
}
