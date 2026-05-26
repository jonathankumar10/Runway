import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { doc, updateDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import {
  ArrowLeft, ExternalLink, Pencil, Sparkles, Loader2,
  CheckCircle2, Circle, Plus, Trash2, FileText,
  ChevronDown, ChevronUp, AlertTriangle, Search,
  Mail, Calendar, Wand2, Eye, Copy, ClipboardCheck, Check, TrendingUp,
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { useAI } from '../hooks/useAI'
import { useJobMutations } from '../hooks/useJobMutations'
import { STAGE_MAP } from '../constants/stages'
import ApplicationModal from '../components/modals/ApplicationModal'
import TailoredResumeModal from '../components/modals/TailoredResumeModal'
import './ApplicationDetailPage.css'

const ROUND_TYPES = ['Phone Screen', 'Technical Interview', 'System Design', 'Behavioral', 'Final Round', 'Other']
const ROUND_RESULTS = ['Pending', 'Passed', 'Failed']

function getTodos(job) {
  return [
    {
      id: 'jd',
      label: 'Add job description',
      desc: 'Paste the full JD — the AI needs it to score your match and surface keyword gaps.',
      done: !!job.jobDescription,
    },
    {
      id: 'match',
      label: 'Run AI match analysis',
      desc: 'Get your match score and skill gaps before applying — not after.',
      done: job.matchScore != null,
    },
    {
      id: 'apply',
      label: 'Submit your application',
      desc: 'Mark as Applied and record the date.',
      done: job.stage !== 'saved' && !!job.dateApplied,
    },
    {
      id: 'recruiter',
      label: 'Find recruiter contact',
      desc: 'A referred candidate is far more likely to get an interview than a cold applicant.',
      done: !!(job.recruiterName || job.recruiterEmail),
    },
    {
      id: 'salary',
      label: 'Verify salary range',
      desc: 'Check Glassdoor and Levels.fyi now. Know your BATNA before investing more time.',
      done: !!(job.salaryMin || job.salaryMax),
    },
    {
      id: 'nextstep',
      label: 'Set your next step',
      desc: 'What is the single next action? Record it so you never lose momentum.',
      done: !!job.nextStep,
    },
  ]
}

export default function ApplicationDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { jobs, loading } = useJobs()
  const { matchResume, matchTailoredResume, tailorResume, findRecruiter, draftRecruiterOutreach } = useAI()
  const { deleteJob } = useJobMutations()

  const [editing, setEditing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [matchingTailored, setMatchingTailored] = useState(false)
  const [notes, setNotes] = useState(null)
  const [notesSaving, setNotesSaving] = useState(false)
  const [jdExpanded, setJdExpanded] = useState(false)
  const [addingRound, setAddingRound] = useState(false)
  const [newRound, setNewRound] = useState({ type: 'Phone Screen', date: '', result: 'Pending', notes: '' })
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [finderDomain, setFinderDomain] = useState('')
  const [finding, setFinding] = useState(false)
  const [finderResults, setFinderResults] = useState(null)
  const [finderError, setFinderError] = useState(null)
  const [finderFromCache, setFinderFromCache] = useState(false)
  const [contactedEmails, setContactedEmails] = useState(new Set())
  const domainPreFilled = useRef(false)
  const [tailoring, setTailoring] = useState(false)
  const [tailorDraft, setTailorDraft] = useState(null)   // { suggestions, sections, styleMap } — unsaved working copy
  const [tailorSaving, setTailorSaving] = useState(false)
  const [resumeModalOpen, setResumeModalOpen] = useState(false)
  const [editingRecruiter, setEditingRecruiter] = useState(false)
  const [recruiterEdit, setRecruiterEdit] = useState({ name: '', email: '', title: '', linkedin: '' })
  const [selectedRecruiterIndices, setSelectedRecruiterIndices] = useState(new Set())
  const [outreachDrafts, setOutreachDrafts] = useState([])
  const [draftingOutreach, setDraftingOutreach] = useState(false)

  useEffect(() => {
    if (domainPreFilled.current) return
    const url = jobs.find(j => j.id === jobId)?.jobUrl
    if (!url) return
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      setFinderDomain(hostname)
      domainPreFilled.current = true
    } catch {}
  }, [jobs, jobId])

  const job = jobs.find(j => j.id === jobId)

  if (!loading && !job) {
    navigate('/board', { replace: true })
    return null
  }

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-slate-400 animate-spin" />
      </div>
    )
  }

  const stage = STAGE_MAP[job.stage]
  const todos = getTodos(job)
  const completedTodos = todos.filter(t => t.done).length
  const currentNotes = notes ?? job.notes ?? ''

  const salary = (() => {
    if (!job.salaryMin && !job.salaryMax) return null
    const fmt = n => `$${Math.round(n / 1000)}k`
    if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`
    return job.salaryMin ? `${fmt(job.salaryMin)}+` : `up to ${fmt(job.salaryMax)}`
  })()

  const appliedDate = job.dateApplied?.toDate
    ? job.dateApplied.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const addedDate = job.createdAt?.toDate
    ? job.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const updatedDate = job.updatedAt?.toDate
    ? job.updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  async function handleMatchResume() {
    setMatching(true)
    try {
      const result = await matchResume(
        job.id, job.company, job.role,
        job.keySkills ?? [],
        job.jobDescription ?? job.notes ?? ''
      )
      if (result?.score != null) {
        await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), {
          matchScore: result.score,
          matchHighlights: result.highlights ?? [],
          matchGaps: result.gaps ?? [],
          matchSuggestions: result.resumeSuggestions ?? [],
        })
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setMatching(false)
    }
  }

  async function handleMatchTailoredResume() {
    setMatchingTailored(true)
    try {
      const result = await matchTailoredResume(
        job.tailoredResumeText,
        job.company, job.role,
        job.keySkills ?? [],
        job.jobDescription ?? job.notes ?? ''
      )
      if (result?.score != null) {
        await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), {
          tailoredMatchScore: result.score,
          tailoredMatchHighlights: result.highlights ?? [],
          tailoredMatchGaps: result.gaps ?? [],
        })
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setMatchingTailored(false)
    }
  }

  async function handleSaveNotes() {
    if (notes === null || notes === job.notes) return
    setNotesSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), { notes })
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleAddRound() {
    if (!newRound.type) return
    const round = { ...newRound, id: crypto.randomUUID() }
    const rounds = [...(job.interviewRounds ?? []), round]
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), { interviewRounds: rounds })
    setNewRound({ type: 'Phone Screen', date: '', result: 'Pending', notes: '' })
    setAddingRound(false)
  }

  async function handleDeleteRound(id) {
    const rounds = (job.interviewRounds ?? []).filter(r => r.id !== id)
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), { interviewRounds: rounds })
  }

  async function handleDelete() {
    if (!confirm(`Delete ${job.company} – ${job.role}? This cannot be undone.`)) return
    await deleteJob(job.id)
    navigate('/board', { replace: true })
  }

  async function handleTailorResume() {
    setTailoring(true)
    setTailorDraft(null)
    try {
      const result = await tailorResume(
        job.company, job.role,
        job.jobDescription ?? '',
        job.keySkills ?? [],
        job.matchGaps ?? []
      )
      if (result?.error) throw new Error('Could not generate tailored resume. Try again.')
      setTailorDraft({
        suggestions: result.suggestions ?? [],
        sections: result.sections ?? [],
        keywordAnalysis: result.keywordAnalysis ?? { extracted: [], mapped: [], unmappable: [] },
        rewrittenBullets: result.rewrittenBullets ?? [],
        rewrittenSummary: result.rewrittenSummary ?? [],
        styleMap: result.styleMap ?? null,
      })
      setResumeModalOpen(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setTailoring(false)
    }
  }

  async function handleSaveTailoredResume(html, text, sections, templateId, styleOverrides) {
    const payload = {
      tailoredResumeText: text,
      tailoredResumeHtml: html,
      tailoredResumeGeneratedAt: new Date().toISOString(),
    }
    if (sections) payload.tailoredResumeSections = sections
    if (templateId) payload.tailoredResumeTemplate = templateId
    if (styleOverrides && Object.keys(styleOverrides).length > 0) {
      payload.tailoredResumeStyleOverrides = styleOverrides
    }
    // Persist analysis data so the Analysis tab survives a page reload / reopen
    if (tailorDraft?.keywordAnalysis) payload.tailoredKeywordAnalysis = tailorDraft.keywordAnalysis
    if (tailorDraft?.rewrittenBullets?.length) payload.tailoredRewrittenBullets = tailorDraft.rewrittenBullets
    if (tailorDraft?.rewrittenSummary?.length) payload.tailoredRewrittenSummary = tailorDraft.rewrittenSummary
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), payload)
  }

  async function handleFindRecruiter() {
    if (!finderDomain.trim()) return
    setFinding(true)
    setFinderResults(null)
    setFinderError(null)
    setFinderFromCache(false)
    setContactedEmails(new Set())
    setSelectedRecruiterIndices(new Set())
    setOutreachDrafts([])

    const normalized = finderDomain.trim()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase()

    try {
      let recruiters = null
      let fromCache = false

      // 1. Check our Firestore cache first — no Hunter API call if fresh data exists
      const cacheSnap = await getDoc(doc(db, 'users', user.uid, 'recruiterCache', normalized))
      if (cacheSnap.exists()) {
        const cached = cacheSnap.data()
        if (Date.now() - cached.cachedAt.toMillis() < 30 * 24 * 60 * 60 * 1000) {
          recruiters = cached.recruiters
          fromCache = true
        }
      }

      // 2. Cache miss — call cloud function (it will cache the result for next time)
      if (!recruiters) {
        const result = await findRecruiter(finderDomain.trim())
        if (result.error) throw new Error(result.error)
        recruiters = result.recruiters
        fromCache = result.fromCache ?? false
      }

      setFinderFromCache(fromCache)
      setFinderResults(recruiters)

      // 3. Cross-check outreach collection so we can badge already-contacted recruiters
      const emails = (recruiters || []).map(r => r.email).filter(Boolean).slice(0, 10)
      if (emails.length > 0) {
        const snap = await getDocs(
          query(collection(db, 'users', user.uid, 'outreach'), where('recruiterEmail', 'in', emails))
        )
        setContactedEmails(new Set(snap.docs.map(d => d.data().recruiterEmail)))
      }
    } catch (err) {
      setFinderError(err.message)
    } finally {
      setFinding(false)
    }
  }

  function toggleRecruiterSelection(idx) {
    setSelectedRecruiterIndices(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function handleDraftMultipleOutreach() {
    const selected = [...selectedRecruiterIndices].map(i => finderResults[i])
    setDraftingOutreach(true)
    setOutreachDrafts([])
    try {
      const drafts = await Promise.all(
        selected.map(async r => {
          const result = await draftRecruiterOutreach({
            company: job.company,
            role: job.role,
            recruiterName: r.name,
            recruiterTitle: r.title ?? '',
            senderName: user?.displayName ?? '',
          })
          return { recruiter: r, ...result }
        })
      )
      setOutreachDrafts(drafts.filter(d => !d.error))
    } catch (err) {
      alert('Failed to draft some messages. Try again.')
    } finally {
      setDraftingOutreach(false)
    }
  }

  async function handleSelectRecruiter(r) {
    const linkedin = r.linkedin
      ? r.linkedin.startsWith('http') ? r.linkedin : `https://${r.linkedin}`
      : ''
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), {
      recruiterName: r.name,
      recruiterEmail: r.email,
      recruiterTitle: r.title ?? '',
      recruiterLinkedIn: linkedin,
    })
    setFinderResults(null)
  }

  function startEditRecruiter() {
    setRecruiterEdit({
      name: job.recruiterName ?? '',
      email: job.recruiterEmail ?? '',
      title: job.recruiterTitle ?? '',
      linkedin: job.recruiterLinkedIn ?? '',
    })
    setEditingRecruiter(true)
  }

  async function handleSaveRecruiter() {
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), {
      recruiterName: recruiterEdit.name,
      recruiterEmail: recruiterEdit.email,
      recruiterTitle: recruiterEdit.title,
      recruiterLinkedIn: recruiterEdit.linkedin,
    })
    setEditingRecruiter(false)
  }

  async function handleClearRecruiter() {
    await updateDoc(doc(db, 'users', user.uid, 'applications', job.id), {
      recruiterName: '',
      recruiterEmail: '',
      recruiterTitle: '',
      recruiterLinkedIn: '',
    })
    setEditingRecruiter(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="detail-topnav">
        <button onClick={() => navigate('/board')} className="detail-back-btn">
          <ArrowLeft size={15} /> Back to applications
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5 max-w-7xl mx-auto">
        <p className="text-xs text-slate-400 mb-4">WORKSPACE &rsaquo; {job.company?.toUpperCase()}</p>

        <div className="flex items-start gap-3 sm:gap-4 mb-6">
          {job.logoUrl ? (
            <img src={job.logoUrl} alt="" className="detail-logo" onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <div className="detail-logo-fallback">{job.company?.[0]?.toUpperCase() ?? '?'}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <h1 className="text-2xl font-bold text-white leading-tight">{job.company || 'Untitled'}</h1>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {job.jobUrl && (
                  <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-header-btn"
                    title="Visit site"
                  >
                    <ExternalLink size={12} /> Visit site
                  </a>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="detail-header-btn"
                  title="Edit application"
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>
            </div>
            <p className="text-slate-400 mt-0.5">{job.role || 'No role'}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 ${stage?.textClass ?? 'text-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass ?? 'bg-slate-500'}`} />
                {stage?.label ?? job.stage}
              </span>
              {job.matchScore != null && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${job.matchScore >= 75 ? 'text-green-400 bg-green-500/10 border-green-500/30' : job.matchScore >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                  {job.matchScore}% match
                </span>
              )}
              {salary && <span className="text-xs text-slate-300 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">{salary}</span>}
              {job.location && <span className="text-xs text-slate-300 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">{job.location}</span>}
              {appliedDate && <span className="text-xs text-slate-400 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">Applied {appliedDate}</span>}
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="detail-action-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="detail-action-icon-violet">
                <Sparkles size={13} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {job.matchScore != null ? `${job.matchScore}% Match Score` : 'AI Match Score'}
                </p>
                <p className="text-xs text-slate-400">
                  {job.matchScore != null ? 'View report · Re-analyze' : 'Run analysis'}
                </p>
              </div>
            </div>
            <button onClick={handleMatchResume} disabled={matching} className="detail-action-btn-violet">
              {matching ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {matching ? 'Analyzing...' : job.matchScore != null ? 'Re-analyze' : 'Run Analysis'}
            </button>
          </div>

          <FollowUpCard job={job} />

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6 items-start">
          {/* Left column — analysis & content */}
          <div className="min-w-0 space-y-5">

            <Section title="Job Description" icon={FileText}>
              {job.jobDescription ? (
                <div>
                  <p className={`text-sm text-slate-300 leading-relaxed whitespace-pre-wrap ${!jdExpanded ? 'line-clamp-6' : ''}`}>
                    {job.jobDescription}
                  </p>
                  <button onClick={() => setJdExpanded(x => !x)} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-2 transition-colors">
                    {jdExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No job description added.{' '}
                  <button onClick={() => setEditing(true)} className="text-violet-400 hover:underline">Edit this application</button>{' '}
                  to paste it in.
                </p>
              )}
            </Section>

            {(job.matchHighlights?.length > 0 || job.matchGaps?.length > 0 || job.matchSuggestions?.length > 0) && (
              <Section title="Match Analysis" icon={Sparkles}>
                {/* Strengths + Gaps */}
                {(job.matchHighlights?.length > 0 || job.matchGaps?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                    {job.matchHighlights?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</p>
                        <ul className="space-y-2">
                          {job.matchHighlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <CheckCircle2 size={12} className="text-green-400 shrink-0 mt-0.5" /> {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {job.matchGaps?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Gaps</p>
                        <ul className="space-y-2">
                          {job.matchGaps.map((g, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <AlertTriangle size={12} className="text-orange-400 shrink-0 mt-0.5" /> {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Resume suggestions */}
                {job.matchSuggestions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-sky-400 uppercase tracking-wide mb-2">Suggested additions for your resume</p>
                    <p className="text-xs text-slate-500 mb-3">Copy any of these directly into your master resume.</p>
                    <div className="space-y-2">
                      {job.matchSuggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg group">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-sky-400 uppercase tracking-wide mb-0.5">{s.section}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{s.suggestion}</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(s.suggestion)
                              setCopiedIdx(i)
                              setTimeout(() => setCopiedIdx(null), 2000)
                            }}
                            className="shrink-0 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedIdx === i
                              ? <ClipboardCheck size={13} className="text-green-400" />
                              : <Copy size={13} />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            <Section title="Tailored Resume" icon={Wand2}>
              <p className="text-xs text-slate-400 mb-4">
                Generate a version of your resume optimised for this specific role. You can edit and download it as a PDF.
                {job.matchScore == null && <span className="text-orange-400 ml-1">Run AI match analysis first for better results.</span>}
              </p>

              {/* Saved banner */}
              {job.tailoredResumeText && (
                <>
                  <div className="flex items-center justify-between gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      <p className="text-xs text-slate-300">Tailored resume saved for this job</p>
                    </div>
                    <button
                      onClick={() => setResumeModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Eye size={11} /> View / Edit
                    </button>
                  </div>

                  {/* Tailored resume score */}
                  {job.tailoredMatchScore != null ? (
                    <div className="flex items-center justify-between gap-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl mb-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp size={14} className="text-violet-400 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400">Tailored resume score</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-sm font-bold ${job.tailoredMatchScore >= 75 ? 'text-green-400' : job.tailoredMatchScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {job.tailoredMatchScore}%
                            </span>
                            {job.matchScore != null && (() => {
                              const delta = job.tailoredMatchScore - job.matchScore
                              return (
                                <span className={`text-xs font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                  {delta > 0 ? `+${delta}` : delta} pts vs base ({job.matchScore}%)
                                </span>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleMatchTailoredResume}
                        disabled={matchingTailored}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      >
                        {matchingTailored ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {matchingTailored ? 'Scoring...' : 'Re-score'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleMatchTailoredResume}
                      disabled={matchingTailored}
                      className="w-full flex items-center justify-center gap-1.5 py-2 mb-4 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {matchingTailored ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {matchingTailored ? 'Scoring...' : 'Score tailored resume'}
                    </button>
                  )}
                </>
              )}

              {/* Suggestions from latest generation */}
              {tailorDraft?.suggestions.length > 0 && (
                <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl mb-4">
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2.5">What was improved</p>
                  <ul className="space-y-1.5">
                    {tailorDraft.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-violet-400 shrink-0 mt-0.5">→</span> {s}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setResumeModalOpen(true)}
                    className="flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-medium text-violet-300 border border-violet-600/40 bg-violet-600/10 hover:bg-violet-600/20 rounded-lg transition-colors"
                  >
                    <Eye size={11} /> Open in editor
                  </button>
                </div>
              )}

              <button onClick={handleTailorResume} disabled={tailoring} className="detail-generate-btn">
                {tailoring ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {tailoring ? 'Tailoring resume...' : job.tailoredResumeText ? 'Re-generate tailored resume' : 'Generate tailored resume'}
              </button>
            </Section>

            <Section title="Notes" icon={FileText}>
              <textarea
                value={currentNotes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes, impressions, key skills to highlight, interview prep..."
                rows={8}
                className="detail-form-textarea"
              />
              {notesSaving && <p className="text-xs text-slate-400 mt-1">Saving...</p>}
            </Section>
          </div>

          {/* Right column */}
          <div className="min-w-0 space-y-5">

            <Section title="My To-Dos" icon={CheckCircle2} badge={`${completedTodos}/${todos.length}`}>
              <div className="w-full bg-slate-800 rounded-full h-1 mb-4">
                <div className="todo-progress bg-violet-500 h-1 rounded-full transition-all"
                  style={{ '--progress-w': `${(completedTodos / todos.length) * 100}%` }} />
              </div>
              <div className="space-y-3">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-start gap-3">
                    {todo.done
                      ? <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />
                      : <Circle size={15} className="text-slate-600 shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className={`text-xs font-medium ${todo.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {todo.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{todo.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Interview Rounds"
              icon={Calendar}
              action={
                <button onClick={() => setAddingRound(x => !x)} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <Plus size={12} /> Add Round
                </button>
              }
            >
              {(job.interviewRounds?.length > 0 || addingRound) ? (
                <div className="space-y-3">
                  {(job.interviewRounds ?? []).map(round => (
                    <RoundRow key={round.id} round={round} onDelete={() => handleDeleteRound(round.id)} />
                  ))}
                  {addingRound && (
                    <div className="detail-round-form">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select value={newRound.type} onChange={e => setNewRound(r => ({ ...r, type: e.target.value }))} className="detail-form-select">
                          {ROUND_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input type="date" value={newRound.date} onChange={e => setNewRound(r => ({ ...r, date: e.target.value }))} className="detail-form-select" />
                      </div>
                      <select value={newRound.result} onChange={e => setNewRound(r => ({ ...r, result: e.target.value }))} className="w-full detail-form-select">
                        {ROUND_RESULTS.map(r => <option key={r}>{r}</option>)}
                      </select>
                      <textarea value={newRound.notes} onChange={e => setNewRound(r => ({ ...r, notes: e.target.value }))}
                        placeholder="Notes (optional)" rows={2} className="detail-form-select w-full resize-none placeholder-slate-600" />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={handleAddRound} className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors">
                          Save Round
                        </button>
                        <button onClick={() => setAddingRound(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No interview rounds tracked yet.</p>
              )}
            </Section>

            {/* Meta info */}
            {(job.source || job.nextStep || addedDate || updatedDate) && (
              <aside className="detail-sidebar-card space-y-2.5">
                {job.source && <MetaRow label="Source" value={job.source} />}
                {job.nextStep && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Next Step</p>
                    <p className="text-xs text-slate-300">{job.nextStep}</p>
                  </div>
                )}
                {addedDate && <MetaRow label="Added" value={addedDate} />}
                {updatedDate && <MetaRow label="Updated" value={updatedDate} />}
                <div className="pt-1 border-t border-slate-800">
                  <Link to="/resumes" className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    <FileText size={12} /> Manage resumes →
                  </Link>
                </div>
              </aside>
            )}

            {job.keySkills?.length > 0 && (
              <aside className="detail-sidebar-card">
                <p className="detail-sidebar-label">Key Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.keySkills.map(s => (
                    <span key={s} className="detail-skill-tag">{s}</span>
                  ))}
                </div>
              </aside>
            )}

            <aside className="detail-sidebar-card">
              <p className="detail-sidebar-label">Recruiter</p>

              {(job.recruiterName || job.recruiterEmail || job.recruiterLinkedIn) && (
                <div className="space-y-2 mb-4">
                  {editingRecruiter ? (
                    <div className="space-y-2">
                      <input
                        value={recruiterEdit.name}
                        onChange={e => setRecruiterEdit(r => ({ ...r, name: e.target.value }))}
                        placeholder="Name"
                        className="detail-form-select w-full text-xs"
                      />
                      <input
                        value={recruiterEdit.title}
                        onChange={e => setRecruiterEdit(r => ({ ...r, title: e.target.value }))}
                        placeholder="Title (e.g. Technical Recruiter)"
                        className="detail-form-select w-full text-xs"
                      />
                      <input
                        value={recruiterEdit.email}
                        onChange={e => setRecruiterEdit(r => ({ ...r, email: e.target.value }))}
                        placeholder="Email"
                        className="detail-form-select w-full text-xs"
                      />
                      <input
                        value={recruiterEdit.linkedin}
                        onChange={e => setRecruiterEdit(r => ({ ...r, linkedin: e.target.value }))}
                        placeholder="LinkedIn URL"
                        className="detail-form-select w-full text-xs"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={handleSaveRecruiter} className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors">
                          Save
                        </button>
                        <button onClick={() => setEditingRecruiter(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleClearRecruiter} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                          {job.recruiterName && <p className="text-sm font-medium text-white">{job.recruiterName}</p>}
                          {job.recruiterTitle && <p className="text-xs text-slate-400">{job.recruiterTitle}</p>}
                          {job.recruiterEmail && (
                            <a href={`mailto:${job.recruiterEmail}`} className="flex items-center gap-2 text-xs text-violet-400 hover:underline">
                              <Mail size={11} /> {job.recruiterEmail}
                            </a>
                          )}
                          {job.recruiterLinkedIn && (
                            <a href={job.recruiterLinkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-violet-400 hover:underline">
                              <ExternalLink size={11} /> LinkedIn Profile
                            </a>
                          )}
                        </div>
                        <button onClick={startEditRecruiter} className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5">
                          <Pencil size={12} />
                        </button>
                      </div>
                      {job.recruiterName && <OutreachCard job={job} />}
                    </>
                  )}
                  <div className="border-t border-slate-800 pt-1" />
                </div>
              )}

              <p className="text-xs text-slate-500 mb-2">Search by company domain</p>
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <input
                  type="text"
                  value={finderDomain}
                  onChange={e => { setFinderDomain(e.target.value); setFinderResults(null); setFinderError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleFindRecruiter()}
                  placeholder="e.g. stripe.com"
                  className="detail-form-select flex-1 text-xs"
                />
                <button
                  onClick={handleFindRecruiter}
                  disabled={finding || !finderDomain.trim()}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
                >
                  {finding ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                  {finding ? 'Searching…' : 'Search'}
                </button>
              </div>

              {finderError && <p className="text-xs text-red-400 mt-1">{finderError}</p>}

              {finderResults !== null && finderResults.length === 0 && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-2">No recruiters found via Hunter.io.</p>
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`recruiter ${job.company}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
                  >
                    <ExternalLink size={11} /> Search LinkedIn instead
                  </a>
                </div>
              )}

              {finderResults?.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">Select recruiters to contact</p>
                    {finderFromCache && (
                      <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                        from cache · no API call
                      </span>
                    )}
                  </div>
                  {finderResults.map((r, i) => {
                    const checked = selectedRecruiterIndices.has(i)
                    const alreadyContacted = contactedEmails.has(r.email)
                    return (
                      <div
                        key={i}
                        onClick={() => !alreadyContacted && toggleRecruiterSelection(i)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                          alreadyContacted
                            ? 'bg-slate-800/40 border-slate-700/50 opacity-60 cursor-default'
                            : checked
                              ? 'bg-violet-600/10 border-violet-500/40 cursor-pointer'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!alreadyContacted && (
                            <div className={`w-3.5 h-3.5 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${checked ? 'bg-violet-600 border-violet-500' : 'border-slate-600'}`}>
                              {checked && <Check size={9} className="text-white" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-medium text-white">{r.name}</p>
                              {alreadyContacted && (
                                <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1 py-0.5 rounded-full">
                                  Already in outreach
                                </span>
                              )}
                            </div>
                            {r.title && <p className="text-[11px] text-slate-400 mt-0.5">{r.title}</p>}
                            <p className="text-[11px] text-violet-400 mt-0.5">{r.email}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{r.confidence}% confidence</p>
                          </div>
                          {!alreadyContacted && (
                            <button
                              onClick={e => { e.stopPropagation(); handleSelectRecruiter(r) }}
                              className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition-colors mt-0.5"
                            >
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {selectedRecruiterIndices.size > 0 && (
                    <button
                      onClick={handleDraftMultipleOutreach}
                      disabled={draftingOutreach}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      {draftingOutreach ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                      {draftingOutreach
                        ? 'Drafting...'
                        : `Draft outreach for ${selectedRecruiterIndices.size} recruiter${selectedRecruiterIndices.size > 1 ? 's' : ''}`}
                    </button>
                  )}
                </div>
              )}

              {outreachDrafts.length > 0 && (
                <div className="mt-3 space-y-4">
                  <p className="text-xs font-semibold text-slate-300">Outreach Drafts ({outreachDrafts.length})</p>
                  {outreachDrafts.map((d, i) => (
                    <MultiOutreachDraft key={i} draft={d} />
                  ))}
                </div>
              )}
            </aside>

            <aside className="detail-danger-card">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Danger Zone</p>
              <button onClick={handleDelete} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={13} /> Delete this application
              </button>
            </aside>
          </div>
        </div>
      </div>

      {editing && <ApplicationModal job={job} onClose={() => setEditing(false)} />}

      {resumeModalOpen && (
        <TailoredResumeModal
          job={job}
          initialSections={tailorDraft?.sections ?? job.tailoredResumeSections}
          initialHtml={!tailorDraft?.sections?.length && !job.tailoredResumeSections?.length ? (tailorDraft ? undefined : job.tailoredResumeHtml) : undefined}
          initialText={!tailorDraft?.sections?.length && !job.tailoredResumeSections?.length ? (tailorDraft ? undefined : job.tailoredResumeText) : undefined}
          initialTemplate={job.tailoredResumeTemplate ?? undefined}
          initialStyleOverrides={job.tailoredResumeStyleOverrides ?? {}}
          styleMap={tailorDraft?.styleMap ?? null}
          keywordAnalysis={tailorDraft?.keywordAnalysis ?? job.tailoredKeywordAnalysis}
          rewrittenBullets={tailorDraft?.rewrittenBullets ?? job.tailoredRewrittenBullets}
          rewrittenSummary={tailorDraft?.rewrittenSummary ?? job.tailoredRewrittenSummary}
          onSave={handleSaveTailoredResume}
          onClose={() => setResumeModalOpen(false)}
        />
      )}
    </div>
  )
}

function Section({ title, icon: Icon, badge, action, children }) {
  return (
    <div className="detail-section-card">
      <div className="detail-section-header">
        <div className="detail-section-title">
          <Icon size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {badge && <span className="detail-section-badge">{badge}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function RoundRow({ round, onDelete }) {
  const resultColor = round.result === 'Passed' ? 'text-green-400 bg-green-500/10'
    : round.result === 'Failed' ? 'text-red-400 bg-red-500/10'
    : 'text-slate-400 bg-slate-800'

  const dateStr = round.date
    ? new Date(round.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="detail-round-row">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white">{round.type}</p>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${resultColor}`}>{round.result}</span>
        </div>
        {dateStr && <p className="text-xs text-slate-400">{dateStr}</p>}
        {round.notes && <p className="text-xs text-slate-400 mt-1">{round.notes}</p>}
      </div>
      <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 mt-0.5">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-300 text-right">{value}</span>
    </div>
  )
}

function MultiOutreachDraft({ draft }) {
  const [emailBody, setEmailBody] = useState(draft.emailBody ?? '')
  const [copiedLinkedIn, setCopiedLinkedIn] = useState(false)

  const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${draft.recruiter.name} ${draft.recruiter.email?.split('@')[1]?.split('.')[0] ?? ''}`)}`

  return (
    <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
      <div>
        <p className="text-xs font-semibold text-white">{draft.recruiter.name}</p>
        {draft.recruiter.title && <p className="text-[11px] text-slate-400">{draft.recruiter.title}</p>}
        <p className="text-[11px] text-violet-400">{draft.recruiter.email}</p>
      </div>

      <div>
        <p className="text-[10px] font-medium text-slate-400 mb-1">Subject: {draft.emailSubject}</p>
        <textarea
          value={emailBody}
          onChange={e => setEmailBody(e.target.value)}
          rows={5}
          className="detail-form-select w-full text-xs resize-none"
        />
        <a
          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(draft.recruiter.email)}&su=${encodeURIComponent(draft.emailSubject ?? '')}&body=${encodeURIComponent(emailBody)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
        >
          <Mail size={11} /> Open in Gmail
        </a>
      </div>

      {draft.linkedInMessage && (
        <div className="pt-2 border-t border-slate-700/60">
          <p className="text-[10px] font-medium text-slate-400 mb-1.5">LinkedIn message</p>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800 border border-slate-700 rounded-lg p-2">
            {draft.linkedInMessage}
          </p>
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => {
                navigator.clipboard.writeText(draft.linkedInMessage)
                setCopiedLinkedIn(true)
                setTimeout(() => setCopiedLinkedIn(false), 2000)
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              {copiedLinkedIn ? <ClipboardCheck size={11} className="text-green-400" /> : <Copy size={11} />}
              {copiedLinkedIn ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={linkedInSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              <ExternalLink size={11} /> LinkedIn
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function OutreachCard({ job }) {
  const { draftRecruiterOutreach } = useAI()
  const { user } = useAuth()
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState(null)
  const [emailBody, setEmailBody] = useState('')
  const [copiedLinkedIn, setCopiedLinkedIn] = useState(false)

  async function handleDraft() {
    setDrafting(true)
    setDraft(null)
    try {
      const result = await draftRecruiterOutreach({
        company: job.company,
        role: job.role,
        recruiterName: job.recruiterName,
        recruiterTitle: job.recruiterTitle ?? '',
        senderName: user?.displayName ?? '',
      })
      if (result?.error) throw new Error('Could not generate outreach. Try again.')
      setDraft(result)
      setEmailBody(result.emailBody ?? '')
    } catch (err) {
      alert(err.message)
    } finally {
      setDrafting(false)
    }
  }

  const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${job.recruiterName} ${job.company}`)}`

  if (!draft) {
    return (
      <div className="pt-1">
        <button
          onClick={handleDraft}
          disabled={drafting}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {drafting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
          {drafting ? 'Drafting outreach...' : 'Draft outreach message'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Email draft */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-300">Email Draft</p>
          <button onClick={() => setDraft(null)} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
        </div>
        <p className="text-[11px] font-medium text-slate-400 mb-1.5">Subject: {draft.emailSubject}</p>
        <textarea
          value={emailBody}
          onChange={e => setEmailBody(e.target.value)}
          rows={6}
          className="detail-form-select w-full text-xs resize-none"
        />
        {job.recruiterEmail && (
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(job.recruiterEmail)}&su=${encodeURIComponent(draft.emailSubject ?? '')}&body=${encodeURIComponent(emailBody)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Mail size={11} /> Open in Gmail
          </a>
        )}
      </div>

      {/* LinkedIn message */}
      {draft.linkedInMessage && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-300 mb-1.5">LinkedIn Message</p>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-lg p-2.5">
            {draft.linkedInMessage}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(draft.linkedInMessage)
                setCopiedLinkedIn(true)
                setTimeout(() => setCopiedLinkedIn(false), 2000)
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              {copiedLinkedIn ? <ClipboardCheck size={11} className="text-green-400" /> : <Copy size={11} />}
              {copiedLinkedIn ? 'Copied!' : 'Copy message'}
            </button>
            <a
              href={linkedInSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              <ExternalLink size={11} /> LinkedIn
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function FollowUpCard({ job }) {
  const { draftFollowUp } = useAI()
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState(null)

  const ms = job.lastStatusChange?.toMillis?.() ?? job.createdAt?.toMillis?.() ?? 0
  const daysSinceApplied = Math.floor((Date.now() - ms) / 86400000)

  async function handleDraft() {
    setDrafting(true)
    setDraft(null)
    try {
      const result = await draftFollowUp({
        company: job.company, role: job.role, stage: job.stage,
        recruiterName: job.recruiterName, daysSinceApplied,
      })
      setDraft(result)
    } catch (err) {
      alert(err.message)
    } finally {
      setDrafting(false)
    }
  }

  if (draft) {
    return (
      <div className="detail-action-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white">Follow-Up Draft</p>
          <button onClick={() => setDraft(null)} className="text-xs text-slate-400 hover:text-slate-200">Clear</button>
        </div>
        <p className="text-[11px] font-medium text-slate-400 mb-1">Subject: {draft.subject}</p>
        <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">{draft.body}</p>
        {job.recruiterEmail && (
          <a
            href={`mailto:${job.recruiterEmail}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.body ?? '')}`}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Mail size={11} /> Open in Email
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="detail-action-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="detail-action-icon-green">
          <Mail size={13} className="text-green-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Draft Follow-Up</p>
          <p className="text-xs text-slate-400">Generate a tailored email</p>
        </div>
      </div>
      <button onClick={handleDraft} disabled={drafting} className="detail-action-btn-green">
        {drafting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
        {drafting ? 'Drafting...' : 'Generate Draft'}
      </button>
    </div>
  )
}
