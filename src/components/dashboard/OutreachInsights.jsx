import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Send, CheckCircle2, Clock, Users } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/useAuth'

export default function OutreachInsights() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])

  useEffect(() => {
    if (!user?.uid) return
    return onSnapshot(collection(db, 'users', user.uid, 'outreach'), snap => {
      setRecords(snap.docs.map(d => d.data()))
    })
  }, [user?.uid])

  const total = records.length
  const emailCount = records.filter(r => r.emailSent).length
  const linkedInCount = records.filter(r => r.linkedInSent).length
  const fullyContacted = records.filter(r => r.emailSent && r.linkedInSent).length
  const followedUp = records.filter(r => r.followUpSent).length
  const pending = records.filter(r => !r.emailSent && !r.linkedInSent).length

  const emailPct = total > 0 ? Math.round((emailCount / total) * 100) : 0
  const linkedInPct = total > 0 ? Math.round((linkedInCount / total) * 100) : 0

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Outreach</h3>
        <span className="text-xs text-slate-500">{total} recruiter{total !== 1 ? 's' : ''} tracked</span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-9 h-9 rounded-full border border-dashed border-slate-700 flex items-center justify-center">
            <Send size={15} className="text-slate-600" />
          </div>
          <p className="text-xs text-slate-500">No outreach tracked yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">Email sent</span>
              <span className="text-xs font-medium text-slate-300">{emailCount} <span className="text-slate-500">/ {total}</span></span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${emailPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">LinkedIn sent</span>
              <span className="text-xs font-medium text-slate-300">{linkedInCount} <span className="text-slate-500">/ {total}</span></span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${linkedInPct}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-slate-800 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-green-400">
              <CheckCircle2 size={11} />
              {fullyContacted} contacted
            </div>
            {followedUp > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <Clock size={11} />
                {followedUp} followed up
              </div>
            )}
            {pending > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Users size={11} />
                {pending} pending
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
