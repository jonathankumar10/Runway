import { Calendar } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'

function formatCountdown(date) {
  const diff = date - Date.now()
  const hours = Math.floor(diff / 3600000)
  if (hours < 0) return null
  if (hours < 24) return `In ${hours}h`
  const days = Math.floor(hours / 24)
  return `In ${days}d`
}

export default function InterviewCountdown() {
  const { jobs } = useJobs()
  const now = Date.now()

  const upcoming = jobs
    .flatMap(j =>
      (j.interviewDates ?? []).map(ts => ({
        job: j,
        date: ts?.toDate ? ts.toDate() : new Date(ts),
      }))
    )
    .filter(({ date }) => date.getTime() > now)
    .sort((a, b) => a.date - b.date)
    .slice(0, 5)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={13} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-300">Upcoming Interviews</h3>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-slate-500">No interviews scheduled</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map(({ job, date }, i) => {
            const countdown = formatCountdown(date)
            return (
              <li key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{job.company}</p>
                  <p className="text-[10px] text-slate-500">{job.role} · {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {countdown && (
                  <span className="text-xs text-orange-400 font-medium shrink-0">{countdown}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
