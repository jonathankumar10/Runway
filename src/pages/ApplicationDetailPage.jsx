import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import {
  ArrowLeft, ExternalLink, Pencil, Sparkles, Loader2,
  CheckCircle2, Circle, Plus, Trash2, FileText,
  ChevronDown, ChevronUp, AlertTriangle, Zap,
  BookOpen, Mail, Calendar, MessageSquare,
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { useAI } from '../hooks/useAI'
import { useJobMutations } from '../hooks/useJobMutations'
import { STAGE_MAP } from '../constants/stages'
import ApplicationModal from '../components/modals/ApplicationModal'
import './ApplicationDetailPage.css'

const ROUND_TYPES = ['Phone Screen', 'Technical Interview', 'System Design', 'Behavioral', 'Final Round', 'Other']
const ROUND_RESULTS = ['Pending', 'Passed', 'Failed']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

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
  const { matchResume, generateInterviewQuestions } = useAI()
  const { deleteJob } = useJobMutations()

  const [editing, setEditing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [notes, setNotes] = useState(null)
  const [notesSaving, setNotesSaving] = useState(false)
  const [jdExpanded, setJdExpanded] = useState(false)
  const [addingRound, setAddingRound] = useState(false)
  const [newRound, setNewRound] = useState({ type: 'Phone Screen', date: '', result: 'Pending', notes: '' })
  const [questionCount, setQuestionCount] = useState(5)
  const [difficulty, setDifficulty] = useState('Medium')
  const [questions, setQuestions] = useState([])
  const [generatingQ, setGeneratingQ] = useState(false)

  const job = jobs.find(j => j.id === jobId)

  if (!loading && !job) {
    navigate('/board', { replace: true })
    return null
  }

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-slate-500 animate-spin" />
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
        })
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setMatching(false)
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

  async function handleGenerateQuestions() {
    setGeneratingQ(true)
    setQuestions([])
    try {
      const result = await generateInterviewQuestions(
        job.company, job.role, job.jobDescription ?? '', questionCount, difficulty.toLowerCase()
      )
      if (result?.questions) setQuestions(result.questions)
      else alert('Could not generate questions. Try adding a job description first.')
    } catch (err) {
      alert(err.message)
    } finally {
      setGeneratingQ(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${job.company} – ${job.role}? This cannot be undone.`)) return
    await deleteJob(job.id)
    navigate('/board', { replace: true })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="detail-topnav">
        <button onClick={() => navigate('/board')} className="detail-back-btn">
          <ArrowLeft size={15} /> Back to applications
        </button>
        <div className="flex items-center gap-2">
          {job.jobUrl && (
            <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="detail-back-btn">
              <ExternalLink size={13} /> View posting
            </a>
          )}
          <button onClick={() => setEditing(true)} className="detail-edit-btn">
            <Pencil size={12} /> Edit
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-6xl mx-auto">
        <p className="text-xs text-slate-500 mb-4">WORKSPACE &rsaquo; {job.company?.toUpperCase()}</p>

        <div className="flex items-start gap-4 mb-8">
          {job.logoUrl ? (
            <img src={job.logoUrl} alt="" className="detail-logo" onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <div className="detail-logo-fallback">{job.company?.[0]?.toUpperCase() ?? '?'}</div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{job.company || 'Untitled'}</h1>
            <p className="text-slate-400 mt-0.5">{job.role || 'No role'}</p>
            <div className="flex items-center gap-3 mt-2.5">
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 ${stage?.textClass ?? 'text-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass ?? 'bg-slate-500'}`} />
                {stage?.label ?? job.stage}
              </span>
              {job.matchScore != null && (
                <span className={`text-sm font-bold ${job.matchScore >= 75 ? 'text-green-400' : job.matchScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {job.matchScore}% match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="detail-action-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="detail-action-icon-violet">
                <Sparkles size={13} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {job.matchScore != null ? `${job.matchScore}% Match Score` : 'AI Match Score'}
                </p>
                <p className="text-[10px] text-slate-500">
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

          <div className="detail-action-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="detail-action-icon-blue">
                <BookOpen size={13} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Interview Prep Hub</p>
                <p className="text-[10px] text-slate-500">MCQs · Skills · Projects · Tips</p>
              </div>
            </div>
            <a href="https://github.com/jonathanpasupulety/JobPrep" target="_blank" rel="noopener noreferrer" className="detail-action-btn-blue">
              <ExternalLink size={11} /> Open Guide
            </a>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-5">

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
                <p className="text-sm text-slate-500">
                  No job description added.{' '}
                  <button onClick={() => setEditing(true)} className="text-violet-400 hover:underline">Edit this application</button>{' '}
                  to paste it in.
                </p>
              )}
            </Section>

            {(job.matchHighlights?.length > 0 || job.matchGaps?.length > 0) && (
              <Section title="Match Analysis" icon={Sparkles}>
                <div className="grid grid-cols-2 gap-6">
                  {job.matchHighlights?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</p>
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
                      <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide mb-2">Gaps</p>
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
              </Section>
            )}

            <Section title="My To-Dos" icon={CheckCircle2} badge={`${completedTodos}/${todos.length}`}>
              <div className="w-full bg-slate-800 rounded-full h-1 mb-5">
                <div className="todo-progress bg-violet-500 h-1 rounded-full transition-all"
                  style={{ '--progress-w': `${(completedTodos / todos.length) * 100}%` }} />
              </div>
              <div className="space-y-4">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-start gap-3">
                    {todo.done
                      ? <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
                      : <Circle size={16} className="text-slate-600 shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className={`text-sm font-medium ${todo.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {todo.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{todo.desc}</p>
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
                      <div className="grid grid-cols-2 gap-2">
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
                      <div className="flex gap-2">
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
                <p className="text-sm text-slate-500">No interview rounds tracked yet.</p>
              )}
            </Section>

            <Section title="Practice Interview Questions" icon={MessageSquare}>
              <p className="text-xs text-slate-500 mb-4">{job.company} &middot; {job.role}</p>
              <div className="flex gap-6 mb-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Questions</p>
                  <div className="flex gap-1.5">
                    {[5, 10].map(n => (
                      <button key={n} onClick={() => setQuestionCount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${questionCount === n ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Difficulty</p>
                  <div className="flex gap-1.5">
                    {DIFFICULTIES.map(d => (
                      <button key={d} onClick={() => setDifficulty(d)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${difficulty === d ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleGenerateQuestions} disabled={generatingQ} className="detail-generate-btn">
                {generatingQ ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {generatingQ ? 'Generating...' : `Generate ${questionCount} questions`}
              </button>
              {questions.length > 0 && (
                <ol className="space-y-3">
                  {questions.map((q, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-xs font-bold text-slate-500 shrink-0 mt-0.5 w-4">{i + 1}.</span>
                      <span className="text-sm text-slate-300 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Notes" icon={FileText}>
              <textarea
                value={currentNotes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes, impressions, key skills to highlight, interview prep..."
                rows={6}
                className="detail-form-textarea"
              />
              {notesSaving && <p className="text-[10px] text-slate-500 mt-1">Saving...</p>}
            </Section>
          </div>

          {/* Right sidebar */}
          <div className="w-60 shrink-0 space-y-4">
            <aside className="detail-sidebar-card">
              <p className="detail-sidebar-label">Resume</p>
              <Link to="/resumes" className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                <FileText size={13} /> Manage in Resume Library →
              </Link>
            </aside>

            {(job.recruiterName || job.recruiterEmail || job.recruiterLinkedIn) && (
              <aside className="detail-sidebar-card">
                <p className="detail-sidebar-label">Contacts</p>
                <div className="space-y-2">
                  {job.recruiterName && <p className="text-sm font-medium text-white">{job.recruiterName}</p>}
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
              </aside>
            )}

            <aside className="detail-sidebar-card space-y-2.5">
              {appliedDate && <MetaRow label="Applied" value={appliedDate} />}
              {salary && <MetaRow label="Salary" value={salary} />}
              {job.location && <MetaRow label="Location" value={job.location} />}
              {job.source && <MetaRow label="Source" value={job.source} />}
              {job.nextStep && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-1">Next Step</p>
                  <p className="text-xs text-slate-300">{job.nextStep}</p>
                </div>
              )}
              {addedDate && <MetaRow label="Added" value={addedDate} />}
              {updatedDate && <MetaRow label="Updated" value={updatedDate} />}
            </aside>

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

            <aside className="detail-danger-card">
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-3">Danger Zone</p>
              <button onClick={handleDelete} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={13} /> Delete this application
              </button>
            </aside>
          </div>
        </div>
      </div>

      {editing && <ApplicationModal job={job} onClose={() => setEditing(false)} />}
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
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${resultColor}`}>{round.result}</span>
        </div>
        {dateStr && <p className="text-xs text-slate-500">{dateStr}</p>}
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
      <span className="text-[10px] text-slate-500 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-300 text-right">{value}</span>
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
          <button onClick={() => setDraft(null)} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
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
          <p className="text-[10px] text-slate-500">Generate a tailored email</p>
        </div>
      </div>
      <button onClick={handleDraft} disabled={drafting} className="detail-action-btn-green">
        {drafting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
        {drafting ? 'Drafting...' : 'Generate Draft'}
      </button>
    </div>
  )
}
