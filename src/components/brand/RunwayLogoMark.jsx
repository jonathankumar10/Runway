import './RunwayLogoMark.css'

export default function RunwayLogoMark({ className = '', size = 'md' }) {
  return (
    <span className={`runway-logo-mark runway-logo-mark--${size} ${className}`} aria-hidden="true">
      <span className="runway-logo-mark__runway runway-logo-mark__runway--a" />
      <span className="runway-logo-mark__runway runway-logo-mark__runway--b" />
      <span className="runway-logo-mark__plane runway-logo-mark__plane--body" />
      <span className="runway-logo-mark__plane runway-logo-mark__plane--wing" />
      <span className="runway-logo-mark__plane runway-logo-mark__plane--tail" />
    </span>
  )
}
