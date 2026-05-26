import RunwayLogoMark from '../brand/RunwayLogoMark'
import './LoadingScreen.css'

export default function LoadingScreen({ fullScreen = false }) {
  return (
    <div className={`ls-root ${fullScreen ? 'ls-fullscreen' : 'ls-inline'}`}>
      <div className="ls-logo-wrap">
        <div className="ls-logo-ring" />
        <RunwayLogoMark size="xl" className="ls-logo-icon" />
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
