import { Calendar } from 'lucide-react'
import { useJobs } from '../../context/useJobs'
import { useNow } from '../../hooks/useNow'

function formatCountdown(date, now) {
  const diff = date - now
  const hours = Math.floor(diff / 3600000)
  if (hours < 0) return null
  if (hours < 24) return `In ${hours}h`
  const days = Math.floor(hours / 24)
  return `In ${days}d`
}

export default function InterviewCountdown() {
  const { jobs } = useJobs()
  const now = useNow()

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
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Calendar size={12} className="text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Upcoming Interviews</h3>
      </div>
      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-9 h-9 rounded-full border border-dashed border-slate-700 flex items-center justify-center">
            <Calendar size={15} className="text-slate-600" />
          </div>
          <p className="text-xs text-slate-500">No interviews scheduled</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map(({ job, date }, i) => {
            const countdown = formatCountdown(date, now)
            return (
              <li key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{job.company}</p>
                  <p className="text-xs text-slate-500">{job.role} · {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {countdown && (
                  <span className="text-[11px] text-orange-400 font-semibold bg-orange-400/10 px-2 py-0.5 rounded-full shrink-0">{countdown}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
