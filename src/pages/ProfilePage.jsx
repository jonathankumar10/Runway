import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import {
  User, Bell, Clock, CheckCircle2, Loader2, Shield,
  Palette, Trash2, AlertTriangle, BellOff,
} from 'lucide-react'
import { db, auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import './ProfilePage.css'

const ACCENT_COLORS = [
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'blue',   label: 'Blue',   swatch: '#2563eb' },
  { id: 'emerald',label: 'Emerald',swatch: '#059669' },
  { id: 'rose',   label: 'Rose',   swatch: '#e11d48' },
]

function applyAccent(color) {
  document.documentElement.setAttribute('data-accent', color ?? 'violet')
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { permission, requestPermission } = useNotifications()

  const [prefs, setPrefs] = useState({
    followUpDays: 7,
    emailReminders: false,
    email: '',
    accentColor: 'violet',
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    linkedInUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    workAuthorization: '',
    sponsorship: '',
    salaryExpectation: '',
    remotePreference: '',
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Delete account state
  const [showDelete, setShowDelete]     = useState(false)
  const [deleteInput, setDeleteInput]   = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState(null)

  useEffect(() => {
    async function loadPrefs() {
      const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'))
      if (snap.exists()) {
        const d = snap.data()
        const loaded = {
          followUpDays:   d.followUpDays   ?? 7,
          emailReminders: d.emailReminders ?? false,
          email:          d.email          ?? '',
          accentColor:    d.accentColor    ?? 'violet',
          firstName:      d.firstName      ?? '',
          lastName:       d.lastName       ?? '',
          phone:          d.phone          ?? '',
          location:       d.location       ?? '',
          linkedInUrl:    d.linkedInUrl    ?? '',
          githubUrl:      d.githubUrl      ?? '',
          portfolioUrl:   d.portfolioUrl   ?? '',
          workAuthorization: d.workAuthorization ?? '',
          sponsorship:    d.sponsorship    ?? '',
          salaryExpectation: d.salaryExpectation ?? '',
          remotePreference: d.remotePreference ?? '',
        }
        setPrefs(loaded)
        applyAccent(loaded.accentColor)
      }
      setLoading(false)
    }
    loadPrefs()
  }, [user.uid])

  function set(field, value) {
    setPrefs(p => ({ ...p, [field]: value }))
    if (field === 'accentColor') applyAccent(value)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'settings', 'preferences'),
        { ...prefs },
        { merge: true }
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const subcols = ['applications', 'resumes', 'notifications', 'fcmTokens']
      for (const sub of subcols) {
        const snap = await getDocs(collection(db, 'users', user.uid, sub))
        if (!snap.empty) {
          const batch = writeBatch(db)
          snap.docs.forEach(d => batch.delete(d.ref))
          await batch.commit()
        }
      }
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', user.uid, 'settings', 'preferences')),
        deleteDoc(doc(db, 'users', user.uid, 'settings', 'resume')),
      ])
      await deleteUser(auth.currentUser)
      // onAuthStateChanged fires → router redirects to landing automatically
    } catch (err) {
      setDeleteError(
        err.code === 'auth/requires-recent-login'
          ? 'For security, sign out and sign back in before deleting your account.'
          : 'Something went wrong. Please try again.'
      )
      setDeleting(false)
    }
  }

  const joinedDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const providerLabel = user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email'
  const confirmMatch  = deleteInput.trim().toLowerCase() === user?.email?.toLowerCase()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="mb-6">
        <p className="text-xs text-slate-400 mb-1">WORKSPACE &rsaquo; PROFILE</p>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account, notifications, and appearance.</p>
      </div>

      <div className="profile-layout">

        {/* ── LEFT — identity card ── */}
        <div className="profile-identity-card">
          <div className="flex flex-col items-center text-center gap-3">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-20 h-20 rounded-full ring-2 ring-violet-500/30" />
              : <div className="w-20 h-20 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
                  <User size={32} className="text-slate-400" />
                </div>
            }
            <div>
              <p className="text-lg font-bold text-white">{user?.displayName || 'No name'}</p>
              <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="profile-divider" />

          <div className="space-y-3">
            <MetaRow icon={Shield}       label="Sign-in method" value={providerLabel} />
            {joinedDate && <MetaRow icon={Clock} label="Member since"  value={joinedDate} />}
            <MetaRow
              icon={CheckCircle2}
              label="Email verified"
              value={user?.emailVerified ? 'Yes' : 'No'}
              valueClass={user?.emailVerified ? 'text-green-400' : 'text-orange-400'}
            />
          </div>
        </div>

        {/* ── RIGHT — stacked cards ── */}
        <form onSubmit={handleSave} className="profile-right-col">

          {/* Notifications card */}
          <div className="profile-card">
            <SectionHeader icon={Bell} title="Notifications" />

            <div className="space-y-5">

              {/* Browser push */}
              <div>
                <p className="profile-field-label">Browser push</p>
                {permission === 'granted' ? (
                  <div className="flex items-center gap-2 text-xs text-green-400 mt-1">
                    <CheckCircle2 size={13} /> Push notifications enabled
                  </div>
                ) : permission === 'denied' ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <BellOff size={13} /> Blocked by browser — allow in site settings to enable
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <p className="text-xs text-slate-500">
                      Get browser alerts for follow-up reminders and upcoming interviews.
                    </p>
                    <button type="button" onClick={requestPermission} className="profile-secondary-btn">
                      <Bell size={12} /> Enable push notifications
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-divider" />

              {/* Follow-up delay */}
              <div>
                <label className="profile-field-label">Follow-up reminder delay</label>
                <p className="text-xs text-slate-500 mb-2">
                  Remind me to follow up on stale "Applied" applications after this many days.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={prefs.followUpDays}
                    onChange={e => set('followUpDays', Number(e.target.value))}
                    className="profile-input w-20"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>

              <div className="profile-divider" />

              {/* Email reminders */}
              <ToggleRow
                label="Email reminders"
                description="Send follow-up and interview alerts to my email."
                checked={prefs.emailReminders}
                onChange={v => set('emailReminders', v)}
              />

              {prefs.emailReminders && (
                <div>
                  <label className="profile-field-label">Reminder email address</label>
                  <input
                    type="email"
                    value={prefs.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="you@example.com"
                    className="profile-input w-full"
                  />
                </div>
              )}

            </div>
          </div>

          {/* Autofill profile card */}
          <div className="profile-card">
            <SectionHeader icon={User} title="Autofill Profile" />

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Used by the browser extension to fill application forms. You still review before submitting.
            </p>

            <div className="profile-form-grid">
              <Field label="First name" value={prefs.firstName} onChange={v => set('firstName', v)} />
              <Field label="Last name" value={prefs.lastName} onChange={v => set('lastName', v)} />
              <Field label="Phone" value={prefs.phone} onChange={v => set('phone', v)} />
              <Field label="Location" value={prefs.location} onChange={v => set('location', v)} placeholder="City, State" />
              <Field label="LinkedIn URL" value={prefs.linkedInUrl} onChange={v => set('linkedInUrl', v)} type="url" />
              <Field label="GitHub URL" value={prefs.githubUrl} onChange={v => set('githubUrl', v)} type="url" />
              <Field label="Portfolio URL" value={prefs.portfolioUrl} onChange={v => set('portfolioUrl', v)} type="url" />
              <Field label="Salary expectation" value={prefs.salaryExpectation} onChange={v => set('salaryExpectation', v)} placeholder="e.g. $160k-$190k" />
              <SelectField
                label="Work authorization"
                value={prefs.workAuthorization}
                onChange={v => set('workAuthorization', v)}
                options={[
                  ['', 'Choose...'],
                  ['authorized', 'Authorized to work in the U.S.'],
                  ['not_authorized', 'Not currently authorized'],
                ]}
              />
              <SelectField
                label="Need sponsorship"
                value={prefs.sponsorship}
                onChange={v => set('sponsorship', v)}
                options={[
                  ['', 'Choose...'],
                  ['yes', 'Yes'],
                  ['no', 'No'],
                ]}
              />
              <SelectField
                label="Work preference"
                value={prefs.remotePreference}
                onChange={v => set('remotePreference', v)}
                options={[
                  ['', 'Choose...'],
                  ['remote', 'Remote'],
                  ['hybrid', 'Hybrid'],
                  ['onsite', 'On-site'],
                  ['flexible', 'Flexible'],
                ]}
              />
            </div>
          </div>

          {/* Appearance card */}
          <div className="profile-card">
            <SectionHeader icon={Palette} title="Appearance" />

            <div>
              <p className="profile-field-label">Accent colour</p>
              <p className="text-xs text-slate-500 mb-3">
                Changes the highlight colour used across the sidebar and buttons.
              </p>
              <div className="flex gap-3 flex-wrap">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('accentColor', c.id)}
                    className={`profile-swatch-btn ${prefs.accentColor === c.id ? 'profile-swatch-btn--active' : ''}`}
                  >
                    <span
                      className="profile-swatch"
                      style={{ background: c.swatch }}
                    />
                    <span className="text-xs text-slate-300">{c.label}</span>
                    {prefs.accentColor === c.id && (
                      <CheckCircle2 size={11} className="text-white ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save button — spans both cards above */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="profile-save-btn">
              {saving
                ? <Loader2 size={13} className="animate-spin" />
                : saved
                ? <CheckCircle2 size={13} />
                : null
              }
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save preferences'}
            </button>
          </div>

          {/* Danger Zone card */}
          <div className="profile-card profile-card--danger">
            <SectionHeader icon={AlertTriangle} title="Danger Zone" iconClass="text-red-400" titleClass="text-red-400" />

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Permanently delete your account and all data — applications, resumes, and notifications.
              This cannot be undone.
            </p>

            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="profile-danger-btn"
              >
                <Trash2 size={13} /> Delete my account
              </button>
            ) : (
              <div className="profile-delete-confirm">
                <p className="text-xs text-slate-300 mb-3">
                  Type your email address <span className="text-white font-semibold">{user?.email}</span> to confirm.
                </p>
                <input
                  type="email"
                  value={deleteInput}
                  onChange={e => { setDeleteInput(e.target.value); setDeleteError(null) }}
                  placeholder={user?.email}
                  className="profile-input w-full mb-3"
                  autoFocus
                />
                {deleteError && (
                  <p className="text-xs text-red-400 mb-3">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={!confirmMatch || deleting}
                    className="profile-danger-confirm-btn"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {deleting ? 'Deleting...' : 'Permanently delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDelete(false); setDeleteInput(''); setDeleteError(null) }}
                    className="profile-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </form>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, iconClass, titleClass }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon size={14} className={iconClass ?? 'text-slate-400'} />
      <h2 className={`text-sm font-semibold ${titleClass ?? 'text-white'}`}>{title}</h2>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="profile-field-label mb-0">{label}</span>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`profile-toggle ${checked ? 'profile-toggle--on' : 'profile-toggle--off'}`}
        >
          <span className={`profile-toggle-thumb ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label>
      <span className="profile-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="profile-input w-full"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className="profile-field-label">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="profile-input w-full"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function MetaRow({ icon: Icon, label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-slate-500 shrink-0" />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <span className={`text-xs font-medium ${valueClass ?? 'text-slate-300'}`}>{value}</span>
    </div>
  )
}
