import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { firebaseAuth, isFirebaseEnabled } from '../../lib/firebase'
import { getCentralAssignment, saveCentralAssignment, type CentralAccessAssignment } from '../../lib/centralAccess'
import './AuthGate.css'

type AuthGateProps = {
  children: (identityEmail: string, logout: (() => Promise<void>) | null, access: CentralAccessAssignment) => ReactNode
}

const bootstrapAdministrators = ['dev@glasscolabs.com']

const bootstrapAccess: CentralAccessAssignment = { id: 'dev', name: 'Development Administrator', email: 'dev@glasscolabs.com', roleId: 'administrator', roleIds: ['administrator'], status: 'Active', updatedAt: new Date().toISOString(), updatedBy: 'System bootstrap' }

function localAssignments() {
  try {
    const stored = JSON.parse(localStorage.getItem('itms.access-assignments.v1') || '[]') as CentralAccessAssignment[]
    return stored.filter((record) => record.email?.toLowerCase().endsWith('@glasscolabs.com') && record.roleId && record.status)
  } catch { return [] }
}

async function resolveActiveItmsAccess(email: string) {
  const normalized = email.trim().toLowerCase()
  if (bootstrapAdministrators.includes(normalized)) {
    try {
      await saveCentralAssignment(bootstrapAccess)
      await Promise.all(localAssignments().map((assignment) => saveCentralAssignment({ ...assignment, email: assignment.email.toLowerCase() })))
    } catch {
      // The bootstrap administrator must remain able to repair central access
      // if Firestore is temporarily unavailable or an older rule is still live.
    }
    return bootstrapAccess
  }
  try { const assignment = await getCentralAssignment(normalized); return assignment?.status === 'Active' ? assignment : null } catch { return null }
}

function isGlasscoWorkspaceAccount(email: string) {
  return email.trim().toLowerCase().endsWith('@glasscolabs.com')
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] = useState<CentralAccessAssignment | null>(null)
  const [checking, setChecking] = useState(isFirebaseEnabled)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const configuredAuth = firebaseAuth
    if (!configuredAuth) return
    return onAuthStateChanged(configuredAuth, async (nextUser) => {
      const authenticatedEmail = nextUser?.email || ''
      const resolvedAccess = nextUser && isGlasscoWorkspaceAccount(authenticatedEmail) ? await resolveActiveItmsAccess(authenticatedEmail) : null
      if (nextUser && !resolvedAccess) {
        await signOut(configuredAuth)
        setError('Your Google account is valid, but active ITMS access has not been assigned by an administrator.')
        setUser(null);setAccess(null)
      } else { setUser(nextUser);setAccess(resolvedAccess) }
      setChecking(false)
    })
  }, [])

  if (!isFirebaseEnabled || !firebaseAuth) return children('dev@glasscolabs.com', null, bootstrapAccess)
  const activeAuth = firebaseAuth
  if (checking) return <div className="auth-loading">Verifying secure ITMS session…</div>
  if (user && access) return children(user.email || 'Authenticated user', () => signOut(activeAuth), access)

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

  async function googleSignIn() {
    setBusy(true); setError(''); setMessage('')
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ hd: 'glasscolabs.com', prompt: 'select_account' })
      await signInWithRedirect(activeAuth, provider)
    } catch {
      setError('Google Workspace sign-in did not complete. Select an authorised @glasscolabs.com account and try again.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-bars"><i/><i/><i/><i/></span><div><strong>GLASSCO</strong><span>CONNECT · ITMS</span></div></div>
      <div className="auth-copy"><span>SECURE COMPANY ACCESS</span><h1>Sign in to ITMS</h1><p>Use your authorised Glassco business account to continue.</p></div>
      <div className="auth-sso"><button type="button" className="google-signin" disabled={busy} onClick={googleSignIn}><span>G</span>Continue with Google Workspace</button><p>Only active users listed in ITMS Access &amp; Roles are admitted.</p></div>
      <div className="auth-divider"><span>or use email and password</span></div>
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
