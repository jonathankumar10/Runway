import { Send, Users, Trophy, MailOpen } from 'lucide-react'
import { useJobs } from '../context/JobsContext'
import { useAuth } from '../context/AuthContext'
import PipelineFunnel from '../components/dashboard/PipelineFunnel'
import WeeklyChart from '../components/dashboard/WeeklyChart'
import InterviewCountdown from '../components/dashboard/InterviewCountdown'
import NextMoves from '../components/dashboard/NextMoves'
import OutreachInsights from '../components/dashboard/OutreachInsights'
import TargetCompaniesInsights from '../components/dashboard/TargetCompaniesInsights'

function StatCard({ label, value, sub, icon: Icon, iconColor }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">{label}</p>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
            <Icon size={13} className={iconColor} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()

  const firstName = user?.displayName?.split(' ')[0] ?? null
  const totalApplied = jobs.filter(j => j.stage !== 'saved').length
  const interviewed = jobs.filter(j => ['technicalInterview', 'finalRound', 'offer', 'accepted'].includes(j.stage)).length
  const offers = jobs.filter(j => ['offer', 'accepted'].includes(j.stage)).length
  const interviewRate = totalApplied ? Math.round((interviewed / totalApplied) * 100) : 0
  const offerRate = totalApplied ? Math.round((offers / totalApplied) * 100) : 0
  const responded = jobs.filter(j => ['phoneScreen', 'technicalInterview', 'finalRound', 'offer', 'accepted', 'rejected'].includes(j.stage)).length
  const responseRate = totalApplied ? Math.round((responded / totalApplied) * 100) : 0
  const activeCount = jobs.filter(j => !['saved', 'rejected', 'withdrawn', 'accepted'].includes(j.stage)).length

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          {firstName ? `Hi, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {activeCount > 0
            ? `${activeCount} active application${activeCount !== 1 ? 's' : ''} in your pipeline`
            : 'Your job search at a glance'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Applied" value={totalApplied} icon={Send} iconColor="text-blue-400" />
        <StatCard label="Interviews" value={interviewed} sub={`${interviewRate}% interview rate`} icon={Users} iconColor="text-violet-400" />
        <StatCard label="Offers" value={offers} sub={`${offerRate}% offer rate`} icon={Trophy} iconColor="text-emerald-400" />
        <StatCard label="Response Rate" value={`${responseRate}%`} sub={`${responded} of ${totalApplied} replied`} icon={MailOpen} iconColor="text-amber-400" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PipelineFunnel />
        <WeeklyChart />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <InterviewCountdown />
        <NextMoves />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutreachInsights />
        <TargetCompaniesInsights />
      </div>
    </div>
  )
}
