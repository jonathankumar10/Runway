import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Kanban, LogOut, FileText, User, X, Send, Target, Compass } from 'lucide-react'
import { useAuth } from '../../context/auth'
import NotificationBell from '../common/NotificationBell'
import RunwayLogoMark from '../brand/RunwayLogoMark'
import './Sidebar.css'

/**
 * Primary navigation sidebar for protected app routes.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user, signOut } = useAuth()

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-logo-bar">
        <Link to="/welcome" className="flex items-center gap-2">
          <RunwayLogoMark size="md" />
          <span className="font-semibold text-white text-sm">Runway</span>
        </Link>
        <button
          onClick={onClose}
          className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors md:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div>
          <p className="sidebar-section-label">Launchpad</p>
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/board" icon={Kanban} label="Applications" />
          <NavItem to="/discover" icon={Compass} label="Discover" />
        </div>

        <div>
          <p className="sidebar-section-label">Documents</p>
          <NavItem to="/resumes" icon={FileText} label="Resumes" />
        </div>

        <div>
          <p className="sidebar-section-label">Networking</p>
          <NavItem to="/targets" icon={Target} label="Target Companies" />
          <NavItem to="/outreach" icon={Send} label="Outreach" />
        </div>

      </nav>

      <div className="sidebar-footer">
        <NotificationBell />
        <div className="sidebar-user">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2 py-1.5 transition-colors ${isActive ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`
            }
          >
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0" />
              : <User size={16} className="text-zinc-400 shrink-0" />
            }
            <span className="text-xs text-zinc-400 truncate">{user?.displayName}</span>
          </NavLink>
          <button onClick={signOut} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar-nav-link ${isActive ? 'sidebar-nav-link-active' : 'sidebar-nav-link-inactive'}`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}
