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

  const max = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Applications per Week</h3>
      <div className="flex items-end gap-1.5 h-20">
        {weeks.map((week, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="weekly-bar w-full bg-violet-500 hover:bg-violet-400 rounded-sm transition-all duration-300"
              style={{ '--bar-h': `${(week.count / max) * 100}%`, '--bar-min-h': week.count > 0 ? '4px' : '0' }}
              title={`${week.label}: ${week.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {weeks.map((week, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-slate-500 leading-tight truncate">
            {week.label.split(' ')[1]}
          </span>
        ))}
      </div>
    </div>
  )
}
