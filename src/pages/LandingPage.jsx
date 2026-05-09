import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  BriefcaseBusiness, Sparkles, FileText, Kanban,
  MessageSquare, Mail, BarChart3, CheckCircle2,
  ArrowRight, Zap, ChevronRight,
} from 'lucide-react'
import './LandingPage.css'

// ── Scroll-reveal hook ────────────────────────────────────────────────────────

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

// ── Static data ───────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Sparkles,     color: 'violet',  title: 'AI Resume Match',    desc: 'Instantly score your fit for any role. Get strengths, gaps, and copy-paste suggestions to improve your resume before you apply.' },
  { icon: FileText,     color: 'indigo',  title: 'Tailored Resumes',   desc: 'Generate a job-specific version of your resume in seconds. Edit it inline, preview it as a formatted document, and download as PDF.' },
  { icon: Kanban,       color: 'sky',     title: 'Visual Pipeline',    desc: 'Drag-and-drop Kanban board to track every application from Saved → Offer. Never lose track of where you stand.' },
  { icon: MessageSquare,color: 'emerald', title: 'Interview Prep',     desc: 'Role-specific practice questions at Easy, Medium, and Hard difficulty. AI coaching tips tailored to each interview stage.' },
  { icon: Mail,         color: 'amber',   title: 'Follow-up Drafts',   desc: 'One click to generate a professional follow-up email. Personalised to the company, role, and recruiter — ready to send.' },
  { icon: BarChart3,    color: 'rose',    title: 'Progress Analytics', desc: 'Weekly application charts, pipeline funnel, interview countdown, and next-move coaching — all on your personal dashboard.' },
]

const STEPS = [
  { n: '01', accent: 'violet',  title: 'Add a job posting',       desc: 'Paste a job URL or description and Runway auto-fills the company, role, salary, and key skills with AI.' },
  { n: '02', accent: 'indigo',  title: 'Analyse your fit',        desc: 'Run the AI match to get a score, see your strengths, surface skill gaps, and get exact lines to add to your resume.' },
  { n: '03', accent: 'sky',     title: 'Tailor your application', desc: 'Generate a resume rewritten for this specific role and an AI-drafted follow-up email — in under 30 seconds.' },
  { n: '04', accent: 'emerald', title: 'Track and advance',       desc: 'Move through the pipeline, prep for each interview stage with AI coaching, and land the offer.' },
]

const MOCK_JOBS = [
  { company: 'A', name: 'Amazon',    role: 'Senior Software Engineer', stage: 'Applied',    stageColor: 'blue',   score: 82 },
  { company: 'G', name: 'Google',    role: 'Staff Software Engineer',  stage: 'Interview',  stageColor: 'violet', score: 91 },
  { company: 'M', name: 'Microsoft', role: 'Principal Engineer',       stage: 'Saved',      stageColor: 'slate',  score: 74 },
]

const LOGO_COLORS = {
  A: '#FF9900',
  G: 'linear-gradient(135deg,#4285F4,#34A853)',
  M: '#00A4EF',
}

// ── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

// ── Browser-window mockup ─────────────────────────────────────────────────────

function MockJobCard({ job, delay }) {
  return (
    <div className="lp-mock-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="lp-mock-card-left">
        <div
          className="lp-mock-logo"
          style={{ background: LOGO_COLORS[job.company] }}
        >
          {job.company}
        </div>
        <div className="lp-mock-text">
          <p className="lp-mock-company">{job.name}</p>
          <p className="lp-mock-role">{job.role}</p>
        </div>
      </div>
      <div className="lp-mock-card-right">
        <span className={`lp-mock-stage lp-mock-stage--${job.stageColor}`}>{job.stage}</span>
        <span className={`lp-mock-score lp-mock-score--${job.score >= 80 ? 'green' : job.score >= 65 ? 'yellow' : 'red'}`}>
          {job.score}%
        </span>
      </div>
    </div>
  )
}

function AppPreview() {
  return (
    <div className="lp-browser">
      {/* Browser chrome */}
      <div className="lp-browser-bar">
        <div className="lp-browser-dots">
          <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
        </div>
        <div className="lp-browser-url">runway.app/board</div>
      </div>

      {/* App shell */}
      <div className="lp-browser-body">
        {/* Sidebar strip */}
        <div className="lp-browser-sidebar">
          <div className="lp-browser-sidebar-icon lp-browser-sidebar-icon--active" />
          <div className="lp-browser-sidebar-icon" />
          <div className="lp-browser-sidebar-icon" />
          <div className="lp-browser-sidebar-icon" />
        </div>

        {/* Content */}
        <div className="lp-browser-content">
          {/* Toolbar */}
          <div className="lp-browser-toolbar">
            <span className="lp-browser-toolbar-title">Applications</span>
            <div className="lp-browser-toolbar-badge">3 active</div>
          </div>

          {/* Job cards */}
          <div className="lp-mock-cards">
            {MOCK_JOBS.map((job, i) => (
              <MockJobCard key={job.name} job={job} delay={i * 120} />
            ))}
          </div>

          {/* Score strip */}
          <div className="lp-browser-score-strip">
            <div className="lp-browser-score-item">
              <Sparkles size={11} className="text-violet-400" />
              <span>AI match ready</span>
            </div>
            <div className="lp-browser-score-item">
              <CheckCircle2 size={11} className="text-green-400" />
              <span>Resume tailored</span>
            </div>
            <div className="lp-browser-score-item">
              <Zap size={11} className="text-amber-400" />
              <span>5 questions ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, color, title, desc, delay }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      className={`lp-feature-card lp-feature-card--${color} ${inView ? 'lp-reveal' : 'lp-hidden'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`lp-feature-icon lp-feature-icon--${color}`}><Icon size={18} /></div>
      <h3 className="lp-feature-title">{title}</h3>
      <p className="lp-feature-desc">{desc}</p>
    </div>
  )
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step, idx }) {
  const [ref, inView] = useInView(0.2)
  return (
    <div
      ref={ref}
      className={`lp-step ${inView ? 'lp-reveal' : 'lp-hidden'}`}
      style={{ transitionDelay: `${idx * 80}ms` }}
    >
      <div className={`lp-step-num lp-step-num--${step.accent}`}>{step.n}</div>
      <div>
        <h3 className="lp-step-title">{step.title}</h3>
        <p className="lp-step-desc">{step.desc}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [featRef, featInView] = useInView(0.05)
  const [ctaRef, ctaInView] = useInView(0.3)

  async function handleSignIn() {
    await signInWithGoogle()
    navigate('/board')
  }

  return (
    <div className="lp-root">

      {/* Background */}
      <div className="lp-orbs" aria-hidden>
        <div className="lp-orb lp-orb--violet" />
        <div className="lp-orb lp-orb--indigo" />
        <div className="lp-orb lp-orb--blue" />
      </div>
      <div className="lp-dot-grid" aria-hidden />

      {/* ── Navbar ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-logo">
            <div className="lp-nav-icon">
              <BriefcaseBusiness size={14} className="text-white" />
            </div>
            <span className="lp-nav-wordmark">Runway</span>
          </div>
          <button onClick={handleSignIn} className="lp-nav-signin">
            Sign in <ChevronRight size={13} />
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* Copy — left */}
          <div className="lp-hero-copy">
            <div className="lp-hero-badge">
              <Sparkles size={11} className="text-violet-400" />
              AI-powered job search
            </div>
            <h1 className="lp-hero-h1">
              Your job search,<br />
              <span className="lp-hero-gradient">on autopilot</span>
            </h1>
            <p className="lp-hero-sub">
              Track every application, score your resume against any job,
              generate tailored resumes, and prep for every interview —
              all in one place.
            </p>
            <div className="lp-hero-actions">
              <button onClick={handleSignIn} className="lp-cta-primary">
                <GoogleIcon />
                Get started free
                <ArrowRight size={15} />
              </button>
            </div>
            <p className="lp-hero-fine">Free to use · No credit card required</p>
          </div>

          {/* Preview — right */}
          <div className="lp-hero-visual">
            <AppPreview />
          </div>

        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="lp-stats-strip">
        {[
          { value: '6',       label: 'AI-powered tools' },
          { value: 'Instant', label: 'Resume tailoring' },
          { value: '100%',    label: 'Free to use' },
          { value: 'Zero',    label: 'Missed follow-ups' },
        ].map(({ value, label }) => (
          <div key={label} className="lp-stat">
            <span className="lp-stat-value">{value}</span>
            <span className="lp-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-header" ref={featRef}>
            <p className={`lp-section-eyebrow ${featInView ? 'lp-reveal' : 'lp-hidden'}`}>Everything you need</p>
            <h2 className={`lp-section-h2 ${featInView ? 'lp-reveal' : 'lp-hidden'}`} style={{ transitionDelay: '80ms' }}>Stop juggling spreadsheets</h2>
            <p className={`lp-section-sub ${featInView ? 'lp-reveal' : 'lp-hidden'}`} style={{ transitionDelay: '160ms' }}>
              Every tool you need to run a focused, high-signal job search — powered by AI.
            </p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <p className="lp-section-eyebrow">How it works</p>
            <h2 className="lp-section-h2">From posting to offer</h2>
            <p className="lp-section-sub">Four steps. No noise.</p>
          </div>
          <div className="lp-steps">
            {STEPS.map((step, i) => (
              <StepRow key={step.n} step={step} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-section">
        <div ref={ctaRef} className={`lp-cta-box ${ctaInView ? 'lp-reveal' : 'lp-hidden'}`}>
          <div className="lp-cta-orb" />
          <p className="lp-cta-eyebrow">Ready to get started?</p>
          <h2 className="lp-cta-h2">Land your next role faster</h2>
          <p className="lp-cta-sub">Join job seekers using Runway to run smarter, more organised searches.</p>
          <button onClick={handleSignIn} className="lp-cta-primary lp-cta-primary--large">
            <GoogleIcon />
            Sign in with Google — it's free
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-nav-logo">
            <div className="lp-nav-icon"><BriefcaseBusiness size={12} className="text-white" /></div>
            <span className="lp-nav-wordmark">Runway</span>
          </div>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Runway. Built for job seekers.</p>
        </div>
      </footer>

    </div>
  )
}
