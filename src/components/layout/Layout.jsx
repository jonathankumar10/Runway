import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import RunwayLogoMark from '../brand/RunwayLogoMark'

/**
 * Protected app shell with sidebar navigation and routed page content.
 */
export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex w-full min-h-svh min-w-0">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0 relative" style={{ background: '#09090b' }}>
        {/* Subtle dot grid — matches portfolio aesthetic */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            opacity: 0.04,
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            zIndex: 0,
          }}
          aria-hidden
        />
        <div className="flex items-center h-14 px-4 md:hidden shrink-0 sticky top-0 z-10" style={{ background: 'rgba(9,9,11,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-zinc-400 hover:text-white transition-colors p-1"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <RunwayLogoMark size="sm" />
            <span className="text-sm font-semibold text-white">Runway</span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
