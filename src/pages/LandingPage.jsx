import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Kanban,
  MessageSquare, CheckCircle2,
  ArrowRight, Zap, ChevronRight,
} from 'lucide-react'
import './LandingPage.css'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'

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
  { icon: Kanban,        color: 'sky',     title: 'Visual Pipeline',  desc: 'Drag-and-drop Kanban board to track every application from Saved → Offer. Never lose track of where you stand.' },
  { icon: Sparkles,      color: 'violet',  title: 'AI Resume Match',  desc: 'Instantly score your fit for any role. Get strengths, gaps, and copy-paste suggestions to improve your resume before you apply.' },
  { icon: MessageSquare, color: 'emerald', title: 'Interview Prep',   desc: 'Role-specific practice questions at Easy, Medium, and Hard difficulty. AI coaching tips tailored to each interview stage.' },
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

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Public landing page shown before authentication.
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const [featRef, featInView] = useInView(0.05)
  const [ctaRef, ctaInView] = useInView(0.3)

  function handleSignIn() {
    navigate('/login?mode=signup')
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

      {/* ── CTA ── */}
      <section className="lp-section">
        <div ref={ctaRef} className={`lp-cta-box ${ctaInView ? 'lp-reveal' : 'lp-hidden'}`}>
          <div className="lp-cta-orb" />
          <p className="lp-cta-eyebrow">Ready to get started?</p>
          <h2 className="lp-cta-h2">Land your next role faster</h2>
          <p className="lp-cta-sub">Join job seekers using Runway to run smarter, more organised searches.</p>
          <button onClick={handleSignIn} className="lp-cta-primary lp-cta-primary--large">
            Get started — it's free
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
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
