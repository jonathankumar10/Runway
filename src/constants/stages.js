export const STAGES = [
  { id: 'saved',               label: 'Saved',               color: 'slate',  bgClass: 'bg-slate-500/10',   borderClass: 'border-slate-500/40',   dotClass: 'bg-slate-400',   textClass: 'text-slate-400' },
  { id: 'applied',             label: 'Applied',             color: 'blue',   bgClass: 'bg-blue-500/10',    borderClass: 'border-blue-500/40',    dotClass: 'bg-blue-400',    textClass: 'text-blue-400' },
  { id: 'phoneScreen',         label: 'Phone Screen',        color: 'yellow', bgClass: 'bg-yellow-500/10',  borderClass: 'border-yellow-500/40',  dotClass: 'bg-yellow-400',  textClass: 'text-yellow-400' },
  { id: 'technicalInterview',  label: 'Technical Interview', color: 'violet', bgClass: 'bg-violet-500/10',  borderClass: 'border-violet-500/40',  dotClass: 'bg-violet-400',  textClass: 'text-violet-400' },
  { id: 'finalRound',          label: 'Final Round',         color: 'orange', bgClass: 'bg-orange-500/10',  borderClass: 'border-orange-500/40',  dotClass: 'bg-orange-400',  textClass: 'text-orange-400' },
  { id: 'offer',               label: 'Offer',               color: 'green',  bgClass: 'bg-green-500/10',   borderClass: 'border-green-500/40',   dotClass: 'bg-green-400',   textClass: 'text-green-400' },
  { id: 'accepted',            label: 'Accepted',            color: 'emerald',bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/40', dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  { id: 'rejected',            label: 'Rejected',            color: 'red',    bgClass: 'bg-red-500/10',     borderClass: 'border-red-500/40',     dotClass: 'bg-red-400',     textClass: 'text-red-400' },
  { id: 'withdrawn',           label: 'Withdrawn',           color: 'zinc',   bgClass: 'bg-zinc-500/10',    borderClass: 'border-zinc-500/40',    dotClass: 'bg-zinc-400',    textClass: 'text-zinc-400' },
]

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))
