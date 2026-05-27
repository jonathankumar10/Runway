import { BarChart3, Zap, Target } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import RunwayLogoMark from '../components/brand/RunwayLogoMark'
import './LoginPage.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

const features = [
  { icon: BarChart3, label: 'Pipeline tracking' },
  { icon: Zap, label: 'AI coaching' },
  { icon: Target, label: 'Interview prep' },
]

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="login-root">
      <div className="login-orbs">
        <div className="login-orb-tl" />
        <div className="login-orb-br" />
        <div className="login-orb-center" />
      </div>

      <div className="dot-grid absolute inset-0 opacity-[0.035] pointer-events-none" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="login-card">

          <div className="flex items-center gap-2.5">
            <RunwayLogoMark size="lg" className="login-logo-icon" />
            <span className="text-xl font-bold text-white tracking-tight">Runway</span>
          </div>

          <div className="text-center space-y-2.5">
            <h1 className="text-3xl font-bold text-white leading-tight">
              Land your next<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                dream role
              </span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Track applications, prep for interviews,<br />
              and never miss an opportunity.
            </p>
          </div>

          <div className="w-full h-px bg-slate-800" />

          <button onClick={signInWithGoogle} className="login-google-btn">
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex flex-wrap gap-2 justify-center">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="login-feature-pill">
                <Icon size={11} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="login-tos">By signing in you agree to our Terms of Service</p>
      </div>
    </div>
  )
}
