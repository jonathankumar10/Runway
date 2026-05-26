import { hasEnoughJobData, normalizeJobPayload } from './import-utils.js'

const FIREBASE_API_KEY = __FIREBASE_API_KEY__
const FIREBASE_PROJECT_ID = __FIREBASE_PROJECT_ID__

// Web Application OAuth client ID (not the Chrome Extension one)
// Authorized redirect URI must include: https://{extensionId}.chromiumapp.org/
const GOOGLE_WEB_CLIENT_ID = __GOOGLE_WEB_CLIENT_ID__

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getValidIdToken() {
  const stored = await chrome.storage.local.get([
    'firebaseIdToken', 'firebaseIdTokenExp',
    'firebaseRefreshToken', 'firebaseUid',
  ])

  // Return cached token if valid for at least 5 more minutes
  if (stored.firebaseIdToken && stored.firebaseIdTokenExp > Date.now() + 5 * 60 * 1000) {
    return { idToken: stored.firebaseIdToken, uid: stored.firebaseUid }
  }

  // Refresh using stored refresh token
  if (stored.firebaseRefreshToken) {
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: stored.firebaseRefreshToken }),
      }
    )
    const data = await res.json()
    if (data.id_token) {
      await chrome.storage.local.set({
        firebaseIdToken: data.id_token,
        firebaseIdTokenExp: Date.now() + Number(data.expires_in) * 1000,
        firebaseRefreshToken: data.refresh_token,
        firebaseUid: data.user_id,
      })
      return { idToken: data.id_token, uid: data.user_id }
    }
  }

  throw new Error('Not signed in — open the Runway extension popup to sign in.')
}

async function signInWithGoogle() {
  // launchWebAuthFlow works for unpacked extensions; getAuthToken requires Web Store listing
  const CLIENT_ID = GOOGLE_WEB_CLIENT_ID
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('prompt', 'select_account')

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      url => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message || 'Sign-in cancelled'))
        } else {
          resolve(url)
        }
      }
    )
  })

  const hashParams = new URLSearchParams(new URL(responseUrl).hash.slice(1))
  const googleToken = hashParams.get('access_token')
  if (!googleToken) throw new Error('No access token received from Google')

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${googleToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  )
  const data = await res.json()
  if (!data.idToken) throw new Error(data.error?.message || 'Firebase sign-in failed')

  await chrome.storage.local.set({
    firebaseIdToken: data.idToken,
    firebaseIdTokenExp: Date.now() + Number(data.expiresIn) * 1000,
    firebaseRefreshToken: data.refreshToken,
    firebaseUid: data.localId,
    userEmail: data.email,
    userDisplayName: data.displayName,
  })

  return { email: data.email, displayName: data.displayName }
}

// ── Firestore REST ────────────────────────────────────────────────────────────

function toFirestoreFields(obj) {
  function toFieldValue(v) {
    if (v === null || v === undefined) return { nullValue: null }
    if (typeof v === 'string') return { stringValue: v }
    if (typeof v === 'number') return { integerValue: String(Math.round(v)) }
    if (typeof v === 'boolean') return { booleanValue: v }
    if (v instanceof Date) return { timestampValue: v.toISOString() }
    if (Array.isArray(v)) {
      const values = v.map(toFieldValue).filter(Boolean)
      return values.length ? { arrayValue: { values } } : { arrayValue: {} }
    }
    return null
  }

  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    const field = toFieldValue(v)
    if (field) fields[k] = field
  }
  return fields
}

async function firestoreAdd(subcollection, data) {
  const { idToken, uid } = await getValidIdToken()
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/${subcollection}?key=${FIREBASE_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Firestore error ${res.status}`)
  }
  return res.json()
}

// ── Message handlers ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SIGN_IN') {
    signInWithGoogle()
      .then(user => sendResponse({ ok: true, ...user }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'SIGN_OUT') {
    chrome.storage.local.remove([
      'firebaseIdToken', 'firebaseIdTokenExp',
      'firebaseRefreshToken', 'firebaseUid',
      'userEmail', 'userDisplayName',
    ], () => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(['userEmail', 'userDisplayName', 'firebaseUid'], data => {
      sendResponse({ signedIn: !!data.firebaseUid, email: data.userEmail, displayName: data.userDisplayName })
    })
    return true
  }

  if (msg.type === 'SET_JOB_BADGE') {
    const tabId = _sender.tab?.id
    const count = Number(msg.count) || 0
    const badgeText = count > 0 ? String(Math.min(count, 99)) : ''

    if (tabId) {
      chrome.action.setBadgeText({ tabId, text: badgeText })
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#312e81' })
    }

    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'ADD_JOB') {
    const job = normalizeJobPayload(msg)
    if (!hasEnoughJobData(job)) {
      sendResponse({ ok: false, error: 'Could not read job details from this page' })
      return true
    }

    firestoreAdd('applications', job)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'ADD_RECRUITER') {
    firestoreAdd('outreach', {
      recruiterName: msg.name,
      recruiterTitle: msg.title,
      recruiterLinkedIn: msg.linkedInUrl,
      recruiterEmail: '',
      company: msg.company,
      role: '',
      emailSent: false,
      linkedInSent: false,
      followUpSent: false,
      createdAt: new Date(),
    })
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }
})
