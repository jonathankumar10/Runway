/* global __RUNWAY_APP_URL__ */
const RUNWAY_APP_URL = __RUNWAY_APP_URL__

const signedOutEl  = document.getElementById('signed-out')
const signedInEl   = document.getElementById('signed-in')
const userEmailEl  = document.getElementById('user-email')
const userAvatarEl = document.getElementById('user-avatar')
const signInBtn    = document.getElementById('sign-in-btn')
const signOutBtn   = document.getElementById('sign-out-btn')
const openAppBtn   = document.getElementById('open-app-btn')
const errorEl      = document.getElementById('error')

function showSignedIn(email, displayName) {
  signedOutEl.style.display = 'none'
  signedInEl.style.display = 'block'
  userEmailEl.textContent = email || '—'
  const initial = (displayName || email || '?')[0].toUpperCase()
  if (userAvatarEl) userAvatarEl.textContent = initial
}

function showSignedOut() {
  signedInEl.style.display = 'none'
  signedOutEl.style.display = 'block'
}

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, res => {
  if (res?.signedIn) showSignedIn(res.email, res.displayName)
  else showSignedOut()
})

signInBtn.addEventListener('click', () => {
  signInBtn.disabled = true
  signInBtn.textContent = 'Signing in…'
  errorEl.textContent = ''
  chrome.runtime.sendMessage({ type: 'SIGN_IN' }, res => {
    signInBtn.disabled = false
    signInBtn.textContent = 'Sign in with Google'
    if (res?.ok) {
      showSignedIn(res.email, res.displayName)
    } else {
      errorEl.textContent = res?.error || 'Sign-in failed'
    }
  })
})

signOutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => showSignedOut())
})

openAppBtn.addEventListener('click', () => {
  window.open(RUNWAY_APP_URL, '_blank')
  window.close()
})
