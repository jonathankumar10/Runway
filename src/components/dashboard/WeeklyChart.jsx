import { useJobs } from '../../context/JobsContext'

function getWeekLabel(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WeeklyChart() {
  const { jobs } = useJobs()

  // Last 8 weeks, grouped by week start (Monday)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - (7 * (7 - i)))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const count = jobs.filter(j => {
      const d = j.dateApplied?.toDate?.() ?? j.createdAt?.toDate?.()
      return d && d >= weekStart && d < weekEnd
    }).length
    return { label: getWeekLabel((7 - i) * 7), count }
  })

  const WEEKLY_GOAL = 5
  const max = Math.max(...weeks.map(w => w.count), 1)
  const chartMax = Math.max(max, WEEKLY_GOAL)
  const goalPct = (WEEKLY_GOAL / chartMax) * 100
  const total = weeks.reduce((sum, w) => sum + w.count, 0)
  const lastWeek = weeks[weeks.length - 1]

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Applications per Week</h3>
        <span className="text-xs text-slate-500">{total} total · {lastWeek.count} this week</span>
      </div>
      <div className="relative">
        {/* Goal line */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ bottom: `${goalPct}%` }}
        >
          <div className="border-t border-dashed border-violet-400/30" />
          <span className="absolute right-0 -top-3.5 text-[9px] text-violet-400/50 leading-none">goal</span>
        </div>
        <div className="flex items-end gap-1.5 h-20 border-b border-slate-800">
          {weeks.map((week, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group">
              <div
                className={`weekly-bar w-full rounded-t-sm transition-all duration-300 ${
                  i === weeks.length - 1 ? 'bg-violet-500 hover:bg-violet-400' : 'bg-violet-600/70 hover:bg-violet-500/80'
                }`}
                style={{ '--bar-h': `${(week.count / chartMax) * 100}%`, '--bar-min-h': week.count > 0 ? '4px' : '0' }}
                title={`${week.label}: ${week.count}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {weeks.map((week, i) => (
          <span key={i} className={`flex-1 text-center text-[10px] leading-tight truncate ${i === weeks.length - 1 ? 'text-slate-400' : 'text-slate-600'}`}>
            {week.label.split(' ')[1]}
          </span>
        ))}
      </div>
    </div>
  )
}
