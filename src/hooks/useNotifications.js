import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db, getMessagingInstance, getToken, onMessage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY

export function useNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!user?.uid) return

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setNotifications(items)
      setUnreadCount(items.filter(n => !n.read).length)
    })
  }, [user?.uid])

  useEffect(() => {
    const messaging = getMessagingInstance()
    if (!messaging) return
    return onMessage(messaging, (payload) => {
      // Foreground message — browser toast is handled by the UI
      console.log('FCM foreground message:', payload)
    })
  }, [])

  async function requestPermission() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return

    const messaging = getMessagingInstance()
    if (!messaging || !user?.uid) return

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
    if (token) {
      await setDoc(doc(db, 'users', user.uid, 'fcmTokens', token), {
        token,
        createdAt: serverTimestamp(),
        platform: 'web',
      })
    }
  }

  return { permission, unreadCount, notifications, requestPermission }
}
