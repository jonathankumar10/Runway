import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import './WelcomePage.css'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'

const ONBOARDING_STORAGE_PREFIX = 'runway_onboarded_'
const EXIT_MS = 340

/* ─── Step illustrations ──────────────────────────────────────────
   Each is a self-contained SVG with looping CSS-animated elements.
   They re-mount (and restart) each time the user navigates to the step.
──────────────────────────────────────────────────────────────────── */

function IllusPipeline() {
  return (
    <svg viewBox="0 0 180 90" className="wp-illus" aria-hidden>
      {/* Column tracks */}
      {[0,1,2,3].map(i => (
        <rect key={i} x={8 + i*44} y={18} width={36} height={66} rx={5}
          fill="rgba(14,165,233,0.06)" stroke="rgba(14,165,233,0.18)" strokeWidth="1" />
      ))}
      {/* Labels */}
      {['Saved','Applied','Screen','Offer'].map((l,i) => (
        <text key={l} x={26 + i*44} y={13} textAnchor="middle"
          fontSize="6.5" fill="rgba(148,163,184,0.55)" fontFamily="system-ui">
          {l}
        </text>
      ))}
      {/* Static background cards */}
      <rect x={12} y={28} width={28} height={12} rx={3} fill="rgba(14,165,233,0.22)" stroke="rgba(14,165,233,0.4)" strokeWidth="0.8"/>
      <rect x={12} y={46} width={28} height={12} rx={3} fill="rgba(14,165,233,0.15)" stroke="rgba(14,165,233,0.3)" strokeWidth="0.8"/>
      <rect x={56} y={28} width={28} height={12} rx={3} fill="rgba(14,165,233,0.22)" stroke="rgba(14,165,233,0.4)" strokeWidth="0.8"/>
      <rect x={100} y={28} width={28} height={12} rx={3} fill="rgba(56,189,248,0.22)" stroke="rgba(56,189,248,0.4)" strokeWidth="0.8"/>
      {/* Arrows between columns */}
      {[0,1,2].map(i => (
        <text key={i} x={47 + i*44} y={57} fontSize="9" fill="rgba(148,163,184,0.3)" textAnchor="middle">›</text>
      ))}
      {/* Moving card - animated across all 4 columns */}
      <rect className="pl-card" x={12} y={58} width={28} height={12} rx={3}
        fill="rgba(99,102,241,0.7)" stroke="rgba(129,140,248,0.9)" strokeWidth="1"/>
      {/* Moving card glow */}
      <rect className="pl-card-glow" x={12} y={58} width={28} height={12} rx={3}
        fill="none" stroke="rgba(129,140,248,0.5)" strokeWidth="3"/>
    </svg>
  )
}

function IllusResume() {
  return (
    <svg viewBox="0 0 160 100" className="wp-illus" aria-hidden>
      {/* Document shadow */}
      <rect x={40} y={14} width={62} height={76} rx={6} fill="rgba(0,0,0,0.3)"/>
      {/* Document body */}
      <rect x={38} y={12} width={62} height={76} rx={6}
        fill="rgba(15,23,42,0.9)" stroke="rgba(59,130,246,0.35)" strokeWidth="1.2"/>
      {/* Folded corner */}
      <path d="M86 12 L100 12 L100 26 Z" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.35)" strokeWidth="0.8"/>
      {/* Text lines on document */}
      {[28,38,46,54,62,70].map((y,i) => (
        <rect key={y} x={46} y={y} width={i%3===0 ? 26 : i%3===1 ? 38 : 32} height={4} rx={2}
          fill="rgba(148,163,184,0.18)"/>
      ))}
      {/* Crane arm */}
      <line className="crane-arm" x1={120} y1={10} x2={69} y2={12} stroke="rgba(59,130,246,0.6)" strokeWidth="2" strokeLinecap="round"/>
      <line x1={120} y1={10} x2={120} y2={30} stroke="rgba(59,130,246,0.4)" strokeWidth="2" strokeLinecap="round"/>
      {/* Crane hook */}
      <circle className="crane-hook" cx={69} cy={12} r={3} fill="rgba(59,130,246,0.7)" stroke="rgba(147,197,253,0.8)" strokeWidth="1"/>
      <line className="crane-hook" x1={69} y1={15} x2={69} y2={22} stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Scan beam */}
      <rect className="scan-beam" x={38} y={12} width={62} height={5} rx={3}
        fill="rgba(59,130,246,0.25)" stroke="rgba(147,197,253,0.4)" strokeWidth="0.5"/>
      {/* Score badge */}
      <g className="score-badge">
        <circle cx={123} cy={62} r={17} fill="rgba(15,23,42,0.95)" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"/>
        <text x={123} y={67} textAnchor="middle" fontSize="13" fontWeight="700"
          fill="rgba(147,197,253,1)" fontFamily="system-ui">94</text>
      </g>
      <text className="score-label" x={123} y={85} textAnchor="middle" fontSize="6.5"
        fill="rgba(148,163,184,0.6)" fontFamily="system-ui">match</text>
    </svg>
  )
}

function IllusTarget() {
  return (
    <svg viewBox="0 0 160 100" className="wp-illus" aria-hidden>
      {/* Target rings */}
      <circle cx={80} cy={50} r={38} fill="none" stroke="rgba(244,63,94,0.15)" strokeWidth="1"/>
      <circle cx={80} cy={50} r={26} fill="none" stroke="rgba(244,63,94,0.22)" strokeWidth="1.2"/>
      <circle cx={80} cy={50} r={15} fill="none" stroke="rgba(244,63,94,0.32)" strokeWidth="1.5"/>
      <circle cx={80} cy={50} r={5}  fill="rgba(244,63,94,0.5)" stroke="rgba(251,113,133,0.7)" strokeWidth="1.5"/>
      {/* Crosshair lines */}
      <line x1={80} y1={8}  x2={80} y2={22} stroke="rgba(244,63,94,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1={80} y1={78} x2={80} y2={92} stroke="rgba(244,63,94,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1={38} y1={50} x2={52} y2={50} stroke="rgba(244,63,94,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1={108} y1={50} x2={122} y2={50} stroke="rgba(244,63,94,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Company pins popping in at different times */}
      <g className="target-pin-1">
        <circle cx={80} cy={24} r={6} fill="rgba(244,63,94,0.3)" stroke="rgba(251,113,133,0.6)" strokeWidth="1.2"/>
        <text x={80} y={28} textAnchor="middle" fontSize="7" fill="rgba(251,113,133,0.9)" fontFamily="system-ui">G</text>
      </g>
      <g className="target-pin-2">
        <circle cx={56} cy={68} r={6} fill="rgba(244,63,94,0.3)" stroke="rgba(251,113,133,0.6)" strokeWidth="1.2"/>
        <text x={56} y={72} textAnchor="middle" fontSize="7" fill="rgba(251,113,133,0.9)" fontFamily="system-ui">M</text>
      </g>
      <g className="target-pin-3">
        <circle cx={107} cy={66} r={6} fill="rgba(244,63,94,0.3)" stroke="rgba(251,113,133,0.6)" strokeWidth="1.2"/>
        <text x={107} y={70} textAnchor="middle" fontSize="7" fill="rgba(251,113,133,0.9)" fontFamily="system-ui">A</text>
      </g>
      {/* Rotating crosshair overlay */}
      <g className="crosshair-spin" style={{transformOrigin:'80px 50px'}}>
        <line x1={80} y1={12} x2={80} y2={30} stroke="rgba(251,113,133,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1={88} y1={50} x2={106} y2={50} stroke="rgba(251,113,133,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
      </g>
    </svg>
  )
}

function IllusOutreach() {
  return (
    <svg viewBox="0 0 180 90" className="wp-illus" aria-hidden>
      {/* Email compose box (left) */}
      <rect x={8} y={20} width={68} height={55} rx={5}
        fill="rgba(16,185,129,0.07)" stroke="rgba(16,185,129,0.25)" strokeWidth="1"/>
      {/* To: field */}
      <text x={14} y={36} fontSize="7" fill="rgba(148,163,184,0.5)" fontFamily="system-ui">To:</text>
      <rect x={26} y={29} width={44} height={8} rx={2} fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.2)" strokeWidth="0.5"/>
      {/* Subject field */}
      <text x={14} y={52} fontSize="7" fill="rgba(148,163,184,0.5)" fontFamily="system-ui">Re:</text>
      <rect x={26} y={45} width={44} height={8} rx={2} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.15)" strokeWidth="0.5"/>
      {/* Body lines */}
      <rect x={14} y={59} width={36} height={4} rx={1.5} fill="rgba(148,163,184,0.12)"/>
      <rect x={14} y={65} width={50} height={4} rx={1.5} fill="rgba(148,163,184,0.08)"/>
      {/* Flying envelope + trail */}
      <g className="envelope-fly">
        {/* Trail dots */}
        <circle cx={95} cy={45} r={2} fill="rgba(16,185,129,0.25)" className="trail-1"/>
        <circle cx={105} cy={43} r={2.5} fill="rgba(16,185,129,0.35)" className="trail-2"/>
        <circle cx={116} cy={41} r={2} fill="rgba(16,185,129,0.25)" className="trail-3"/>
        {/* Envelope */}
        <rect x={120} y={34} width={26} height={18} rx={3}
          fill="rgba(16,185,129,0.2)" stroke="rgba(52,211,153,0.7)" strokeWidth="1.2"/>
        <path d="M120 34 L133 44 L146 34" fill="none" stroke="rgba(52,211,153,0.7)" strokeWidth="1.2"/>
        {/* Sparkles on envelope */}
        <g className="env-sparkle">
          <text x={150} y={30} fontSize="9" fill="rgba(52,211,153,0.8)">✦</text>
          <text x={144} y={56} fontSize="6" fill="rgba(52,211,153,0.5)">✦</text>
        </g>
      </g>
      {/* Send button */}
      <rect x={34} y={71} width={24} height={8} rx={3} fill="rgba(16,185,129,0.3)" stroke="rgba(52,211,153,0.5)" strokeWidth="0.8"/>
      <text x={46} y={78} textAnchor="middle" fontSize="6.5" fill="rgba(167,243,208,0.9)" fontFamily="system-ui">Send</text>
      {/* Send click pulse */}
      <circle className="send-pulse" cx={46} cy={75} r={12} fill="none" stroke="rgba(52,211,153,0.4)" strokeWidth="1"/>
    </svg>
  )
}

function IllusProgress() {
  return (
    <svg viewBox="0 0 160 100" className="wp-illus" aria-hidden>
      {/* Chart grid lines */}
      {[20,38,56,74].map(y => (
        <line key={y} x1={28} y1={y} x2={148} y2={y}
          stroke="rgba(245,158,11,0.08)" strokeWidth="0.8" strokeDasharray="3,3"/>
      ))}
      {/* Y-axis */}
      <line x1={30} y1={16} x2={30} y2={82} stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
      {/* X-axis */}
      <line x1={30} y1={82} x2={150} y2={82} stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
      {/* Bars (animated to grow) — clipPath trick via scaleY */}
      <g className="bar-1" style={{transformOrigin:'50px 82px'}}>
        <rect x={38} y={46} width={18} height={36} rx={3} fill="rgba(245,158,11,0.4)" stroke="rgba(251,191,36,0.5)" strokeWidth="0.8"/>
      </g>
      <g className="bar-2" style={{transformOrigin:'74px 82px'}}>
        <rect x={65} y={38} width={18} height={44} rx={3} fill="rgba(245,158,11,0.5)" stroke="rgba(251,191,36,0.6)" strokeWidth="0.8"/>
      </g>
      <g className="bar-3" style={{transformOrigin:'100px 82px'}}>
        <rect x={92} y={56} width={18} height={26} rx={3} fill="rgba(245,158,11,0.35)" stroke="rgba(251,191,36,0.5)" strokeWidth="0.8"/>
      </g>
      <g className="bar-4" style={{transformOrigin:'127px 82px'}}>
        <rect x={119} y={24} width={18} height={58} rx={3} fill="rgba(245,158,11,0.65)" stroke="rgba(251,191,36,0.8)" strokeWidth="0.8"/>
      </g>
      {/* Trend line */}
      <polyline className="chart-line"
        points="47,64 74,60 101,69 128,53"
        fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="80" strokeDashoffset="80"/>
      {/* Dot on top of bars */}
      {[{cx:47,cy:46},{cx:74,cy:38},{cx:101,cy:56},{cx:128,cy:24}].map((d,i) => (
        <circle key={i} className={`chart-dot-${i+1}`} cx={d.cx} cy={d.cy} r={3}
          fill="rgba(251,191,36,0.9)" stroke="rgba(253,230,138,0.8)" strokeWidth="1"/>
      ))}
      {/* Labels */}
      {['W1','W2','W3','W4'].map((l,i) => (
        <text key={l} x={47+i*27} y={91} textAnchor="middle"
          fontSize="6.5" fill="rgba(148,163,184,0.45)" fontFamily="system-ui">{l}</text>
      ))}
    </svg>
  )
}

function IllusProfile() {
  return (
    <svg viewBox="0 0 160 100" className="wp-illus" aria-hidden>
      {/* Card background */}
      <rect x={22} y={10} width={116} height={80} rx={8}
        fill="rgba(113,113,122,0.08)" stroke="rgba(113,113,122,0.25)" strokeWidth="1.2"/>
      {/* Avatar circle */}
      <circle className="profile-avatar" cx={60} cy={38} r={16}
        fill="rgba(113,113,122,0.2)" stroke="rgba(161,161,170,0.5)" strokeWidth="1.5"/>
      {/* Silhouette */}
      <circle cx={60} cy={33} r={6} fill="rgba(161,161,170,0.4)"/>
      <path d="M48 52 Q60 44 72 52" fill="rgba(161,161,170,0.4)"/>
      {/* Name field */}
      <rect className="profile-name" x={82} y={26} width={48} height={8} rx={3}
        fill="rgba(161,161,170,0.2)" stroke="rgba(161,161,170,0.3)" strokeWidth="0.8"/>
      {/* Role field */}
      <rect className="profile-role" x={82} y={38} width={36} height={6} rx={3}
        fill="rgba(113,113,122,0.15)" stroke="rgba(113,113,122,0.25)" strokeWidth="0.8"/>
      {/* Location field */}
      <rect className="profile-loc" x={82} y={48} width={42} height={6} rx={3}
        fill="rgba(113,113,122,0.12)" stroke="rgba(113,113,122,0.2)" strokeWidth="0.8"/>
      {/* Preference rows with check marks */}
      {[0,1,2].map(i => (
        <g key={i} className={`pref-row-${i+1}`}>
          <circle cx={34} cy={72 + i*(-14 + 0)} r={4.5} fill="rgba(113,113,122,0.1)" stroke="rgba(113,113,122,0.25)" strokeWidth="0.8"/>
          <text x={34} y={75} textAnchor="middle" fontSize="7" fill="rgba(161,161,170,0.7)">✓</text>
          <rect x={42} y={69} width={i===0?50:i===1?42:56} height={5} rx={2} fill="rgba(113,113,122,0.15)"/>
        </g>
      ))}
      {/* Pref rows at proper y positions */}
      <g className="pref-row-a">
        <circle cx={34} cy={66} r={4.5} fill="rgba(113,113,122,0.1)" stroke="rgba(113,113,122,0.25)" strokeWidth="0.8"/>
        <text x={34} y={69.5} textAnchor="middle" fontSize="7" fill="rgba(161,161,170,0.7)">✓</text>
        <rect x={42} y={63} width={50} height={5} rx={2} fill="rgba(113,113,122,0.15)"/>
      </g>
      <g className="pref-row-b">
        <circle cx={34} cy={78} r={4.5} fill="rgba(113,113,122,0.1)" stroke="rgba(113,113,122,0.25)" strokeWidth="0.8"/>
        <text x={34} y={81.5} textAnchor="middle" fontSize="7" fill="rgba(161,161,170,0.7)">✓</text>
        <rect x={42} y={75} width={42} height={5} rx={2} fill="rgba(113,113,122,0.15)"/>
      </g>
      {/* Completion badge */}
      <g className="profile-badge">
        <circle cx={130} cy={22} r={10} fill="rgba(15,23,42,0.95)" stroke="rgba(113,113,122,0.4)" strokeWidth="1.2"/>
        <text x={130} y={26} textAnchor="middle" fontSize="10" fill="rgba(161,161,170,0.9)">✓</text>
      </g>
    </svg>
  )
}

const ILLUSTRATIONS = [IllusPipeline, IllusResume, IllusTarget, IllusOutreach, IllusProgress, IllusProfile]

const STEPS = [
  {
    number: 1,
    color: 'sky',
    title: 'Track Your Applications',
    desc: 'Add jobs and drag them through stages — Saved → Applied → Interview → Offer. See your whole pipeline at a glance.',
  },
  {
    number: 2,
    color: 'blue',
    title: 'Upload & Score Your Resume',
    desc: 'Upload your resume, paste a job description, and get an AI match score with specific tips to improve your fit.',
  },
  {
    number: 3,
    color: 'rose',
    title: 'Build Your Target List',
    desc: "Add companies you want to work at. Track which ones you've reached out to and who you know there.",
  },
  {
    number: 4,
    color: 'emerald',
    title: 'Send Cold Outreach',
    desc: 'Use AI-generated email templates to reach out to recruiters and engineers at your target companies.',
  },
  {
    number: 5,
    color: 'amber',
    title: 'Monitor Your Progress',
    desc: 'Your dashboard shows pipeline stats, application pace, upcoming interviews, and what to do next.',
  },
  {
    number: 6,
    color: 'zinc',
    title: 'Set Up Your Profile',
    desc: 'Add your target roles, locations, and salary range so Runway can tailor its suggestions to your search.',
  },
]

function CardContent({ step, phase, dir }) {
  const Illus = ILLUSTRATIONS[step.number - 1]
  return (
    <div className={`wp-layer wp-layer--${phase}`} data-step={step.number - 1} data-dir={dir}>
      <div className={`wp-illus-wrap wp-illus-wrap--${step.color}`}>
        <Illus />
      </div>
      <h2 className="wp-step-title">{step.title}</h2>
      <p className="wp-step-desc">{step.desc}</p>
    </div>
  )
}

function getFirstName(user) {
  return user?.displayName?.split(' ')[0] ?? 'there'
}

export default function WelcomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = getFirstName(user)

  const [step, setStep] = useState(0)
  const [prevStep, setPrevStep] = useState(null)
  const [dir, setDir] = useState('next')
  const timerRef = useRef(null)

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  function goTo(newStep) {
    if (newStep === step) return
    clearTimeout(timerRef.current)
    setDir(newStep > step ? 'next' : 'back')
    setPrevStep(step)
    setStep(newStep)
    timerRef.current = setTimeout(() => setPrevStep(null), EXIT_MS)
  }

  function finishOnboarding() {
    localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}${user.uid}`, 'true')
    navigate('/board')
  }

  return (
    <div className="wp-root">
      <div className="wp-orbs">
        <div className="wp-orb-tl" />
        <div className="wp-orb-br" />
        <div className="wp-orb-center" />
      </div>
      <div className="dot-grid absolute inset-0 opacity-[0.03] pointer-events-none" />

      <div className="wp-topbar">
        <div className="wp-logo">
          <RunwayLogoMark size="sm" className="wp-logo-icon" />
          <span className="wp-logo-wordmark">Runway</span>
        </div>
        <button className="wp-skip" onClick={finishOnboarding}>Skip intro →</button>
      </div>

      <div className="wp-progress-track">
        <div className="wp-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="wp-content">
        <div className="wp-header">
          <p className="wp-eyebrow">Welcome to Runway</p>
          <h1 className="wp-title">Hey {firstName}, let's get you set up</h1>
          <p className="wp-subtitle">Here's everything Runway can do. Work through at your own pace.</p>
        </div>

        <div className="wp-stage">
          {prevStep !== null && (
            <CardContent key={`x-${prevStep}`} step={STEPS[prevStep]} phase="exit" dir={dir} />
          )}
          <CardContent key={`e-${step}`} step={STEPS[step]} phase="enter" dir={dir} />
        </div>

        <div className="wp-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`wp-dot ${i === step ? 'wp-dot--active' : ''} ${i < step ? 'wp-dot--done' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="wp-nav">
          <button className="wp-nav-back" onClick={() => goTo(step - 1)} disabled={isFirst}>
            <ArrowLeft size={14} /> Back
          </button>
          {isLast ? (
            <button className="wp-cta" onClick={finishOnboarding}>
              Let's get started <ArrowRight size={14} />
            </button>
          ) : (
            <button className="wp-nav-next" onClick={() => goTo(step + 1)}>
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
