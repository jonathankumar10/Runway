import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Kanban, FileText,
  Target, Send, LayoutDashboard, User, ArrowRight,
} from 'lucide-react'
import './WelcomePage.css'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'

// ─────────────────────────────────────────────────────────────────────────────
// STEPS
// Each object describes one feature of the app.
// 'number'  → shown as "01", "02", etc. on the card
// 'icon'    → lucide-react icon component
// 'color'   → matches a "wp-card-icon--{color}" class in WelcomePage.css
// 'title'   → short feature name
// 'desc'    → one or two sentences explaining what the user can do here
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    number: 1,
    icon: Kanban,
    color: 'sky',
    title: 'Track Your Applications',
    desc: 'Add jobs and drag them through stages — Saved → Applied → Interview → Offer. See your whole pipeline at a glance.',
  },
  {
    number: 2,
    icon: FileText,
    color: 'violet',
    title: 'Upload & Score Your Resume',
    desc: 'Upload your resume, paste a job description, and get an AI match score with specific tips to improve your fit.',
  },
  {
    number: 3,
    icon: Target,
    color: 'rose',
    title: 'Build Your Target List',
    desc: "Add companies you want to work at. Track which ones you've reached out to and who you know there.",
  },
  {
    number: 4,
    icon: Send,
    color: 'emerald',
    title: 'Send Cold Outreach',
    desc: 'Use AI-generated email templates to reach out to recruiters and engineers at your target companies.',
  },
  {
    number: 5,
    icon: LayoutDashboard,
    color: 'amber',
    title: 'Monitor Your Progress',
    desc: 'Your dashboard shows pipeline stats, application pace, upcoming interviews, and what to do next.',
  },
  {
    number: 6,
    icon: User,
    color: 'slate',
    title: 'Set Up Your Profile',
    desc: 'Add your target roles, locations, and salary range so Runway can tailor its suggestions to your search.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// StepCard
// Renders a single feature card. Receives one item from the STEPS array.
// ─────────────────────────────────────────────────────────────────────────────
function StepCard({ step }) {
  const Icon = step.icon

  return (
    <div className="wp-card">

      {/* Top row: step number + coloured icon bubble */}
      <div className="wp-card-top">
        <span className="wp-card-number">
          {String(step.number).padStart(2, '0')}
        </span>
        <div className={`wp-card-icon wp-card-icon--${step.color}`}>
          <Icon size={15} />
        </div>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="wp-card-title">{step.title}</h3>
        <p className="wp-card-desc">{step.desc}</p>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WelcomePage
// Shown once to new users right after they log in for the first time.
// When they click "Let's get started" (or "Skip"), we:
//   1. Write a flag to localStorage so we never show this page again.
//   2. Navigate them to the main app (/board).
// ─────────────────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Pull the first name out of the user's display name, e.g. "Jonathan Kumar" → "Jonathan".
  // Falls back to "there" if the name isn't available.
  const firstName = user?.displayName?.split(' ')[0] ?? 'there'

  function finishOnboarding() {
    // Store a flag so the router knows not to redirect here again.
    // We key it by user ID so it works correctly if multiple accounts use the same browser.
    localStorage.setItem(`runway_onboarded_${user.uid}`, 'true')
    navigate('/board')
  }

  return (
    <div className="wp-root">

      {/* ── Top bar ── */}
      <div className="wp-topbar">
        <div className="wp-logo">
          <RunwayLogoMark size="sm" className="wp-logo-icon" />
          <span className="wp-logo-wordmark">Runway</span>
        </div>

        {/* Skip link — for users who just want to dive straight in */}
        <button className="wp-skip" onClick={finishOnboarding}>
          Skip intro →
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="wp-content">

        {/* Header */}
        <div className="wp-header">
          <p className="wp-eyebrow">Welcome to Runway</p>
          <h1 className="wp-title">Hey {firstName}, let's get you set up</h1>
          <p className="wp-subtitle">
            Here's everything Runway can do for your job search.
            Work through these at your own pace — there's no set order.
          </p>
        </div>

        {/* Feature cards */}
        <div className="wp-grid">
          {STEPS.map(step => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>

        {/* Get started button */}
        <button className="wp-cta" onClick={finishOnboarding}>
          Let's get started
          <ArrowRight size={15} />
        </button>

      </div>
    </div>
  )
}
