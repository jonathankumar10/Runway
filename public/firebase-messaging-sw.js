// Firebase Messaging service worker — must be served from root, cannot use import.meta.env
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js')

// These values are intentionally hardcoded — they are public Firebase config, not secrets
firebase.initializeApp({
  apiKey: "__VITE_FIREBASE_API_KEY__",
  authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket: "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__VITE_FIREBASE_APP_ID__",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification?.title ?? 'Job Tracker',
    {
      body: payload.notification?.body ?? '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: payload.data,
    }
  )
})
