import { hasEnoughJobData, normalizeJobPayload } from './import-utils.js'

const FIREBASE_API_KEY = __FIREBASE_API_KEY__
const FIREBASE_PROJECT_ID = __FIREBASE_PROJECT_ID__
const FIREBASE_FUNCTIONS_REGION = 'us-central1'

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

async function firestoreGet(path) {
  const { idToken, uid } = await getValidIdToken()
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/${path}?key=${FIREBASE_API_KEY}`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${idToken}` },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Firestore error ${res.status}`)
  }
  const doc = await res.json()
  return fromFirestoreFields(doc.fields)
}

async function firestoreList(subcollection, params = {}) {
  const { idToken, uid } = await getValidIdToken()
  const search = new URLSearchParams(params)
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/${subcollection}?key=${FIREBASE_API_KEY}&${search}`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${idToken}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Firestore error ${res.status}`)
  }
  const json = await res.json()
  return (json.documents || []).map(document => ({
    id: firestoreDocumentId(document.name),
    ...fromFirestoreFields(document.fields),
  }))
}

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

function firestoreDocumentId(documentName) {
  return String(documentName || '').split('/').pop()
}

function normalizedText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function scoreApplicationForContext(app, { pageUrl = '', pageText = '' } = {}) {
  const text = normalizedText(pageText)
  try {
    const page = pageUrl ? new URL(pageUrl) : null
    const job = app.jobUrl ? new URL(app.jobUrl) : null
    let score = 0
    if (page && job?.hostname === page.hostname) score += 20
    if (page && job?.pathname && page.pathname.includes(job.pathname.split('/').filter(Boolean)[0] || '')) score += 4
    if (app.company && page?.href.toLowerCase().includes(String(app.company).toLowerCase().replace(/\s+/g, ''))) score += 8
    if (app.company && text.includes(normalizedText(app.company))) score += 30
    if (app.role && text.includes(normalizedText(app.role))) score += 30
    for (const skill of app.keySkills || []) {
      if (skill && text.includes(normalizedText(skill))) score += 2
    }
    return score
  } catch {
    let score = 0
    if (app.company && text.includes(normalizedText(app.company))) score += 30
    if (app.role && text.includes(normalizedText(app.role))) score += 30
    return score
  }
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

  if (msg.type === 'GET_AUTOFILL_PROFILE') {
    chrome.storage.local.get(['userEmail', 'userDisplayName', 'firebaseUid'], async data => {
      try {
        if (!data.firebaseUid) {
          sendResponse({ ok: false, error: 'Sign in to Runway first' })
          return
        }

        const prefs = await firestoreGet('settings/preferences')
        const displayName = data.userDisplayName || prefs?.name || ''
        const [firstName = '', ...lastParts] = displayName.trim().split(/\s+/).filter(Boolean)

        sendResponse({
          ok: true,
          profile: {
            fullName: displayName,
            firstName: prefs?.firstName || firstName,
            lastName: prefs?.lastName || lastParts.join(' '),
            email: prefs?.email || data.userEmail || '',
            phone: prefs?.phone || '',
            location: prefs?.location || '',
            linkedInUrl: prefs?.linkedInUrl || prefs?.linkedin || '',
            githubUrl: prefs?.githubUrl || prefs?.github || '',
            portfolioUrl: prefs?.portfolioUrl || prefs?.portfolio || '',
            workAuthorization: prefs?.workAuthorization || '',
            sponsorship: prefs?.sponsorship || '',
            salaryExpectation: prefs?.salaryExpectation || '',
            remotePreference: prefs?.remotePreference || '',
          },
        })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })
    return true
  }

  if (msg.type === 'GET_APPLY_RESOURCES') {
    chrome.storage.local.get(['firebaseUid'], async data => {
      try {
        if (!data.firebaseUid) {
          sendResponse({ ok: false, error: 'Sign in to Runway first' })
          return
        }

        const applications = await firestoreList('applications', {
          pageSize: '25',
          orderBy: 'createdAt desc',
        })
        const tailoredCandidates = applications
          .filter(item => item.aiPrepStatus === 'ready' && (item.tailoredResumeText || item.tailoredResumeSections?.length))
          .map(item => ({ ...item, _score: scoreApplicationForContext(item, { pageUrl: msg.pageUrl, pageText: msg.pageText }) }))
          .sort((a, b) => b._score - a._score)
          .slice(0, 5)

        const resumes = await firestoreList('resumes', { pageSize: '25' })
        const defaultResume = resumes.find(resume => resume.isDefault) || resumes[0] || null

        sendResponse({
          ok: true,
          defaultResume: defaultResume ? {
            id: defaultResume.id,
            label: defaultResume.label || 'Base resume',
            filename: defaultResume.filename || `${defaultResume.label || 'base-resume'}.pdf`,
            resumeText: defaultResume.resumeText || '',
            pdfBase64: defaultResume.pdfBase64 || '',
          } : null,
          tailoredResumes: tailoredCandidates.map(app => ({
            id: app.id,
            company: app.company || '',
            role: app.role || '',
            jobDescription: app.jobDescription || '',
            tailoredResumeText: app.tailoredResumeText || '',
            tailoredResumeSections: app.tailoredResumeSections || [],
            coverLetterText: app.coverLetterText || '',
            coverLetterGeneratedAt: app.coverLetterGeneratedAt || '',
            score: app._score,
          })),
        })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })
    return true
  }

  if (msg.type === 'GENERATE_COVER_LETTER') {
    chrome.storage.local.get(['firebaseUid'], async data => {
      try {
        if (!data.firebaseUid) {
          sendResponse({ ok: false, error: 'Sign in to Runway first' })
          return
        }

        if (!msg.applicationId) {
          sendResponse({ ok: false, error: 'Choose a Runway application first' })
          return
        }

        const result = await callFunction('generateCoverLetter', {
          applicationId: msg.applicationId,
        })

        if (result?.error) {
          sendResponse({ ok: false, error: result.error })
          return
        }
        sendResponse({ ok: true, coverLetterText: result.coverLetterText || '' })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })
    return true
  }

  if (msg.type === 'DRAFT_APPLICATION_ANSWER') {
    chrome.storage.local.get(['firebaseUid'], async data => {
      try {
        if (!data.firebaseUid) {
          sendResponse({ ok: false, error: 'Sign in to Runway first' })
          return
        }

        let app = {}
        if (msg.applicationId) {
          app = await firestoreGet(`applications/${msg.applicationId}`) || {}
        }
        if (!app.role && !app.company) {
          const applications = await firestoreList('applications', {
            pageSize: '10',
            orderBy: 'createdAt desc',
          })
          app = applications.find(item => item.role && item.company) || applications[0] || {}
        }
        const result = await callFunction('draftApplicationAnswer', {
          question: msg.question,
          company: app.company || '',
          role: app.role || '',
          jobDescription: app.jobDescription || '',
        })

        if (result?.error) {
          sendResponse({ ok: false, error: result.error })
          return
        }
        sendResponse({ ok: true, answer: result.answer || '' })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
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
