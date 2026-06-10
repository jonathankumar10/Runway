import { useState } from 'react'
import { Eye, EyeOff, Mail, BarChart3, Zap, Target } from 'lucide-react'
import { useAuth } from '../context/auth'
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

function VerifyPending({ email, onResend, onBack }) {
  const [resent, setResent] = useState(false)

  async function handleResend() {
    await onResend()
    setResent(true)
    setTimeout(() => setResent(false), 4000)
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center w-full">
      <div className="login-verify-icon">
        <Mail size={24} className="text-blue-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-white font-semibold text-base">Check your inbox</p>
        <p className="text-zinc-400 text-xs leading-relaxed">
          We sent a verification link to<br />
          <span className="text-zinc-300 font-medium">{email}</span>
        </p>
        <p className="text-zinc-500 text-xs">Click the link to activate your account, then sign in.</p>
      </div>
      <button onClick={handleResend} disabled={resent} className="login-btn-ghost">
        {resent ? 'Email sent!' : 'Resend verification email'}
      </button>
      <button onClick={onBack} className="login-link-btn">Back to sign in</button>
    </div>
  )
}

export default function LoginPage() {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail, resendVerificationEmail } = useAuth()
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingVerify, setPendingVerify] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  function switchTab(t) {
    setTab(t)
    setError('')
    setEmail('')
    setPassword('')
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch {
      setError('Google sign-in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      if (tab === 'signup') {
        await signUpWithEmail(email.trim(), password)
        setPendingEmail(email.trim())
        setPendingVerify(true)
      } else {
        await signInWithEmail(email.trim(), password)
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email.trim())
        setPendingVerify(true)
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Sign in instead.')
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.')
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Enter a valid email address.')
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (pendingVerify) {
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
            <div className="login-header">
              <div className="flex items-center gap-2.5">
                <RunwayLogoMark size="lg" className="login-logo-icon" />
                <span className="text-xl font-bold text-white tracking-tight">Runway</span>
              </div>
            </div>
            <VerifyPending
              email={pendingEmail}
              onResend={resendVerificationEmail}
              onBack={() => { setPendingVerify(false); switchTab('signin') }}
            />
          </div>
          <p className="login-tos">By signing up you agree to our Terms of Service</p>
        </div>
      </div>
    )
  }

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

          <div className="login-header">
            <div className="flex items-center gap-2.5">
              <RunwayLogoMark size="lg" className="login-logo-icon" />
              <span className="text-xl font-bold text-white tracking-tight">Runway</span>
            </div>
            <div className="login-tabs">
              <button
                className={`login-tab ${tab === 'signin' ? 'login-tab--active' : ''}`}
                onClick={() => switchTab('signin')}
              >
                Sign in
              </button>
              <button
                className={`login-tab ${tab === 'signup' ? 'login-tab--active' : ''}`}
                onClick={() => switchTab('signup')}
              >
                Sign up
              </button>
            </div>
          </div>

          <button onClick={handleGoogle} disabled={loading} className="login-google-btn">
            <GoogleIcon />
            {tab === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
          </button>

          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">or with email</span>
            <div className="login-divider-line" />
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              required
              className="login-input"
            />
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                required
                className="login-input login-input--password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="login-password-toggle"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" disabled={loading || !email || !password} className="login-btn-primary">
              {loading ? 'Please wait...' : tab === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="login-pills">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="login-feature-pill">
                <Icon size={11} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="login-tos">By continuing you agree to our Terms of Service</p>
      </div>
    </div>
  )
}
