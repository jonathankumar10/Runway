import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/useAuth'
import { useJobs } from '../../context/useJobs'

const NUM_WEEKS = 8

function getWeekRanges() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - daysToMonday)
  currentWeekStart.setHours(0, 0, 0, 0)

  return Array.from({ length: NUM_WEEKS }, (_, i) => {
    const weeksAgo = NUM_WEEKS - 1 - i
    const start = new Date(currentWeekStart)
    start.setDate(currentWeekStart.getDate() - 7 * weeksAgo)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { start, end, label, isCurrent: weeksAgo === 0 }
  })
}

export default function WeeklyChart() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const [outreachRecords, setOutreachRecords] = useState([])

  useEffect(() => {
    if (!user?.uid) return
    getDocs(collection(db, 'users', user.uid, 'outreach')).then(snap => {
      setOutreachRecords(snap.docs.map(d => d.data()))
    })
  }, [user?.uid])

  const weekRanges = getWeekRanges()

  const weeks = weekRanges.map(({ start, end, label, isCurrent }) => {
    const appsCount = jobs.filter(j => {
      const d = j.dateApplied?.toDate?.() ?? j.createdAt?.toDate?.()
      return d && d >= start && d < end
    }).length

    const outreachCount = outreachRecords.filter(r => {
      const d = r.createdAt?.toDate?.()
      return d && d >= start && d < end
    }).length

    return { label, appsCount, outreachCount, isCurrent }
  })

  const chartMax = Math.max(...weeks.map(w => Math.max(w.appsCount, w.outreachCount)), 5)
  const thisWeek = weeks[weeks.length - 1]
  const totalApps = weeks.reduce((s, w) => s + w.appsCount, 0)
  const totalOutreach = weeks.reduce((s, w) => s + w.outreachCount, 0)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Weekly Activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last 8 weeks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-violet-500 shrink-0" />
            <span className="text-xs text-slate-400">Applied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-emerald-500 shrink-0" />
            <span className="text-xs text-slate-400">Outreach</span>
          </div>
        </div>
      </div>

      {/* This week snapshot */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-800/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Applied this week</p>
          <p className="text-xl font-bold text-violet-400">{thisWeek.appsCount}</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Outreach this week</p>
          <p className="text-xl font-bold text-emerald-400">{thisWeek.outreachCount}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-20 border-b border-slate-800">
        {weeks.map((week, i) => (
          <div
            key={i}
            className="flex-1 flex items-end gap-px"
            title={`${week.label}: ${week.appsCount} applied, ${week.outreachCount} outreach`}
          >
            <div
              className={`flex-1 rounded-t-sm transition-all duration-300 ${week.isCurrent ? 'bg-violet-500' : 'bg-violet-600/55 hover:bg-violet-500/70'}`}
              style={{ height: week.appsCount > 0 ? `${Math.max((week.appsCount / chartMax) * 100, 5)}%` : '0%' }}
            />
            <div
              className={`flex-1 rounded-t-sm transition-all duration-300 ${week.isCurrent ? 'bg-emerald-500' : 'bg-emerald-600/55 hover:bg-emerald-500/70'}`}
              style={{ height: week.outreachCount > 0 ? `${Math.max((week.outreachCount / chartMax) * 100, 5)}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Week labels */}
      <div className="flex gap-1 mt-1.5">
        {weeks.map((week, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-[10px] leading-tight truncate ${week.isCurrent ? 'text-slate-400' : 'text-slate-600'}`}
          >
            {week.label.split(' ')[1]}
          </span>
        ))}
      </div>

      {/* 8-week totals */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
        <span className="text-xs text-slate-500">{totalApps} applications in 8 weeks</span>
        <span className="text-xs text-slate-500">{totalOutreach} outreach in 8 weeks</span>
      </div>

    </div>
  )
}
