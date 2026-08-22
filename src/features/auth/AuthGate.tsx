import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { firebaseAuth, isFirebaseEnabled } from '../../lib/firebase'
import './AuthGate.css'

type AuthGateProps = {
  children: (identityEmail: string, logout: (() => Promise<void>) | null) => ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(isFirebaseEnabled)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setChecking(false)
    })
  }, [])

  if (!isFirebaseEnabled || !firebaseAuth) return children('dev@glasscolabs.com', null)
  const activeAuth = firebaseAuth
  if (checking) return <div className="auth-loading">Verifying secure ITMS session…</div>
  if (user) return children(user.email || 'Authenticated user', () => signOut(activeAuth))

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      await signInWithEmailAndPassword(firebaseAuth!, email.trim(), password)
    } catch {
      setError('Sign-in failed. Check your company email and password, then try again.')
    } finally { setBusy(false) }
  }

  async function resetPassword() {
    if (!email.trim()) { setError('Enter your company email first.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      await sendPasswordResetEmail(firebaseAuth!, email.trim())
      setMessage('Password-reset email sent. Check the inbox and spam folder.')
    } catch {
      setError('The reset email could not be sent. Confirm the address and try again.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-bars"><i/><i/><i/><i/></span><div><strong>GLASSCO</strong><span>CONNECT · ITMS</span></div></div>
      <div className="auth-copy"><span>SECURE COMPANY ACCESS</span><h1>Sign in to ITMS</h1><p>Use your authorised Glassco business account to continue.</p></div>
      <form onSubmit={login}>
        <label>Company email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <div className="auth-alert error">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}
        <button className="auth-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Sign in securely'}</button>
        <button className="auth-link" type="button" disabled={busy} onClick={resetPassword}>Forgot password?</button>
      </form>
      <footer>Controlled access · Authorised users only</footer>
    </section>
  </main>
}
