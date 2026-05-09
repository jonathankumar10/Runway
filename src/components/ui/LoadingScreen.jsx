import { BriefcaseBusiness } from 'lucide-react'
import './LoadingScreen.css'

export default function LoadingScreen({ fullScreen = false }) {
  return (
    <div className={`ls-root ${fullScreen ? 'ls-fullscreen' : 'ls-inline'}`}>
      <div className="ls-logo-wrap">
        <div className="ls-logo-ring" />
        <div className="ls-logo-icon">
          <BriefcaseBusiness size={18} className="text-white" />
        </div>
      </div>
      <p className="ls-wordmark">Runway</p>
      <div className="ls-dots">
        <span className="ls-dot" />
        <span className="ls-dot" />
        <span className="ls-dot" />
      </div>
    </div>
  )
}
