import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import {
  Kanban, FileText,
  Target, Send, LayoutDashboard, User, ArrowRight,
} from 'lucide-react'
import './WelcomePage.css'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'

const ONBOARDING_STORAGE_PREFIX = 'runway_onboarded_'

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

/**
 * Displays one onboarding feature summary card.
 */
function StepCard({ step }) {
  const Icon = step.icon

  return (
    <div className="wp-card">
      <div className="wp-card-top">
        <span className="wp-card-number">
          {String(step.number).padStart(2, '0')}
        </span>
        <div className={`wp-card-icon wp-card-icon--${step.color}`}>
          <Icon size={15} />
        </div>
      </div>

      <div>
        <h3 className="wp-card-title">{step.title}</h3>
        <p className="wp-card-desc">{step.desc}</p>
      </div>
    </div>
  )
}

/**
 * Returns the user's first display name, falling back to a generic greeting.
 */
function getFirstName(user) {
  return user?.displayName?.split(' ')[0] ?? 'there'
}

/**
 * First-run onboarding screen shown once after a verified login.
 */
export default function WelcomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = getFirstName(user)

  function finishOnboarding() {
    localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}${user.uid}`, 'true')
    navigate('/board')
  }

  return (
    <div className="wp-root">

      <div className="wp-topbar">
        <div className="wp-logo">
          <RunwayLogoMark size="sm" className="wp-logo-icon" />
          <span className="wp-logo-wordmark">Runway</span>
        </div>

        <button className="wp-skip" onClick={finishOnboarding}>
          Skip intro →
        </button>
      </div>

      <div className="wp-content">
        <div className="wp-header">
          <p className="wp-eyebrow">Welcome to Runway</p>
          <h1 className="wp-title">Hey {firstName}, let's get you set up</h1>
          <p className="wp-subtitle">
            Here's everything Runway can do for your job search.
            Work through these at your own pace — there's no set order.
          </p>
        </div>

        <div className="wp-grid">
          {STEPS.map(step => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>

        <button className="wp-cta" onClick={finishOnboarding}>
          Let's get started
          <ArrowRight size={15} />
        </button>

      </div>
    </div>
  )
}
