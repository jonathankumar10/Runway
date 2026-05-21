const signedOutEl = document.getElementById('signed-out')
const signedInEl = document.getElementById('signed-in')
const userEmailEl = document.getElementById('user-email')
const signInBtn = document.getElementById('sign-in-btn')
const signOutBtn = document.getElementById('sign-out-btn')
const errorEl = document.getElementById('error')

function showSignedIn(email) {
  signedOutEl.style.display = 'none'
  signedInEl.style.display = 'block'
  userEmailEl.textContent = email || '—'
}

function showSignedOut() {
  signedInEl.style.display = 'none'
  signedOutEl.style.display = 'block'
}

// Check current auth state
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, res => {
  if (res?.signedIn) showSignedIn(res.email)
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
      showSignedIn(res.email)
    } else {
      errorEl.textContent = res?.error || 'Sign-in failed'
    }
  })
})

signOutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => showSignedOut())
})
