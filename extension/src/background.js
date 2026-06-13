import { hasEnoughJobData, normalizeJobPayload } from './import-utils.js'

const FIREBASE_API_KEY = __FIREBASE_API_KEY__
const FIREBASE_PROJECT_ID = __FIREBASE_PROJECT_ID__
const FIREBASE_FUNCTIONS_REGION = 'us-central1'

// Web Application OAuth client ID (not the Chrome Extension one).
// Authorized redirect URI must include: https://{extensionId}.chromiumapp.org/
const GOOGLE_WEB_CLIENT_ID = __GOOGLE_WEB_CLIENT_ID__

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Returns a valid Firebase ID token, refreshing it if it has expired or is close to expiry.
 * Tokens are cached in chrome.storage.local to avoid unnecessary network requests.
 */
async function getValidIdToken() {
  const stored = await chrome.storage.local.get([
    'firebaseIdToken', 'firebaseIdTokenExp',
    'firebaseRefreshToken', 'firebaseUid',
  ])

  // Return the cached token if it's valid for at least 5 more minutes.
  if (stored.firebaseIdToken && stored.firebaseIdTokenExp > Date.now() + 5 * 60 * 1000) {
    return { idToken: stored.firebaseIdToken, uid: stored.firebaseUid }
  }

  // Refresh using the stored refresh token.
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

/**
 * Launches the Google OAuth flow and exchanges the token for a Firebase session.
 * Uses launchWebAuthFlow which works for unpacked extensions without a Web Store listing.
 */
async function signInWithGoogle() {
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID)
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
  const googleAccessToken = hashParams.get('access_token')
  if (!googleAccessToken) throw new Error('No access token received from Google')

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
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

/** Converts a plain JS object into Firestore's typed field format for REST API requests. */
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
  for (const [key, value] of Object.entries(obj)) {
    const field = toFieldValue(value)
    if (field) fields[key] = field
  }
  return fields
}

/** Converts a Firestore REST document's typed fields back into a plain JS object. */
function fromFirestoreFields(fields = {}) {
  function fromFieldValue(field) {
    if ('stringValue' in field) return field.stringValue
    if ('integerValue' in field) return Number(field.integerValue)
    if ('doubleValue' in field) return Number(field.doubleValue)
    if ('booleanValue' in field) return Boolean(field.booleanValue)
    if ('timestampValue' in field) return field.timestampValue
    if ('nullValue' in field) return null
    if ('arrayValue' in field) return (field.arrayValue.values || []).map(fromFieldValue)
    if ('mapValue' in field) return fromFirestoreFields(field.mapValue.fields)
    return undefined
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFieldValue(value)])
  )
}

/** Adds a new document to a Firestore subcollection under the current user's path. */
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

/** Calls a Firebase Cloud Function with the given name and data payload. */
async function callFunction(name, data) {
  const { idToken } = await getValidIdToken()
  const url = `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })

  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = {}
  }
  if (!res.ok || json.error) {
    const detail =
      json.error?.message ||
      json.result?.error ||
      json.error?.status ||
      text?.slice(0, 240) ||
      `HTTP ${res.status}`
    throw new Error(`Function ${name} failed: ${detail}`)
  }
  return json.result
}

/** Extracts the document ID from a Firestore document name path. */
function firestoreDocumentId(documentName) {
  return String(documentName || '').split('/').pop()
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

  // Saves the badge count on the extension icon for the current LinkedIn tab.
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

  // Saves a job scraped from a LinkedIn job page to Firestore, then triggers AI prep.
  if (msg.type === 'ADD_JOB') {
    const job = normalizeJobPayload(msg)
    if (!hasEnoughJobData(job)) {
      sendResponse({ ok: false, error: 'Could not read job details from this page' })
      return true
    }

    firestoreAdd('applications', job)
      .then(async doc => {
        const applicationId = firestoreDocumentId(doc.name)
        callFunction('prepareApplication', { applicationId }).catch(err => {
          console.warn('[Runway] prepareApplication failed:', err)
        })
        sendResponse({ ok: true, applicationId, prepStarted: true })
      })
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  // Saves a recruiter contact scraped from a LinkedIn profile page to Firestore.
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
