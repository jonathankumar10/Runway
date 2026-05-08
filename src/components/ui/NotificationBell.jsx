import { useState } from 'react'
import { Bell } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import './NotificationBell.css'

export default function NotificationBell() {
  const { user } = useAuth()
  const { unreadCount, notifications, requestPermission, permission } = useNotifications()
  const [open, setOpen] = useState(false)

  async function markRead(notifId) {
    await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), { read: true })
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="notif-btn">
        <div className="relative">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </div>
        Notifications
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="text-xs font-semibold text-slate-300">Notifications</span>
            {permission !== 'granted' && (
              <button onClick={requestPermission} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Enable push
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 px-3 py-4 text-center">No notifications yet</p>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`notif-item ${!n.read ? 'bg-violet-500/5' : ''}`}
                >
                  <p className={`text-xs leading-relaxed ${!n.read ? 'text-slate-200' : 'text-slate-400'}`}>
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
