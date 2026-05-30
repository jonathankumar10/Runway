import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Target } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/auth'

const STATUS_CONFIG = [
  { key: 'contacted', label: 'Contacted',    color: 'bg-green-500' },
  { key: 'emailed',   label: 'Emailed',      color: 'bg-emerald-500' },
  { key: 'tracked',   label: 'Tracked',      color: 'bg-blue-500' },
  { key: 'retrieved', label: 'Retrieved',    color: 'bg-sky-500' },
  { key: 'new',       label: 'Not searched', color: 'bg-zinc-600' },
]

function getStatus(company, cachedDomains, outreachByCompany) {
  const name = company.name?.toLowerCase()
  const records = outreachByCompany.get(name) ?? []
  if (records.some(r => r.emailSent && r.linkedInSent)) return 'contacted'
  if (records.some(r => r.emailSent)) return 'emailed'
  if (records.length > 0) return 'tracked'
  if (cachedDomains.has(company.domain)) return 'retrieved'
  return 'new'
}

/**
 * Summarizes target-company progress and recruiter discovery status.
 */
export default function TargetCompaniesInsights() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [cachedDomains, setCachedDomains] = useState(new Set())
  const [outreachByCompany, setOutreachByCompany] = useState(new Map())

  useEffect(() => {
    if (!user?.uid) return
    const u1 = onSnapshot(collection(db, 'users', user.uid, 'targetCompanies'), snap => {
      setCompanies(snap.docs.map(d => d.data()))
    })
    const u2 = onSnapshot(collection(db, 'users', user.uid, 'recruiterCache'), snap => {
      setCachedDomains(new Set(snap.docs.map(d => d.id)))
    })
    const u3 = onSnapshot(collection(db, 'users', user.uid, 'outreach'), snap => {
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
    return () => { u1(); u2(); u3() }
  }, [user?.uid])

  const total = companies.length
  const counts = Object.fromEntries(
    STATUS_CONFIG.map(s => [
      s.key,
      companies.filter(c => getStatus(c, cachedDomains, outreachByCompany) === s.key).length,
    ])
  )
  const contactedPct = total > 0 ? Math.round((counts.contacted / total) * 100) : 0

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Target Companies</h3>
        <span className="text-xs text-zinc-500">{total} compan{total !== 1 ? 'ies' : 'y'}</span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-9 h-9 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
            <Target size={15} className="text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500">No target companies yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {STATUS_CONFIG.map(s => {
            const count = counts[s.key]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 shrink-0 truncate">{s.label}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${s.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-zinc-300 w-5 text-right">{count}</span>
              </div>
            )
          })}
          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
            <span className="font-medium text-green-400">{contactedPct}%</span> of targets fully contacted
          </p>
        </div>
      )}
    </div>
  )
}
