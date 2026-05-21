import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query, addDoc, updateDoc, deleteDoc,
  doc, getDoc, serverTimestamp, getDocs, where, limit,
} from 'firebase/firestore'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import {
  Send, Mail, ExternalLink, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Clock, Users, Plus, Search, X, Trash2, Copy,
  ClipboardCheck, Paperclip, LayoutList, LayoutGrid,
} from 'lucide-react'
import { db, auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { useAI } from '../hooks/useAI'
import {
  buildEmailSubject, buildEmailBody, buildFollowUpSubject,
  buildFollowUpBody, buildLinkedInMessage,
} from '../constants/outreachTemplates'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/ui/Pagination'
import './OutreachPage.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'email_sent', label: 'Email Sent' },
  { key: 'linkedin_sent', label: 'LinkedIn' },
  { key: 'done', label: 'Done' },
]

// Lower number = higher up in the list.
// Pending (needs action) comes first, fully done comes last.
const OUTREACH_PRIORITY = { pending: 0, email_sent: 1, linkedin_sent: 2, done: 3 }

function getOutreachPriority(record) {
  if (record.emailSent && record.linkedInSent) return OUTREACH_PRIORITY.done
  if (record.emailSent)   return OUTREACH_PRIORITY.email_sent
  if (record.linkedInSent) return OUTREACH_PRIORITY.linkedin_sent
  return OUTREACH_PRIORITY.pending
}

export default function OutreachPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('cards') // 'cards' | 'table'
  const [addOpen, setAddOpen] = useState(false)
  const [defaultResume, setDefaultResume] = useState(null)
  const gmailTokenRef = useRef(null) // { accessToken, expiresAt }
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkResult, setBulkResult] = useState(null) // { success, failed }
  const [linkedInQueue, setLinkedInQueue] = useState(null) // array of records | null = closed
  const [linkedInQueueIdx, setLinkedInQueueIdx] = useState(0)
  const [linkedInCopied, setLinkedInCopied] = useState(false)
  // Pre-fill from Target Companies "Find Recruiters" button
  const prefillDomain = searchParams.get('domain') ?? ''
  const prefillCompany = searchParams.get('company') ?? ''

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'users', user.uid, 'outreach'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    getDocs(query(collection(db, 'users', user.uid, 'resumes'), where('isDefault', '==', true), limit(1)))
      .then(snap => setDefaultResume(snap.docs[0]?.data() ?? null))
  }, [user?.uid])

  // Auto-open add modal when navigated from Target Companies page
  useEffect(() => {
    if (prefillDomain) {
      setAddOpen(true)
      // Clear params so browser back doesn't re-open
      setSearchParams({}, { replace: true })
    }
  }, [])

  async function getGmailToken() {
    const tok = gmailTokenRef.current
    if (tok && Date.now() < tok.expiresAt) return tok.accessToken
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/gmail.compose')
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    gmailTokenRef.current = { accessToken: credential.accessToken, expiresAt: Date.now() + 3500_000 }
    return credential.accessToken
  }

  const eligibleForBulk = records.filter(r => !r.emailSent && r.recruiterEmail)
  const eligibleForLinkedIn = records.filter(r => !r.linkedInSent && r.linkedInMessage)

  function startLinkedInQueue() {
    if (eligibleForLinkedIn.length === 0) return
    setLinkedInQueue(eligibleForLinkedIn)
    setLinkedInQueueIdx(0)
    setLinkedInCopied(false)
    const msg = eligibleForLinkedIn[0]?.linkedInMessage
    if (msg) navigator.clipboard.writeText(msg).catch(() => {})
  }

  async function linkedInMarkSentAndNext() {
    const record = linkedInQueue[linkedInQueueIdx]
    await updateDoc(doc(db, 'users', user.uid, 'outreach', record.id), {
      linkedInSent: true, linkedInSentAt: new Date(),
    })
    advanceLinkedInQueue()
  }

  function advanceLinkedInQueue() {
    const nextIdx = linkedInQueueIdx + 1
    if (nextIdx >= linkedInQueue.length) {
      setLinkedInQueue(null)
      return
    }
    setLinkedInQueueIdx(nextIdx)
    setLinkedInCopied(false)
    const msg = linkedInQueue[nextIdx]?.linkedInMessage
    if (msg) navigator.clipboard.writeText(msg).catch(() => {})
  }

  function toggleSelectRecord(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(eligibleForBulk.map(r => r.id)))
  }

  async function handleBulkDraft(records = null) {
    const toSend = records ?? eligibleForBulk.filter(r => selectedIds.has(r.id))
    if (toSend.length === 0) return
    setBulkCreating(true)
    setBulkResult(null)
    let success = 0
    let failed = 0
    try {
      const token = await getGmailToken()
      for (const record of toSend) {
        try {
          const raw = buildGmailRaw({
            to: record.recruiterEmail,
            subject: record.emailSubject,
            body: record.emailBody,
            pdfBase64: defaultResume?.pdfBase64 ?? null,
            pdfFilename: defaultResume?.filename || 'resume.pdf',
          })
          const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { raw } }),
          })
          if (!res.ok) throw new Error()
          await updateDoc(doc(db, 'users', user.uid, 'outreach', record.id), {
            emailSent: true, emailSentAt: new Date(),
          })
          success++
        } catch {
          failed++
        }
      }
      setSelectedIds(new Set())
      setBulkResult({ success, failed })
      window.open('https://mail.google.com/mail/#drafts', '_blank', 'noopener,noreferrer')
    } catch (err) {
      setBulkResult({ success: 0, failed: toSend.length, error: err.message })
    } finally {
      setBulkCreating(false)
    }
  }

  const filtered = records.filter(r => {
    if (filter === 'all') return true
    if (filter === 'pending') return !r.emailSent && !r.linkedInSent
    if (filter === 'email_sent') return r.emailSent && !r.linkedInSent
    if (filter === 'linkedin_sent') return r.linkedInSent && !r.emailSent
    if (filter === 'done') return r.emailSent && r.linkedInSent
    return true
  })

  // Sort: pending first → email sent → linkedin sent → fully done (sinks to bottom)
  const sorted = [...filtered].sort((a, b) => getOutreachPriority(a) - getOutreachPriority(b))

  // Cards are tall so 8 per page feels comfortable; table rows are compact so 15 fits well
  const PAGE_SIZE = view === 'table' ? 15 : 8
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(sorted, PAGE_SIZE)

  // Jump back to page 1 whenever the user switches filter or view
  useEffect(() => { goToPage(1) }, [filter, view])

  const counts = {
    all: records.length,
    pending: records.filter(r => !r.emailSent && !r.linkedInSent).length,
    email_sent: records.filter(r => r.emailSent && !r.linkedInSent).length,
    linkedin_sent: records.filter(r => r.linkedInSent && !r.emailSent).length,
    done: records.filter(r => r.emailSent && r.linkedInSent).length,
  }

  const contactedEmails = new Set(records.map(r => r.recruiterEmail).filter(Boolean))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="outreach-topnav">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="outreach-header-icon">
              <Send size={15} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Recruiter Outreach</h1>
              <p className="text-xs text-slate-400">
                {records.length} recruiter{records.length !== 1 ? 's' : ''} tracked
                {counts.done > 0 && ` · ${counts.done} done`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-800 rounded-lg border border-slate-700">
              <button
                onClick={() => setView('cards')}
                className={`p-1.5 rounded-md transition-colors ${view === 'cards' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Card view"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setView('table')}
                className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Table view"
              >
                <LayoutList size={13} />
              </button>
            </div>
            {eligibleForBulk.length > 0 && (
              <button
                onClick={() => selectedIds.size > 0 ? handleBulkDraft() : handleBulkDraft(eligibleForBulk)}
                disabled={bulkCreating}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {bulkCreating ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                {bulkCreating
                  ? 'Creating drafts…'
                  : selectedIds.size > 0
                    ? `Create ${selectedIds.size} Gmail draft${selectedIds.size !== 1 ? 's' : ''}`
                    : `Draft unsent`}
                {!bulkCreating && (
                  <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {selectedIds.size > 0 ? selectedIds.size : eligibleForBulk.length}
                  </span>
                )}
              </button>
            )}
            {eligibleForLinkedIn.length > 0 && (
              <button
                onClick={startLinkedInQueue}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <ExternalLink size={13} />
                LinkedIn unsent
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{eligibleForLinkedIn.length}</span>
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={13} /> Add Recruiter
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`outreach-filter-tab ${filter === f.key ? 'outreach-filter-tab--active' : ''}`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-800 text-slate-500'}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              {filter === 'all' ? 'No outreach tracked yet' : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} outreach`}
            </p>
            <p className="text-slate-500 text-xs mt-1 mb-4">
              Add a recruiter to start tracking your cold outreach.
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 mx-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Recruiter
              </button>
            )}
          </div>
        ) : view === 'table' ? (
          <>
            <OutreachTable
              records={paginatedItems}
              userId={user.uid}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectRecord}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onGoToPage={goToPage}
              totalItems={sorted.length}
              pageSize={PAGE_SIZE}
            />
          </>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedItems.map(record => (
                <OutreachCard
                  key={record.id}
                  record={record}
                  userId={user.uid}
                  defaultResume={defaultResume}
                  gmailTokenRef={gmailTokenRef}
                  onNeedGmailToken={getGmailToken}
                  isSelected={selectedIds.has(record.id)}
                  onToggleSelect={toggleSelectRecord}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onGoToPage={goToPage}
              totalItems={sorted.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>

      {/* Bulk action bar */}
      {(selectedIds.size > 0 || bulkResult) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
          {bulkResult ? (
            <>
              <p className="text-xs text-slate-300">
                {bulkResult.success > 0 && <span className="text-green-400">{bulkResult.success} draft{bulkResult.success !== 1 ? 's' : ''} created</span>}
                {bulkResult.failed > 0 && <span className="text-red-400 ml-1">{bulkResult.failed} failed</span>}
                {bulkResult.error && <span className="text-red-400 ml-1">— {bulkResult.error}</span>}
              </p>
              <button onClick={() => setBulkResult(null)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-white">{selectedIds.size}</span> selected
              </p>
              {selectedIds.size < eligibleForBulk.length && (
                <button onClick={selectAll} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Select all {eligibleForBulk.length}
                </button>
              )}
              <button
                onClick={handleBulkDraft}
                disabled={bulkCreating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {bulkCreating ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                {bulkCreating ? 'Creating drafts…' : `Create ${selectedIds.size} Gmail draft${selectedIds.size !== 1 ? 's' : ''}`}
                {defaultResume && !bulkCreating && <Paperclip size={9} className="ml-0.5 opacity-70" />}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear selection"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      )}

      {addOpen && (
        <AddRecruiterModal
          userId={user.uid}
          contactedEmails={contactedEmails}
          initialDomain={prefillDomain}
          initialCompany={prefillCompany}
          onClose={() => setAddOpen(false)}
        />
      )}

      {linkedInQueue && linkedInQueue[linkedInQueueIdx] && (() => {
        const record = linkedInQueue[linkedInQueueIdx]
        const liUrl = record.recruiterLinkedIn
          ? (record.recruiterLinkedIn.startsWith('http') ? record.recruiterLinkedIn : `https://${record.recruiterLinkedIn}`)
          : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${record.recruiterName} ${record.company}`)}`
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4" onClick={e => e.target === e.currentTarget && setLinkedInQueue(null)}>
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">
                    {linkedInQueueIdx + 1} of {linkedInQueue.length}
                  </p>
                  <h3 className="text-sm font-semibold text-white">{record.recruiterName}</h3>
                  {record.recruiterTitle && <p className="text-xs text-slate-400">{record.recruiterTitle}</p>}
                  <p className="text-xs text-slate-500">{record.company}{record.role ? ` · ${record.role}` : ''}</p>
                </div>
                <button onClick={() => setLinkedInQueue(null)} className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5">
                  <X size={15} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${((linkedInQueueIdx + 1) / linkedInQueue.length) * 100}%` }}
                />
              </div>

              {/* Message preview */}
              <div>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">Message (auto-copied)</p>
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                  {record.linkedInMessage}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(record.linkedInMessage).catch(() => {})
                    setLinkedInCopied(true)
                    setTimeout(() => setLinkedInCopied(false), 2000)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  {linkedInCopied ? <ClipboardCheck size={12} className="text-green-400" /> : <Copy size={12} />}
                  {linkedInCopied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={liUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <ExternalLink size={12} /> Open LinkedIn
                </a>
                <button
                  onClick={advanceLinkedInQueue}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={linkedInMarkSentAndNext}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <CheckCircle2 size={12} />
                  {linkedInQueueIdx + 1 < linkedInQueue.length ? 'Sent · Next →' : 'Sent · Done'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function plainToHtml(text) {
  const paragraphs = text.split(/\n\n+/)
  const blocks = paragraphs.map(para => {
    const lines = para.split('\n')
    // Bullet list block
    if (lines.every(l => l.trim().startsWith('- '))) {
      const items = lines.map(l => `<li>${l.replace(/^- /, '').trim()}</li>`).join('')
      return `<ul style="margin:0 0 14px;padding-left:20px;">${items}</ul>`
    }
    return `<p style="margin:0 0 14px;">${lines.join('<br>')}</p>`
  })
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${blocks.join('')}</div>`
}

function buildGmailRaw({ to, subject, body, pdfBase64 = null, pdfFilename = null }) {
  const enc = new TextEncoder()
  const toB64 = str => {
    const bytes = enc.encode(str)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin)
  }
  const subjectEncoded = /[^\x20-\x7E]/.test(subject) ? `=?UTF-8?B?${toB64(subject)}?=` : subject
  const htmlBody = plainToHtml(body)

  if (!pdfBase64) {
    const mime = [
      `MIME-Version: 1.0`,
      `To: ${to}`,
      `Subject: ${subjectEncoded}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toB64(htmlBody),
    ].join('\r\n')
    return btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const pdfData = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
  const mime = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    toB64(htmlBody),
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfData,
    ``,
    `--${boundary}--`,
  ].join('\r\n')
  return btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function OutreachCard({ record, userId, defaultResume, gmailTokenRef, onNeedGmailToken, isSelected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const [emailBody, setEmailBody] = useState(record.emailBody ?? '')
  const [copiedLinkedIn, setCopiedLinkedIn] = useState(false)
  const [draftCreating, setDraftCreating] = useState(false)
  const [draftError, setDraftError] = useState(null)

  const ref = doc(db, 'users', userId, 'outreach', record.id)

  async function openGmailDraft(subject, body, isFollowUp = false) {
    if (!record.recruiterEmail) return
    setDraftCreating(true)
    setDraftError(null)
    try {
      const token = await onNeedGmailToken()
      const raw = buildGmailRaw({
        to: record.recruiterEmail,
        subject,
        body,
        pdfBase64: defaultResume?.pdfBase64 ?? null,
        pdfFilename: defaultResume?.filename || 'resume.pdf',
      })

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw } }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Gmail API error')
      }

      const field = isFollowUp ? 'followUpSent' : 'emailSent'
      const atField = isFollowUp ? 'followUpSentAt' : 'emailSentAt'
      if (!record[field]) updateDoc(ref, { [field]: true, [atField]: new Date() })

      window.open('https://mail.google.com/mail/#drafts', '_blank', 'noopener,noreferrer')
    } catch (err) {
      setDraftError(err.message)
    } finally {
      setDraftCreating(false)
    }
  }

  async function mark(field) {
    await updateDoc(ref, { [field]: true, [`${field}At`]: new Date() })
  }

  async function unmark(field) {
    await updateDoc(ref, { [field]: false, [`${field}At`]: null })
  }

  async function handleDelete() {
    if (!confirm(`Remove ${record.recruiterName} from outreach tracker?`)) return
    await deleteDoc(ref)
  }

  const createdStr = record.createdAt?.toDate
    ? record.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const isDone = record.emailSent && record.linkedInSent

  const linkedInUrl = record.recruiterLinkedIn
    ? (record.recruiterLinkedIn.startsWith('http') ? record.recruiterLinkedIn : `https://${record.recruiterLinkedIn}`)
    : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${record.recruiterName} ${record.recruiterEmail?.split('@')[1]?.split('.')[0] ?? ''}`)}`

  const isSelectable = !record.emailSent && !!record.recruiterEmail

  return (
    <div
      className={`outreach-card ${isDone ? 'outreach-card--done' : ''} ${isSelected ? 'ring-1 ring-violet-500' : ''} ${isSelectable ? 'cursor-pointer' : ''}`}
      onClick={isSelectable ? (e => { if (!e.target.closest('button, a, input, textarea')) onToggleSelect(record.id) }) : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        {isSelectable && (
          <button
            onClick={e => { e.stopPropagation(); onToggleSelect(record.id) }}
            className={`mt-0.5 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-600 border-violet-500' : 'border-slate-600 hover:border-slate-400'}`}
            title={isSelected ? 'Deselect' : 'Select for bulk draft'}
          >
            {isSelected && <CheckCircle2 size={11} className="text-white" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-white">{record.recruiterName}</p>
            {isDone && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 size={8} /> Done
              </span>
            )}
          </div>
          {record.recruiterTitle && <p className="text-xs text-slate-400">{record.recruiterTitle}</p>}
          <p className="text-xs text-slate-500 mt-0.5">
            {record.company}{record.role ? ` · ${record.role}` : ''}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {record.recruiterEmail && (
              <a href={`mailto:${record.recruiterEmail}`} className="flex items-center gap-1 text-[11px] text-violet-400 hover:underline">
                <Mail size={9} /> {record.recruiterEmail}
              </a>
            )}
            {record.recruiterLinkedIn && (
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-violet-400 hover:underline">
                <ExternalLink size={9} /> LinkedIn
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {createdStr && <p className="text-[10px] text-slate-500">{createdStr}</p>}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => record.emailSent ? unmark('emailSent') : mark('emailSent')}
              className={`outreach-status-badge cursor-pointer hover:opacity-80 transition-opacity ${record.emailSent ? 'outreach-status-badge--sent' : 'outreach-status-badge--pending'}`}
              title={record.emailSent ? 'Click to unmark' : 'Mark email sent'}
            >
              {record.emailSent ? '✓ ' : ''}Email
            </button>
            <button
              onClick={() => record.linkedInSent ? unmark('linkedInSent') : mark('linkedInSent')}
              className={`outreach-status-badge cursor-pointer hover:opacity-80 transition-opacity ${record.linkedInSent ? 'outreach-status-badge--sent' : 'outreach-status-badge--pending'}`}
              title={record.linkedInSent ? 'Click to unmark' : 'Mark LinkedIn sent'}
            >
              {record.linkedInSent ? '✓ ' : ''}LinkedIn
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(x => !x)}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? 'Hide' : 'View draft'}
            </button>
            <button onClick={handleDelete} className="text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up status */}
      {record.emailSent && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => record.followUpSent ? unmark('followUpSent') : mark('followUpSent')}
            className={`flex items-center gap-1 text-[11px] transition-colors ${record.followUpSent ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
          >
            <Clock size={10} />
            {record.followUpSent ? '✓ Follow-up sent' : 'Mark follow-up sent'}
          </button>
        </div>
      )}

      {/* Expanded drafts */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-5">
          {/* Email draft */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Email</p>
            <p className="text-[10px] text-slate-500 mb-1.5">Subject: <span className="text-slate-400">{record.emailSubject}</span></p>
            <textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              rows={10}
              className="outreach-textarea"
            />
            {record.recruiterEmail && (
              record.emailSent ? (
                <p className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 text-green-400 text-xs font-medium">
                  <CheckCircle2 size={11} /> Email already sent
                </p>
              ) : (
                <button
                  onClick={() => openGmailDraft(record.emailSubject, emailBody, false)}
                  disabled={draftCreating}
                  className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  {draftCreating ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                  {draftCreating
                    ? 'Creating draft…'
                    : defaultResume
                      ? <><Paperclip size={10} className="mr-0.5" />Create Gmail draft with resume</>
                      : 'Create Gmail draft'}
                </button>
              )
            )}
            {defaultResume && (
              <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                {defaultResume.label || defaultResume.filename} will be attached
              </p>
            )}
            {!defaultResume && (
              <p className="text-[10px] text-amber-500/80 mt-1.5 text-center">
                No default resume —{' '}
                <a href="/resumes" className="underline hover:text-amber-400">set one</a>{' '}
                to auto-attach
              </p>
            )}
            {draftError && <p className="text-[10px] text-red-400 mt-1.5 text-center">{draftError}</p>}
          </div>

          {/* Follow-up draft */}
          {record.followUpBody && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Follow-Up Email</p>
              <p className="text-[10px] text-slate-500 mb-1.5">Subject: <span className="text-slate-400">{record.followUpSubject}</span></p>
              <pre className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 border border-slate-700 rounded-lg p-2.5 whitespace-pre-wrap font-sans">
                {record.followUpBody}
              </pre>
              {record.recruiterEmail && (
                record.followUpSent ? (
                  <p className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 text-amber-400 text-xs font-medium">
                    <CheckCircle2 size={11} /> Follow-up already sent
                  </p>
                ) : (
                  <button
                    onClick={() => openGmailDraft(record.followUpSubject, record.followUpBody, true)}
                    disabled={draftCreating}
                    className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                  >
                    {draftCreating ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                    {defaultResume ? <><Paperclip size={10} className="mr-0.5" />Create follow-up draft with resume</> : 'Create follow-up draft'}
                  </button>
                )
              )}
            </div>
          )}

          {/* LinkedIn message */}
          {record.linkedInMessage && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">LinkedIn Message</p>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 border border-slate-700 rounded-lg p-2.5">
                {record.linkedInMessage}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(record.linkedInMessage)
                    setCopiedLinkedIn(true)
                    setTimeout(() => setCopiedLinkedIn(false), 2000)
                    if (!record.linkedInSent) updateDoc(ref, { linkedInSent: true, linkedInSentAt: new Date() })
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  {copiedLinkedIn
                    ? <><ClipboardCheck size={11} className="text-green-400" /> Copied &amp; marked sent</>
                    : <><Copy size={11} /> Copy &amp; mark sent</>}
                </button>
                <a
                  href={linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  <ExternalLink size={11} /> {record.recruiterLinkedIn ? 'Profile' : 'Search'}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OutreachTable({ records, userId, selectedIds, onToggleSelect }) {
  async function toggle(record, field) {
    const ref = doc(db, 'users', userId, 'outreach', record.id)
    await updateDoc(ref, { [field]: !record[field], [`${field}At`]: !record[field] ? new Date() : null })
  }

  async function remove(record) {
    if (!confirm(`Remove ${record.recruiterName}?`)) return
    await deleteDoc(doc(db, 'users', userId, 'outreach', record.id))
  }

  if (records.length === 0) {
    return <p className="text-center py-12 text-slate-500 text-sm">No outreach records.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-xs border-collapse bg-slate-900" style={{ minWidth: '700px' }}>
        <thead>
          <tr>
            {['', 'Recruiter', 'Company / Role', 'Email', 'Email Sent', 'LinkedIn', 'Follow-up', 'Added', ''].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-900 border-b border-slate-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map(r => {
            const added = r.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) ?? '—'
            return (
              <tr key={r.id} className="hover:[&>td]:bg-slate-800/30">
                <td className="px-3 py-2.5 border-b border-slate-800/60 w-6">
                  {!r.emailSent && r.recruiterEmail && (
                    <button
                      onClick={() => onToggleSelect(r.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(r.id) ? 'bg-violet-600 border-violet-500' : 'border-slate-600 hover:border-slate-400'}`}
                    >
                      {selectedIds.has(r.id) && <CheckCircle2 size={9} className="text-white" />}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60">
                  <p className="font-medium text-white">{r.recruiterName}</p>
                  {r.recruiterTitle && <p className="text-[10px] text-slate-500">{r.recruiterTitle}</p>}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60">
                  <p className="text-slate-300">{r.company}</p>
                  {r.role && <p className="text-[10px] text-slate-500">{r.role}</p>}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60">
                  {r.recruiterEmail
                    ? <a href={`mailto:${r.recruiterEmail}`} className="text-violet-400 hover:underline">{r.recruiterEmail}</a>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60 text-center">
                  <button onClick={() => toggle(r, 'emailSent')} title="Toggle">
                    {r.emailSent
                      ? <CheckCircle2 size={13} className="text-green-400 mx-auto" />
                      : <span className="text-slate-600 text-base leading-none">○</span>}
                  </button>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60 text-center">
                  <button onClick={() => toggle(r, 'linkedInSent')} title="Toggle">
                    {r.linkedInSent
                      ? <CheckCircle2 size={13} className="text-green-400 mx-auto" />
                      : <span className="text-slate-600 text-base leading-none">○</span>}
                  </button>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60 text-center">
                  <button onClick={() => toggle(r, 'followUpSent')} title="Toggle">
                    {r.followUpSent
                      ? <CheckCircle2 size={13} className="text-amber-400 mx-auto" />
                      : <span className="text-slate-600 text-base leading-none">○</span>}
                  </button>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-800/60 text-slate-500 whitespace-nowrap">{added}</td>
                <td className="px-3 py-2.5 border-b border-slate-800/60">
                  <button onClick={() => remove(r)} className="text-slate-700 hover:text-red-400 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AddRecruiterModal({ userId, contactedEmails, initialDomain = '', initialCompany = '', onClose }) {
  const { findRecruiter, importFromUrl } = useAI()
  const { jobs } = useJobs() ?? { jobs: [] }

  const [step, setStep] = useState('search') // 'search' | 'manual'
  const [domain, setDomain] = useState(initialDomain)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [fromCache, setFromCache] = useState(false)
  const [domainCached, setDomainCached] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [company, setCompany] = useState(initialCompany)
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)

  // Job linking — mutually exclusive: board picker vs URL paste
  const [jobLinkMode, setJobLinkMode] = useState('none') // 'none' | 'board' | 'url'
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobPostingUrl, setJobPostingUrl] = useState('')
  const [fetchingJob, setFetchingJob] = useState(false)
  const [fetchedJob, setFetchedJob] = useState(null) // { role, company, jobUrl }
  const [fetchJobError, setFetchJobError] = useState(null)

  const selectedJob = jobLinkMode === 'board' ? (jobs.find(j => j.id === selectedJobId) ?? null) : null
  const linkedJob = selectedJob
    ? { role: selectedJob.role, company: selectedJob.company, jobUrl: selectedJob.jobUrl ?? null }
    : fetchedJob

  useEffect(() => {
    if (!selectedJob) return
    setCompany(selectedJob.company || '')
    setRole(selectedJob.role || '')
    if (selectedJob.jobUrl) {
      try {
        const hostname = new URL(selectedJob.jobUrl).hostname.replace(/^www\./, '')
        setDomain(hostname)
        setSearchResults(null)
        setSearchError(null)
      } catch {}
    }
  }, [selectedJobId])

  useEffect(() => {
    if (!fetchedJob) return
    setCompany(fetchedJob.company || '')
    setRole(fetchedJob.role || '')
    try {
      const hostname = new URL(fetchedJob.jobUrl).hostname.replace(/^www\./, '')
      setDomain(hostname)
      setSearchResults(null)
      setSearchError(null)
    } catch {}
  }, [fetchedJob])

  async function handleFetchJobUrl() {
    if (!jobPostingUrl.trim()) return
    setFetchingJob(true)
    setFetchJobError(null)
    setFetchedJob(null)
    try {
      const result = await importFromUrl(jobPostingUrl.trim())
      if (result.error) throw new Error('Could not parse the job posting. Try pasting the URL again.')
      if (!result.role) throw new Error('No role title found on that page.')
      setFetchedJob({ role: result.role, company: result.company, jobUrl: jobPostingUrl.trim() })
    } catch (err) {
      setFetchJobError(err.message)
    } finally {
      setFetchingJob(false)
    }
  }

  function handleJobLinkModeChange(mode) {
    setJobLinkMode(mode)
    if (mode !== 'board') { setSelectedJobId(''); }
    if (mode !== 'url') { setJobPostingUrl(''); setFetchedJob(null); setFetchJobError(null); }
    if (mode === 'none') { setCompany(initialCompany); setRole(''); }
  }

  // Check Firestore cache whenever domain input changes (debounced)
  useEffect(() => {
    setDomainCached(false)
    if (!domain.trim()) return
    const normalized = domain.trim()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase()
    if (!normalized) return
    const t = setTimeout(async () => {
      const snap = await getDoc(doc(db, 'users', userId, 'recruiterCache', normalized))
      if (snap.exists()) {
        const age = Date.now() - snap.data().cachedAt.toMillis()
        setDomainCached(age < 30 * 24 * 60 * 60 * 1000)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [domain, userId])

  const [manual, setManual] = useState({ name: '', email: '', title: '', linkedin: '', company: '', role: '' })

  async function handleSearch() {
    if (!domain.trim()) return
    setSearching(true)
    setSearchResults(null)
    setSearchError(null)
    setSelected(new Set())

    const normalized = domain.trim()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase()
    const domainLabel = normalized.split('.')[0]
    const companyGuess = domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1)

    try {
      let recruiters = null
      let cached = false

      // Check our Firestore cache before ever touching the Hunter API
      const cacheSnap = await getDoc(doc(db, 'users', userId, 'recruiterCache', normalized))
      if (cacheSnap.exists()) {
        const data = cacheSnap.data()
        if (Date.now() - data.cachedAt.toMillis() < 30 * 24 * 60 * 60 * 1000) {
          recruiters = data.recruiters
          cached = true
        }
      }

      // Cache miss — call Hunter (cloud function caches the result for next time)
      if (!recruiters) {
        const result = await findRecruiter(domain.trim())
        if (result.error) throw new Error(result.error)
        recruiters = result.recruiters
        cached = result.fromCache ?? false
      }

      setFromCache(cached)
      setSearchResults(recruiters)
      if (!company) setCompany(companyGuess)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  function toggleSelect(i) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function handleSaveSelected() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      for (const i of selected) {
        const r = searchResults[i]
        const linkedin = r.linkedin
          ? (r.linkedin.startsWith('http') ? r.linkedin : `https://${r.linkedin}`)
          : ''
        const comp = company || domain
        const rl = role || ''
        await addDoc(collection(db, 'users', userId, 'outreach'), {
          company: comp,
          role: rl,
          jobId: jobLinkMode === 'board' ? (selectedJobId || null) : null,
          jobUrl: linkedJob?.jobUrl ?? null,
          recruiterName: r.name,
          recruiterEmail: r.email,
          recruiterTitle: r.title ?? '',
          recruiterLinkedIn: linkedin,
          emailSubject: buildEmailSubject(rl, comp),
          emailBody: buildEmailBody(r.name, comp, rl),
          linkedInMessage: buildLinkedInMessage(r.name, comp, rl),
          followUpSubject: buildFollowUpSubject(rl, comp),
          followUpBody: buildFollowUpBody(r.name, comp, rl),
          emailSent: false,
          linkedInSent: false,
          followUpSent: false,
          createdAt: serverTimestamp(),
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveManual() {
    if (!manual.name.trim()) return
    setSaving(true)
    try {
      const comp = linkedJob?.company || manual.company || company
      const rl = linkedJob?.role || manual.role || role
      await addDoc(collection(db, 'users', userId, 'outreach'), {
        company: comp,
        role: rl,
        jobId: jobLinkMode === 'board' ? (selectedJobId || null) : null,
        jobUrl: linkedJob?.jobUrl ?? null,
        recruiterName: manual.name,
        recruiterEmail: manual.email,
        recruiterTitle: manual.title,
        recruiterLinkedIn: manual.linkedin,
        emailSubject: buildEmailSubject(rl, comp),
        emailBody: buildEmailBody(manual.name, comp, rl),
        linkedInMessage: buildLinkedInMessage(manual.name, comp, rl),
        followUpSubject: buildFollowUpSubject(rl, comp),
        followUpBody: buildFollowUpBody(manual.name, comp, rl),
        emailSent: false,
        linkedInSent: false,
        followUpSent: false,
        createdAt: serverTimestamp(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="outreach-add-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="outreach-add-modal">
        <div className="outreach-add-modal-header">
          <h2 className="text-sm font-semibold text-white">Add Recruiter</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg">
              <button
                onClick={() => setStep('search')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${step === 'search' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Find via Hunter
              </button>
              <button
                onClick={() => setStep('manual')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${step === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Add manually
              </button>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="outreach-add-modal-body">
          {/* Job link — shared across both modes */}
          <div>
            <label className="outreach-form-label">Link to a job posting</label>
            <div className="flex items-center gap-1.5 p-0.5 bg-slate-800 rounded-lg mb-2">
              <button
                onClick={() => handleJobLinkModeChange('none')}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${jobLinkMode === 'none' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                None
              </button>
              {jobs.length > 0 && (
                <button
                  onClick={() => handleJobLinkModeChange('board')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${jobLinkMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  From board
                </button>
              )}
              <button
                onClick={() => handleJobLinkModeChange('url')}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${jobLinkMode === 'url' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Paste URL
              </button>
            </div>

            {jobLinkMode === 'board' && (
              <select
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
                className="outreach-form-input"
              >
                <option value="">— Pick a job —</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.company}{j.role ? ` · ${j.role}` : ''}
                  </option>
                ))}
              </select>
            )}

            {jobLinkMode === 'url' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={jobPostingUrl}
                    onChange={e => { setJobPostingUrl(e.target.value); setFetchedJob(null); setFetchJobError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleFetchJobUrl()}
                    placeholder="https://stripe.com/jobs/..."
                    className="outreach-form-input flex-1"
                  />
                  <button
                    onClick={handleFetchJobUrl}
                    disabled={fetchingJob || !jobPostingUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    {fetchingJob ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    {fetchingJob ? 'Fetching…' : 'Fetch'}
                  </button>
                </div>
                {fetchJobError && <p className="text-xs text-red-400">{fetchJobError}</p>}
                {fetchedJob && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{fetchedJob.role}</p>
                      {fetchedJob.company && <p className="text-[11px] text-slate-400">{fetchedJob.company}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {step === 'search' ? (
            <>
              {/* Company + Role — hidden when a job is linked */}
              {!linkedJob && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="outreach-form-label">Company</label>
                    <input
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="e.g. Stripe"
                      className="outreach-form-input"
                    />
                  </div>
                  <div>
                    <label className="outreach-form-label">Role (optional)</label>
                    <input
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      placeholder="e.g. Staff Engineer"
                      className="outreach-form-input"
                    />
                  </div>
                </div>
              )}

              {/* Domain search */}
              <div>
                <label className="outreach-form-label">Company domain</label>
                <div className="flex gap-2">
                  <input
                    value={domain}
                    onChange={e => { setDomain(e.target.value); setSearchResults(null); setSearchError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. stripe.com"
                    className="outreach-form-input flex-1"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !domain.trim()}
                    className={`flex items-center gap-1.5 px-3 py-2 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0 ${domainCached ? 'bg-green-700 hover:bg-green-600' : 'bg-violet-600 hover:bg-violet-500'}`}
                  >
                    {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    {searching ? 'Loading…' : domainCached ? 'Use saved results' : 'Search Hunter'}
                  </button>
                </div>
              </div>

              {searchError && <p className="text-xs text-red-400">{searchError}</p>}

              {searchResults !== null && searchResults.length === 0 && (
                <p className="text-xs text-slate-400">
                  No recruiters found. Try{' '}
                  <button onClick={() => setStep('manual')} className="text-violet-400 hover:underline">
                    adding manually
                  </button>
                  .
                </p>
              )}

              {searchResults?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      {searchResults.length} recruiter{searchResults.length !== 1 ? 's' : ''} found
                      {fromCache && <span className="ml-2 text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">cached</span>}
                    </p>
                    {selected.size > 0 && <p className="text-xs text-violet-400">{selected.size} selected</p>}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((r, i) => {
                      const alreadyContacted = contactedEmails.has(r.email)
                      const isSelected = selected.has(i)
                      return (
                        <div
                          key={i}
                          onClick={() => !alreadyContacted && toggleSelect(i)}
                          className={`outreach-recruiter-row ${
                            alreadyContacted ? 'outreach-recruiter-row--contacted' :
                            isSelected ? 'outreach-recruiter-row--selected' :
                            'outreach-recruiter-row--unselected'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {!alreadyContacted && (
                              <div className={`w-3.5 h-3.5 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-600 border-violet-500' : 'border-slate-600'}`}>
                                {isSelected && <CheckCircle2 size={9} className="text-white" />}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-medium text-white">{r.name}</p>
                                {alreadyContacted && (
                                  <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1 py-0.5 rounded-full">Already tracked</span>
                                )}
                              </div>
                              {r.title && <p className="text-[11px] text-slate-400">{r.title}</p>}
                              <p className="text-[11px] text-violet-400">{r.email}</p>
                              <p className="text-[10px] text-slate-500">{r.confidence}% confidence</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {selected.size > 0 && (
                    <button
                      onClick={handleSaveSelected}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {saving ? 'Saving…' : `Add ${selected.size} recruiter${selected.size > 1 ? 's' : ''} to tracker`}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {!selectedJob && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="outreach-form-label">Company *</label>
                    <input value={manual.company} onChange={e => setManual(m => ({ ...m, company: e.target.value }))} placeholder="Stripe" className="outreach-form-input" />
                  </div>
                  <div>
                    <label className="outreach-form-label">Role</label>
                    <input value={manual.role} onChange={e => setManual(m => ({ ...m, role: e.target.value }))} placeholder="Staff Engineer" className="outreach-form-input" />
                  </div>
                </div>
              )}
              <div>
                <label className="outreach-form-label">Recruiter name *</label>
                <input value={manual.name} onChange={e => setManual(m => ({ ...m, name: e.target.value }))} placeholder="Jane Smith" className="outreach-form-input" />
              </div>
              <div>
                <label className="outreach-form-label">Title</label>
                <input value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} placeholder="Senior Technical Recruiter" className="outreach-form-input" />
              </div>
              <div>
                <label className="outreach-form-label">Email</label>
                <input type="email" value={manual.email} onChange={e => setManual(m => ({ ...m, email: e.target.value }))} placeholder="jane@stripe.com" className="outreach-form-input" />
              </div>
              <div>
                <label className="outreach-form-label">LinkedIn URL</label>
                <input value={manual.linkedin} onChange={e => setManual(m => ({ ...m, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." className="outreach-form-input" />
              </div>
              <button
                onClick={handleSaveManual}
                disabled={saving || !manual.name.trim() || (!linkedJob && !manual.company.trim())}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {saving ? 'Saving…' : 'Add to tracker'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
