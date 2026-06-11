import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, MapPin, Loader2, ExternalLink, CheckCircle2,
  Briefcase, ChevronLeft, ChevronRight, SlidersHorizontal, Globe, X,
} from 'lucide-react'
import { useAuth } from '../context/auth'
import { useAI } from '../hooks/useAI'
import { useJobMutations } from '../hooks/useJobMutations'

const WORK_TYPES = ['Remote', 'Hybrid', 'On-Site']
const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Part-time']
const POSTED_OPTIONS = [
  { label: 'Last 24 hours', value: 'ONE' },
  { label: 'Last 3 days', value: 'THREE' },
  { label: 'Last 7 days', value: 'SEVEN' },
]
const COUNTRIES = [
  { label: 'United States', value: 'us' },
  { label: 'Canada', value: 'ca' },
]

const CITY_SUGGESTIONS = [
  // US cities
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle',
  'Denver', 'Washington', 'Nashville', 'Oklahoma City', 'El Paso', 'Boston',
  'Portland', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee',
  'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Mesa', 'Kansas City',
  'Atlanta', 'Omaha', 'Colorado Springs', 'Raleigh', 'Long Beach', 'Virginia Beach',
  'Minneapolis', 'Tampa', 'New Orleans', 'Arlington', 'Bakersfield', 'Honolulu',
  'Anaheim', 'Santa Ana', 'Corpus Christi', 'Riverside', 'Lexington', 'St. Louis',
  'Pittsburgh', 'Stockton', 'Cincinnati', 'St. Paul', 'Greensboro', 'Toledo',
  'Newark', 'Plano', 'Henderson', 'Orlando', 'St. Petersburg', 'Chandler',
  'Norfolk', 'Madison', 'Durham', 'Lubbock', 'Winston-Salem', 'Garland',
  'Glendale', 'Hialeah', 'Reno', 'Baton Rouge', 'Irvine', 'Chesapeake',
  'Irving', 'Scottsdale', 'Fremont', 'Gilbert', 'Birmingham', 'Rochester',
  'Richmond', 'Spokane', 'Des Moines', 'Montgomery', 'Modesto', 'Fayetteville',
  'Tacoma', 'Akron', 'Yonkers', 'Oxnard', 'Aurora', 'Remote',
  // Canadian cities
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton', 'Ottawa',
  'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener',
]
const TECH_ROLES = [
  'Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer',
  'Data Engineer', 'ML Engineer', 'DevOps Engineer', 'Data Scientist',
  'Mobile Engineer', 'Security Engineer', 'Product Manager', 'QA Engineer',
]

function relativeDate(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just posted'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 day ago' : `${d} days ago`
}

function CityTagInput({ selected, onAdd, onRemove }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef(null)

  const available = CITY_SUGGESTIONS.filter(c => !selected.includes(c))
  const filtered = input.trim().length >= 1
    ? available.filter(c => c.toLowerCase().startsWith(input.toLowerCase())).slice(0, 6)
    : available.slice(0, 6)

  function select(city) {
    onAdd(city)
    setInput('')
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true); setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0) select(filtered[activeIndex])
      else if (input.trim()) select(input.trim())
    } else if (e.key === 'Escape') {
      setOpen(false); setActiveIndex(-1)
    } else if (e.key === 'Backspace' && !input && selected.length > 0) {
      onRemove(selected[selected.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-600 rounded-lg min-h-[38px] focus-within:border-blue-500 transition-colors cursor-text">
        <MapPin size={13} className="text-zinc-500 flex-shrink-0" />
        {selected.map(city => (
          <span key={city} className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 border border-blue-500/40 rounded-full text-xs text-blue-300 font-medium">
            {city}
            <button onMouseDown={e => { e.preventDefault(); onRemove(city) }} className="hover:text-white transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); setActiveIndex(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setActiveIndex(-1) }, 150)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length > 0 ? 'Add location…' : 'Locations'}
          autoComplete="off"
          className="flex-1 min-w-[90px] bg-transparent text-sm text-white placeholder-zinc-500 outline-none py-0.5"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl overflow-hidden">
          {input.trim().length === 0 && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Popular cities</p>
          )}
          {filtered.map((city, i) => (
            <button
              key={city}
              onMouseDown={() => select(city)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                i === activeIndex ? 'bg-blue-600 text-white' : 'text-zinc-200 hover:bg-zinc-700/70'
              }`}
            >
              <MapPin size={11} className={i === activeIndex ? 'text-blue-200' : 'text-zinc-500'} />
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleChips({ options, selected, onChange }) {
  return (
    <>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(
            selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
          )}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(opt)
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
          }`}
        >
          {opt}
        </button>
      ))}
    </>
  )
}

function CompanyAvatar({ name, logoUrl, size = 40 }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initial = (name || '?')[0].toUpperCase()
  const colors = [
    ['#FEE4E2', '#B42318'], ['#FEF3C7', '#92400E'], ['#D1FAE5', '#065F46'],
    ['#DBEAFE', '#1E40AF'], ['#EDE9FE', '#5B21B6'], ['#FCE7F3', '#831843'],
    ['#CCFBF1', '#134E4A'], ['#E0F2FE', '#0369A1'],
  ]
  const [bg, fg] = colors[initial.charCodeAt(0) % colors.length]

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl} alt={name} width={size} height={size}
        className="rounded-lg object-contain flex-shrink-0"
        style={{ width: size, height: size, border: '1px solid rgba(255,255,255,0.1)' }}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      {initial}
    </div>
  )
}

function Badge({ children, variant = 'default' }) {
  const styles = {
    default: 'bg-zinc-700 text-zinc-300 border-zinc-600',
    green: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
    blue: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
    blue: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${styles[variant]}`}>
      {children}
    </span>
  )
}

function JobCard({ job, onAdd, added, adding }) {
  const navigate = useNavigate()

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3 hover:border-zinc-600 transition-colors">
      {/* Header: logo + company + badges */}
      <div className="flex items-start gap-3">
        <CompanyAvatar name={job.company} logoUrl={job.companyLogoUrl} size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{job.title}</h3>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{job.company}</p>
        </div>
        <a
          href={job.jobUrl} target="_blank" rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 mt-0.5"
          title="Open job posting"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1">
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {job.salary && job.salary !== 'Depends on Experience' && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
            <span>💰</span>
            <span>{job.salary}</span>
          </div>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {(job.isRemote || job.workplaceTypes?.includes('Remote')) && <Badge variant="green">Remote</Badge>}
        {job.workplaceTypes?.includes('Hybrid') && <Badge variant="default">Hybrid</Badge>}
        {job.employmentType && <Badge variant="default">{job.employmentType}</Badge>}
        {job.willingToSponsor && <Badge variant="blue">Sponsors visa</Badge>}
        {job.easyApply && <Badge variant="blue">Easy apply</Badge>}
      </div>

      {/* Summary */}
      {job.summary && (
        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{job.summary}</p>
      )}

      {/* Footer: date + action */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span className="text-xs text-zinc-500">{relativeDate(job.postedDate)}</span>
        {added ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle2 size={13} /> Added
          </span>
        ) : (
          <button
            onClick={() => onAdd(job)}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : null}
            {adding ? 'Adding…' : 'Add to Runway'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const { searchJobs } = useAI()
  const { addJob } = useJobMutations()

  const [keyword, setKeyword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState(['Software Engineer'])
  const [selectedCities, setSelectedCities] = useState([])
  const [country, setCountry] = useState('us')
  const [selectedWorkTypes, setSelectedWorkTypes] = useState([])
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState([])
  const [sponsorOnly, setSponsorOnly] = useState(false)
  const [postedDate, setPostedDate] = useState('SEVEN')
  const [page, setPage] = useState(1)

  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [addedIds, setAddedIds] = useState(new Set())
  const [hasSearched, setHasSearched] = useState(false)

  const doSearch = useCallback(async (pg = 1) => {
    const roles = selectedRoles.length > 0 ? selectedRoles.slice(0, 3) : (keyword.trim() ? [keyword.trim()] : [])
    if (roles.length === 0) return
    setLoading(true)
    setError('')
    setJobs([])
    setPage(pg)
    try {
      const city = selectedCities.length > 0 ? selectedCities[0] : undefined
      const workplaceTypes = selectedWorkTypes.length > 0 ? selectedWorkTypes : undefined
      const employmentTypes = selectedEmploymentTypes.length > 0 ? selectedEmploymentTypes : undefined

      // Sequential calls to avoid rate limiting — one per role
      const results = []
      for (const role of roles) {
        const data = await searchJobs({ keyword: role, city, country, workplaceTypes, employmentTypes, willingToSponsor: sponsorOnly || undefined, postedDate, page: pg })
        results.push(data)
      }

      const successful = results.filter(d => !d?.error)
      if (successful.length === 0) {
        const isRateLimited = results.some(d => d?.error === 'RATE_LIMITED')
        throw new Error(isRateLimited
          ? 'Monthly job search quota exceeded. Upgrade your JSearch plan at rapidapi.com to continue searching.'
          : 'Search failed. Check your internet connection and try again.'
        )
      }

      // Merge and deduplicate
      const seen = new Set()
      const merged = []
      for (const data of successful) {
        for (const job of (data?.jobs || [])) {
          if (job.id && !seen.has(job.id)) { seen.add(job.id); merged.push(job) }
        }
      }

      const pageJobs = merged.slice(0, 9)
      setJobs(pageJobs)
      if (pg === 1) {
        const maxPageCount = Math.max(...successful.map(d => d.pageCount || 1))
        setTotal(merged.length > 0 ? maxPageCount * 9 : 0)
        setPageCount(maxPageCount)
      }
      if (pageJobs.length < 9) setPageCount(pg)
      setHasSearched(true)
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.')
      setJobs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [keyword, selectedRoles, selectedCities, country, selectedWorkTypes, selectedEmploymentTypes, sponsorOnly, postedDate, searchJobs])

  // Auto-search on mount
  useEffect(() => {
    doSearch(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(job) {
    setAddingId(job.id)
    try {
      await addJob({
        role: job.title,
        company: job.company,
        jobUrl: job.jobUrl,
        location: job.location,
        logoUrl: job.companyLogoUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(job.jobUrl)}&sz=64`,
        stage: 'saved',
      })
      setAddedIds(prev => new Set([...prev, job.id]))
    } catch {
      // silently ignore — the board will show the job regardless
    } finally {
      setAddingId(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (selectedRoles.length > 0 || keyword.trim())) doSearch(1)
  }

  function toggleRole(role) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase size={18} className="text-blue-400" />
          <h1 className="text-lg font-semibold text-white">Discover Jobs</h1>
        </div>
        <p className="text-xs text-zinc-400">
          Search thousands of fresh listings from LinkedIn, Indeed, and Glassdoor — add any job directly to your pipeline.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 mb-5">
        {/* Roles — multi-select */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Roles</p>
          <div className="flex flex-wrap gap-1.5">
            {TECH_ROLES.map(role => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedRoles.includes(role)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Custom keyword + location + country + search */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Custom keyword (optional)"
              className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <CityTagInput
            selected={selectedCities}
            onAdd={c => setSelectedCities(prev => prev.includes(c) ? prev : [...prev, c])}
            onRemove={c => setSelectedCities(prev => prev.filter(x => x !== c))}
          />
          <div className="relative sm:w-36 flex-shrink-0">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
            >
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => doSearch(1)}
            disabled={loading || (selectedRoles.length === 0 && !keyword.trim())}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {/* Secondary filters — all multi-select chips */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <ToggleChips options={WORK_TYPES} selected={selectedWorkTypes} onChange={setSelectedWorkTypes} />
          <div className="w-px h-4 bg-zinc-700" />
          <ToggleChips options={EMPLOYMENT_TYPES} selected={selectedEmploymentTypes} onChange={setSelectedEmploymentTypes} />
          <div className="w-px h-4 bg-zinc-700" />
          <select
            value={postedDate}
            onChange={e => setPostedDate(e.target.value)}
            className="px-2.5 py-1 bg-zinc-900 border border-zinc-600 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            {POSTED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sponsorOnly}
              onChange={e => setSponsorOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-600 text-blue-500 focus:ring-blue-500 bg-zinc-900"
            />
            <span className="text-xs text-zinc-400">Visa sponsor only</span>
          </label>
        </div>
      </div>

      {/* Results summary */}
      {hasSearched && !loading && !error && (
        <p className="text-xs text-zinc-500 mb-4">
          {total > 0
            ? `~${total.toLocaleString()} result${total !== 1 ? 's' : ''} · Page ${page} of ${pageCount}`
            : 'No jobs found for this search.'
          }
        </p>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-red-300">{error}</span>
          <button
            onClick={() => doSearch(1)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-700/50 hover:bg-red-700 text-red-200 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-700 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-zinc-700 rounded mb-2 w-3/4" />
                  <div className="h-2.5 bg-zinc-700/60 rounded w-1/2" />
                </div>
              </div>
              <div className="h-2.5 bg-zinc-700/60 rounded mb-2 w-2/3" />
              <div className="h-2.5 bg-zinc-700/60 rounded mb-3 w-1/2" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-zinc-700 rounded-full" />
                <div className="h-5 w-14 bg-zinc-700 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job grid */}
      {!loading && jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onAdd={handleAdd}
              added={addedIds.has(job.id)}
              adding={addingId === job.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && jobs.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => doSearch(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-xs text-zinc-500">Page {page} of {pageCount}</span>
          <button
            onClick={() => doSearch(page + 1)}
            disabled={page >= pageCount}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Empty state — only when search ran cleanly but returned nothing */}
      {!loading && hasSearched && jobs.length === 0 && !error && (
        <div className="text-center py-16 text-zinc-500">
          <Briefcase size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No jobs found. Try a different keyword or remove some filters.</p>
        </div>
      )}
    </div>
  )
}
