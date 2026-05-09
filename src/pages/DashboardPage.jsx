import { useJobs } from '../context/JobsContext'
import PipelineFunnel from '../components/dashboard/PipelineFunnel'
import WeeklyChart from '../components/dashboard/WeeklyChart'
import InterviewCountdown from '../components/dashboard/InterviewCountdown'
import NextMoves from '../components/dashboard/NextMoves'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { jobs } = useJobs()

  const total = jobs.length
  const interviewed = jobs.filter(j => ['technicalInterview', 'finalRound', 'offer', 'accepted'].includes(j.stage)).length
  const offers = jobs.filter(j => ['offer', 'accepted'].includes(j.stage)).length
  const interviewRate = total ? Math.round((interviewed / total) * 100) : 0
  const offerRate = total ? Math.round((offers / total) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-xs text-slate-300 mt-0.5">Your job search at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Applied" value={total} />
        <StatCard label="Interviews" value={interviewed} sub={`${interviewRate}% interview rate`} />
        <StatCard label="Offers" value={offers} sub={`${offerRate}% offer rate`} />
        <StatCard label="Active" value={jobs.filter(j => !['rejected', 'withdrawn', 'accepted'].includes(j.stage)).length} sub="In pipeline" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PipelineFunnel />
        <WeeklyChart />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InterviewCountdown />
        <NextMoves />
      </div>
    </div>
  )
}
