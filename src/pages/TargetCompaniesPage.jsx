import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  Target, Plus, Trash2, ExternalLink, Search, Loader2, Sparkles,
  X, CheckCircle2, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import app from '../lib/firebase'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/ui/Pagination'
import './TargetCompaniesPage.css'

const functions = getFunctions(app)

const SEED_COMPANIES = [
  { name: 'Linear', domain: 'linear.app', space: 'Engineering productivity', stage: 'Startup / growth', notes: 'Engineering workflow product; strong fit with MCP tooling and reducing engineering friction.', targetRoles: 'Backend Engineer, Product Engineer, Platform Engineer', careersUrl: 'https://linear.app/careers', searchQuery: 'Search Linear recruiting/talent' },
  { name: 'Tailscale', domain: 'tailscale.com', space: 'Networking / security infrastructure', stage: 'Mid-size / growth', notes: 'Secure distributed systems, identity/networking workflows, reliability, and infra ownership.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Security Platform', careersUrl: 'https://tailscale.com/careers', searchQuery: 'Search Tailscale recruiter engineering' },
  { name: 'Chainguard', domain: 'chainguard.dev', space: 'Software supply chain security', stage: 'Mid-size / growth', notes: 'Security infrastructure; CloudTrail/auditability and secure AWS background map well.', targetRoles: 'Backend Engineer, Security Platform, Infrastructure Engineer', careersUrl: 'https://www.chainguard.dev/careers', searchQuery: 'Search Chainguard recruiter talent' },
  { name: 'Semgrep', domain: 'semgrep.dev', space: 'Application security', stage: 'Mid-size / growth', notes: 'Security developer tooling, correctness, code analysis, and workflow automation.', targetRoles: 'Backend Engineer, Platform Engineer, Security Engineer', careersUrl: 'https://semgrep.dev/careers', searchQuery: 'Search Semgrep recruiter' },
  { name: 'Wiz', domain: 'wiz.io', space: 'Cloud security', stage: 'Large startup / growth', notes: 'Cloud security and auditability fit AWS CloudTrail, security data, and customer trust.', targetRoles: 'Backend Engineer, Cloud Security, Platform Engineer', careersUrl: 'https://www.wiz.io/careers', searchQuery: 'Search Wiz recruiter engineering' },
  { name: 'Vanta', domain: 'vanta.com', space: 'Compliance automation', stage: 'Mid-size / growth', notes: 'Compliance/audit workflows fit CloudTrail and trustworthy event-data background.', targetRoles: 'Backend Engineer, Platform Engineer, Infrastructure', careersUrl: 'https://www.vanta.com/careers', searchQuery: 'Search Vanta recruiter' },
  { name: 'Drata', domain: 'drata.com', space: 'Compliance automation', stage: 'Mid-size / growth', notes: 'Security/compliance automation needs correct integrations, audit trails, and workflow systems.', targetRoles: 'Backend Engineer, Platform Engineer, Integrations', careersUrl: 'https://drata.com/careers', searchQuery: 'Search Drata talent acquisition' },
  { name: 'Fieldguide', domain: 'fieldguide.io', space: 'Audit / assurance software', stage: 'Startup / growth', notes: 'Auditability, operational data, workflow automation, and AI tooling.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Platform Engineer', careersUrl: 'https://www.fieldguide.io/careers', searchQuery: 'Search Fieldguide recruiter' },
  { name: 'Mercury', domain: 'mercury.com', space: 'Fintech / banking', stage: 'Mid-size / growth', notes: 'Fintech backend needs correctness, reliability, audit trails, compliance, and platform systems.', targetRoles: 'Backend Engineer, Platform Engineer, Infrastructure Engineer', careersUrl: 'https://mercury.com/jobs', searchQuery: 'Search Mercury recruiter engineering' },
  { name: 'Ramp', domain: 'ramp.com', space: 'Fintech / spend management', stage: 'Large startup / growth', notes: 'High-scale financial workflows, correctness, operational reliability, and backend systems.', targetRoles: 'Backend Engineer, Platform Engineer, Infrastructure', careersUrl: 'https://ramp.com/careers', searchQuery: 'Search Ramp technical recruiter' },
  { name: 'Brex', domain: 'brex.com', space: 'Fintech', stage: 'Mid-size / scale', notes: 'Fintech platform reliability and scalable backend systems fit AWS distributed systems.', targetRoles: 'Backend Engineer, Platform Engineer, Infrastructure', careersUrl: 'https://www.brex.com/careers', searchQuery: 'Search Brex recruiter engineering' },
  { name: 'Lithic', domain: 'lithic.com', space: 'Card issuing infrastructure', stage: 'Startup / growth', notes: 'Payments infrastructure needs reliable APIs, correctness, observability, and backend ownership.', targetRoles: 'Backend Engineer, Platform Engineer, API Engineer', careersUrl: 'https://lithic.com/careers', searchQuery: 'Search Lithic recruiter' },
  { name: 'Modern Treasury', domain: 'moderntreasury.com', space: 'Payments operations', stage: 'Mid-size / growth', notes: 'Money movement workflows, reconciliation, correctness, and auditability.', targetRoles: 'Backend Engineer, Platform Engineer, Payments Infrastructure', careersUrl: 'https://www.moderntreasury.com/careers', searchQuery: 'Search Modern Treasury recruiter' },
  { name: 'Persona', domain: 'withpersona.com', space: 'Identity verification', stage: 'Mid-size / growth', notes: 'Identity workflows, fraud/security, auditability, integrations, and backend reliability.', targetRoles: 'Backend Engineer, Platform Engineer, Infrastructure', careersUrl: 'https://withpersona.com/careers', searchQuery: 'Search Persona recruiter' },
  { name: 'Pylon', domain: 'usepylon.com', space: 'B2B support platform', stage: 'Startup / growth', notes: 'Workflow/integration-heavy product; Amazon Connect and customer support automation story fit.', targetRoles: 'Backend Engineer, Integrations Engineer, API Engineer', careersUrl: 'https://www.usepylon.com/careers', searchQuery: 'Wellfound shows active backend roles; search Pylon recruiter' },
  { name: 'Census', domain: 'getcensus.com', space: 'Data activation / reverse ETL', stage: 'Mid-size / growth', notes: 'Data pipelines, integrations, event correctness, and customer-facing backend systems.', targetRoles: 'Backend Engineer, Data Platform, Integrations', careersUrl: 'https://www.getcensus.com/careers', searchQuery: 'Search Census recruiter talent' },
  { name: 'Hightouch', domain: 'hightouch.com', space: 'Data activation', stage: 'Mid-size / growth', notes: 'High-volume data workflows, integrations, reliability, and product engineering.', targetRoles: 'Backend Engineer, Data Platform, Infrastructure', careersUrl: 'https://hightouch.com/careers', searchQuery: 'Search Hightouch recruiter' },
  { name: 'MotherDuck', domain: 'motherduck.com', space: 'Cloud data platform', stage: 'Startup / growth', notes: 'Data infrastructure, query systems, distributed platform reliability, and Athena optimization story.', targetRoles: 'Backend Engineer, Data Platform, Infrastructure', careersUrl: 'https://motherduck.com/careers', searchQuery: 'Search MotherDuck recruiter' },
  { name: 'Neon', domain: 'neon.tech', space: 'Serverless Postgres', stage: 'Startup / growth', notes: 'Database/cloud infrastructure with reliability, scaling, platform, and backend ownership.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Database Platform', careersUrl: 'https://neon.tech/careers', searchQuery: 'Search Neon recruiter engineering' },
  { name: 'ClickHouse', domain: 'clickhouse.com', space: 'Analytics database', stage: 'Mid-size / growth', notes: 'High-performance analytics, distributed systems, query performance, and event data.', targetRoles: 'Backend Engineer, Cloud Infrastructure, Database Engineer', careersUrl: 'https://clickhouse.com/company/careers', searchQuery: 'Search ClickHouse recruiter' },
  { name: 'SingleStore', domain: 'singlestore.com', space: 'Distributed database', stage: 'Mid-size / growth', notes: 'Distributed database infrastructure maps to event processing, query optimization, and backend reliability.', targetRoles: 'Backend Engineer, Distributed Systems, Cloud Infrastructure', careersUrl: 'https://www.singlestore.com/careers/', searchQuery: 'Search SingleStore recruiter' },
  { name: 'Confluent', domain: 'confluent.io', space: 'Streaming data platform', stage: 'Public / mid-large', notes: 'Kafka/event streaming aligns directly with event-driven systems and high-volume operational data.', targetRoles: 'Backend Engineer, Platform Engineer, Streaming Infrastructure', careersUrl: 'https://www.confluent.io/careers/', searchQuery: 'Search Confluent technical recruiter' },
  { name: 'Redpanda', domain: 'redpanda.com', space: 'Streaming data infrastructure', stage: 'Startup / growth', notes: 'Event streaming, distributed systems, performance, and platform reliability.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Distributed Systems', careersUrl: 'https://redpanda.com/careers', searchQuery: 'Search Redpanda recruiter' },
  { name: 'Warp', domain: 'warp.dev', space: 'AI developer tooling', stage: 'Startup / growth', notes: 'Developer tooling + AI workflows fit MCP tooling and platform productivity story.', targetRoles: 'Backend Engineer, Platform Engineer, AI Tooling', careersUrl: 'https://www.warp.dev/careers', searchQuery: 'Search Warp recruiter' },
  { name: 'Replit', domain: 'replit.com', space: 'AI developer platform', stage: 'Mid-size / growth', notes: 'Cloud dev environment and AI agent workflows align with backend platform and developer productivity.', targetRoles: 'Backend Engineer, Infrastructure Engineer, AI Platform', careersUrl: 'https://replit.com/careers', searchQuery: 'Search Replit recruiter' },
  { name: 'Modal', domain: 'modal.com', space: 'AI compute / serverless', stage: 'Startup / growth', notes: 'AI infrastructure, serverless workloads, distributed compute, and platform reliability.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Platform Engineer', careersUrl: 'https://modal.com/careers', searchQuery: 'Search Modal recruiter or talent' },
  { name: 'Baseten', domain: 'baseten.co', space: 'AI inference infrastructure', stage: 'Startup / growth', notes: 'Model serving and AI infrastructure require backend reliability, observability, and scaling.', targetRoles: 'Backend Engineer, AI Infrastructure, Platform Engineer', careersUrl: 'https://www.baseten.co/careers/', searchQuery: 'Search Baseten recruiter' },
  { name: 'Together AI', domain: 'together.ai', space: 'AI cloud / inference', stage: 'Startup / growth', notes: 'AI cloud infrastructure, high-throughput services, observability, and platform scaling.', targetRoles: 'Backend Engineer, Infrastructure Engineer, AI Platform', careersUrl: 'https://www.together.ai/careers', searchQuery: 'Search Together AI recruiter' },
  { name: 'Fireworks AI', domain: 'fireworks.ai', space: 'AI inference platform', stage: 'Startup / growth', notes: 'Inference reliability, model serving, event/data pipelines, and backend systems.', targetRoles: 'Backend Engineer, AI Infrastructure, Platform Engineer', careersUrl: 'https://fireworks.ai/careers', searchQuery: 'Search Fireworks AI recruiter' },
  { name: 'Runpod', domain: 'runpod.io', space: 'GPU cloud', stage: 'Startup / growth', notes: 'GPU cloud infrastructure needs backend scalability, scheduling, observability, and operations.', targetRoles: 'Backend Engineer, Infrastructure Engineer, Cloud Platform', careersUrl: 'https://www.runpod.io/careers', searchQuery: 'Search Runpod recruiter' },
  { name: 'CoreWeave', domain: 'coreweave.com', space: 'AI cloud infrastructure', stage: 'Large startup / growth', notes: 'Cloud/GPU infrastructure maps strongly to AWS, Kubernetes, reliability, and platform operations.', targetRoles: 'Backend Engineer, Cloud Infrastructure, Platform Engineer', careersUrl: 'https://www.coreweave.com/careers', searchQuery: 'Search CoreWeave recruiter' },
  { name: 'Crusoe', domain: 'crusoe.ai', space: 'AI cloud infrastructure', stage: 'Mid-size / growth', notes: 'Cloud infrastructure, managed services, storage, and platform engineering align with target roles.', targetRoles: 'Backend Engineer, Managed Services, Cloud Management', careersUrl: 'https://crusoe.ai/careers', searchQuery: 'Search Crusoe recruiter' },
  { name: 'Lambda', domain: 'lambdalabs.com', space: 'GPU cloud', stage: 'Mid-size / growth', notes: 'AI cloud infrastructure with backend/platform, scheduling, observability, and reliability.', targetRoles: 'Backend Engineer, Cloud Infrastructure, Platform Engineer', careersUrl: 'https://lambdalabs.com/careers', searchQuery: 'Search Lambda recruiter engineering' },
  { name: 'Lightning AI', domain: 'lightning.ai', space: 'AI developer platform', stage: 'Startup / growth', notes: 'Wellfound shows backend roles; maps to MCP tooling, platform reliability, and cloud systems.', targetRoles: 'Backend Engineer, Platform Engineer, AI Infrastructure', careersUrl: 'https://lightning.ai/careers', searchQuery: 'Search Lightning AI recruiter' },
]

// Lower number = higher up in the list.
// Not-yet-searched companies come first so they get attention.
// Fully contacted companies sink to the bottom.
const TARGET_PRIORITY = { new: 0, retrieved: 1, tracked: 2, emailed: 3, contacted: 4 }

export default function TargetCompaniesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [cachedDomains, setCachedDomains] = useState(new Set())
  const [outreachByCompany, setOutreachByCompany] = useState(new Map())
  const [prompt, setPrompt] = useState('')
  const [processing, setProcessing] = useState(false)
  const [promptResult, setPromptResult] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState(new Set())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Load companies from Firestore
  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'users', user.uid, 'targetCompanies'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, async snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCompanies(docs)
      setLoading(false)

      // Auto-seed if collection is empty
      if (docs.length === 0 && !seeding) {
        setSeeding(true)
        const batch = writeBatch(db)
        for (const c of SEED_COMPANIES) {
          const ref = doc(collection(db, 'users', user.uid, 'targetCompanies'))
          batch.set(ref, { ...c, createdAt: serverTimestamp() })
        }
        await batch.commit()
        setSeeding(false)
      }
    })
  }, [user?.uid])

  // Live-sync cache + outreach so status badges update without a page refresh
  useEffect(() => {
    if (!user?.uid) return
    const unsubCache = onSnapshot(collection(db, 'users', user.uid, 'recruiterCache'), snap => {
      setCachedDomains(new Set(snap.docs.map(d => d.id)))
    })
    const unsubOutreach = onSnapshot(collection(db, 'users', user.uid, 'outreach'), snap => {
      const map = new Map()
      for (const d of snap.docs) {
        const { company, emailSent, linkedInSent } = d.data()
        const key = company?.toLowerCase()
        if (!key) continue
        if (!map.has(key)) map.set(key, [])
        map.get(key).push({ emailSent, linkedInSent })
      }
      setOutreachByCompany(map)
    })
    return () => { unsubCache(); unsubOutreach() }
  }, [user?.uid])

  function getStatus(company) {
    const name = company.name?.toLowerCase()
    const records = outreachByCompany.get(name) ?? []
    if (records.some(r => r.emailSent && r.linkedInSent)) return 'contacted'
    if (records.some(r => r.emailSent)) return 'emailed'
    if (records.length > 0) return 'tracked'
    if (cachedDomains.has(company.domain)) return 'retrieved'
    return 'new'
  }

  const STATUS_FILTERS = [
    { key: 'all', label: 'All', count: companies.length },
    { key: 'new', label: 'Not searched', count: companies.filter(c => getStatus(c) === 'new').length },
    { key: 'retrieved', label: 'Retrieved', count: companies.filter(c => getStatus(c) === 'retrieved').length },
    { key: 'tracked', label: 'Tracked', count: companies.filter(c => getStatus(c) === 'tracked').length },
    { key: 'emailed', label: 'Emailed', count: companies.filter(c => getStatus(c) === 'emailed').length },
    { key: 'contacted', label: 'Contacted', count: companies.filter(c => getStatus(c) === 'contacted').length },
  ]

  const displayed = companies.filter(c => {
    if (filter !== 'all' && getStatus(c) !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q)
        || c.space?.toLowerCase().includes(q)
        || c.targetRoles?.toLowerCase().includes(q)
        || c.notes?.toLowerCase().includes(q)
    }
    return true
  })

  // Sort: companies needing action first, fully contacted companies last
  const sorted = [...displayed].sort((a, b) => TARGET_PRIORITY[getStatus(a)] - TARGET_PRIORITY[getStatus(b)])

  const PAGE_SIZE = 10
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(sorted, PAGE_SIZE)

  // Jump back to page 1 whenever the user changes filter or search
  useEffect(() => { goToPage(1) }, [filter, search])

  async function handlePrompt() {
    if (!prompt.trim()) return
    setProcessing(true)
    setPromptResult(null)
    try {
      const fn = httpsCallable(functions, 'processCompanyPrompt')
      const result = await fn({ instruction: prompt.trim(), companyNames: companies.map(c => c.name) })
      const op = result.data
      if (op.op === 'add' && op.company) {
        await addDoc(collection(db, 'users', user.uid, 'targetCompanies'), {
          ...op.company, createdAt: serverTimestamp(),
        })
        setPromptResult({ type: 'success', msg: `Added ${op.company.name}` })
      } else if (op.op === 'remove' && op.name) {
        const match = companies.find(c => c.name.toLowerCase() === op.name.toLowerCase())
        if (match) {
          await deleteDoc(doc(db, 'users', user.uid, 'targetCompanies', match.id))
          setPromptResult({ type: 'success', msg: `Removed ${op.name}` })
        } else {
          setPromptResult({ type: 'error', msg: `Company "${op.name}" not found` })
        }
      } else if (op.op === 'update' && op.name) {
        const match = companies.find(c => c.name.toLowerCase() === op.name.toLowerCase())
        if (match) {
          await updateDoc(doc(db, 'users', user.uid, 'targetCompanies', match.id), op.updates ?? {})
          setPromptResult({ type: 'success', msg: `Updated ${op.name}` })
        } else {
          setPromptResult({ type: 'error', msg: `Company "${op.name}" not found` })
        }
      } else {
        setPromptResult({ type: 'error', msg: op.message ?? 'Could not process instruction' })
      }
      setPrompt('')
    } catch (err) {
      setPromptResult({ type: 'error', msg: err.message })
    } finally {
      setProcessing(false)
    }
  }

  function handleFindRecruiters(company) {
    navigate(`/outreach?domain=${encodeURIComponent(company.domain)}&company=${encodeURIComponent(company.name)}`)
  }

  async function handleDelete(company) {
    if (!confirm(`Remove ${company.name} from target list?`)) return
    await deleteDoc(doc(db, 'users', user.uid, 'targetCompanies', company.id))
  }

  function toggleNotes(id) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="targets-topnav">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="targets-header-icon">
              <Target size={15} className="text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Target Companies</h1>
              <p className="text-xs text-slate-400">
                {companies.length} companies · {STATUS_FILTERS.find(f => f.key === 'contacted')?.count ?? 0} contacted · {STATUS_FILTERS.find(f => f.key === 'tracked')?.count ?? 0} tracked
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Company
          </button>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 max-w-7xl mx-auto">

        {/* AI Prompt bar */}
        <div className="targets-prompt-bar">
          <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} className="text-sky-400" /> Update list with AI
          </p>
          <div className="flex gap-2">
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePrompt()}
              placeholder='e.g. "Add Notion to the list" · "Remove Warp" · "Update Linear notes to emphasize the AI angle"'
              className="targets-prompt-input flex-1"
            />
            <button
              onClick={handlePrompt}
              disabled={processing || !prompt.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              {processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {processing ? 'Processing…' : 'Update'}
            </button>
          </div>
          {promptResult && (
            <p className={`text-xs mt-2 ${promptResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {promptResult.type === 'success' ? '✓ ' : '✗ '}{promptResult.msg}
            </p>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === f.key
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-sky-600/30 text-sky-300' : 'bg-slate-800 text-slate-500'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48"
          />
        </div>

        {loading || seeding ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">{seeding ? 'Seeding companies…' : 'Loading…'}</span>
          </div>
        ) : (
          <div className="targets-table-wrap">
            <table className="targets-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Company</th>
                  <th style={{ width: '150px' }}>Space</th>
                  <th style={{ width: '130px' }}>Stage</th>
                  <th style={{ width: '220px' }}>Fit notes</th>
                  <th style={{ width: '200px' }}>Target roles</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map(company => {
                  const status = getStatus(company)
                  const notesExpanded = expandedNotes.has(company.id)
                  return (
                    <tr key={company.id}>
                      {/* Company */}
                      <td>
                        <button
                          onClick={() => handleFindRecruiters(company)}
                          className="font-semibold text-white text-xs hover:text-sky-400 transition-colors text-left"
                        >
                          {company.name}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <a
                            href={`https://${company.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-slate-500 hover:text-violet-400 transition-colors"
                          >
                            {company.domain}
                          </a>
                          {(outreachByCompany.get(company.name?.toLowerCase())?.length ?? 0) > 0 && (
                            <span className="text-[10px] text-violet-400">
                              · {outreachByCompany.get(company.name?.toLowerCase()).length} tracked
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Space */}
                      <td>
                        <p className="text-slate-300">{company.space}</p>
                      </td>
                      {/* Stage */}
                      <td>
                        <span className="targets-stage-badge">{company.stage}</span>
                      </td>
                      {/* Notes */}
                      <td>
                        <p className={`text-slate-400 leading-relaxed ${!notesExpanded ? 'line-clamp-2' : ''}`}>
                          {company.notes}
                        </p>
                        {company.notes?.length > 80 && (
                          <button
                            onClick={() => toggleNotes(company.id)}
                            className="text-[10px] text-slate-600 hover:text-slate-400 mt-0.5"
                          >
                            {notesExpanded ? '↑ less' : '↓ more'}
                          </button>
                        )}
                      </td>
                      {/* Roles */}
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(company.targetRoles || '').split(',').map((r, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-md whitespace-nowrap">
                              {r.trim()}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* Status */}
                      <td>
                        <span className={`targets-status-badge ${
                          status === 'contacted' ? 'targets-status-contacted' :
                          status === 'emailed'   ? 'targets-status-emailed' :
                          status === 'tracked'   ? 'targets-status-tracked' :
                          status === 'retrieved' ? 'targets-status-retrieved' :
                          'targets-status-new'
                        }`}>
                          {status === 'contacted' ? '✓ Contacted' :
                           status === 'emailed'   ? '✉ Emailed' :
                           status === 'tracked'   ? '◑ Tracked' :
                           status === 'retrieved' ? '⬤ Retrieved' :
                           '○ Not searched'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleFindRecruiters(company)}
                            className="targets-action-btn"
                          >
                            <Search size={9} /> Find Recruiters
                          </button>
                          {company.careersUrl && (
                            <a
                              href={company.careersUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <ExternalLink size={9} /> Careers
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(company)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={9} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                      No companies match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onGoToPage={goToPage}
          totalItems={sorted.length}
          pageSize={PAGE_SIZE}
        />
      </div>

      {addOpen && <AddCompanyModal userId={user.uid} onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function AddCompanyModal({ userId, onClose }) {
  const [form, setForm] = useState({ name: '', domain: '', space: '', stage: '', notes: '', targetRoles: '', careersUrl: '', searchQuery: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim() || !form.domain.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', userId, 'targetCompanies'), { ...form, createdAt: serverTimestamp() })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'name', label: 'Company name *', placeholder: 'Linear' },
    { key: 'domain', label: 'Domain *', placeholder: 'linear.app' },
    { key: 'space', label: 'Space / category', placeholder: 'Engineering productivity' },
    { key: 'stage', label: 'Stage', placeholder: 'Startup / growth' },
    { key: 'targetRoles', label: 'Target roles', placeholder: 'Backend Engineer, Platform Engineer' },
    { key: 'careersUrl', label: 'Careers URL', placeholder: 'https://linear.app/careers' },
    { key: 'searchQuery', label: 'Recruiter search hint', placeholder: 'Search Linear recruiting/talent' },
  ]

  return (
    <div className="targets-add-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="targets-add-modal">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Add Target Company</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="targets-form-label">{f.label}</label>
              <input
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="targets-form-input"
              />
            </div>
          ))}
          <div>
            <label className="targets-form-label">Fit notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Why this company is a strong fit…"
              rows={3}
              className="targets-form-input resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.domain.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {saving ? 'Saving…' : 'Add company'}
          </button>
        </div>
      </div>
    </div>
  )
}
