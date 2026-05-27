import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider)
  }

  async function signUpWithEmail(email, password) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
    await sendEmailVerification(newUser)
  }

  async function signInWithEmail(email, password) {
    const { user: signedIn } = await signInWithEmailAndPassword(auth, email, password)
    if (!signedIn.emailVerified) {
      await firebaseSignOut(auth)
      const err = new Error('Email not verified')
      err.code = 'EMAIL_NOT_VERIFIED'
      throw err
    }
  }

  async function resendVerificationEmail() {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser)
    }
  }

  async function checkEmailVerification() {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    const verified = auth.currentUser.emailVerified
    // Spread into a new object so React detects the state change
    setUser({ ...auth.currentUser })
    return verified
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{
      user,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      resendVerificationEmail,
      checkEmailVerification,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
