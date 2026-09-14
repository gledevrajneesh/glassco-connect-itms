import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { firebaseAuth, isFirebaseEnabled } from '../../lib/firebase'
import { getCentralAssignment, saveCentralAssignment, type CentralAccessAssignment } from '../../lib/centralAccess'
import Icon from '../../components/Icon'
import './AuthGate.css'

type AuthGateProps = {
  children: (identityEmail: string, logout: (() => Promise<void>) | null, access: CentralAccessAssignment) => ReactNode
}

const bootstrapAdministrators = ['dev@glasscolabs.com']

const bootstrapAccess: CentralAccessAssignment = { id: 'dev', name: 'Development Administrator', email: 'dev@glasscolabs.com', roleId: 'administrator', roleIds: ['administrator'], appIds: ['itms', 'support'], status: 'Active', updatedAt: new Date().toISOString(), updatedBy: 'System bootstrap' }
async function resolveActiveItmsAccess(email: string) {
  const normalized = email.trim().toLowerCase()
  if (bootstrapAdministrators.includes(normalized)) {
    try {
      await saveCentralAssignment(bootstrapAccess)
    } catch {
      // The bootstrap administrator must remain able to repair central access
      // if Firestore is temporarily unavailable or an older rule is still live.
    }
    return bootstrapAccess
  }
  try { const assignment = await getCentralAssignment(normalized); return assignment?.status === 'Active' && assignment.employeeStatus !== 'Inactive' ? assignment : null } catch { return null }
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
      await signInWithPopup(activeAuth, provider)
    } catch {
      setError('Google Workspace sign-in did not complete. Select an authorised @glasscolabs.com account and try again.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-introduction" aria-label="About Glassco Workspace">
      <div className="auth-introduction-copy"><div className="auth-workspace-label"><strong>GLASSCO WORKSPACE</strong><b>|</b><span>CONNECTED OPERATIONS</span></div><h1>Glassco <em>Workspace</em></h1><p>One secure workspace for people, assets and service operations.</p><small>Connected tools that keep teams productive and operational information under control.</small></div>
      <div className="auth-services" aria-label="Glassco Workspace services"><span><i><Icon name="inventory" size={21}/></i>IT Asset Management</span><span><i><Icon name="support" size={21}/></i>IT Support Desk</span><span><i><Icon name="assurance" size={21}/></i>Access Governance</span><span><i><Icon name="requests" size={21}/></i>Service Requests</span><span><i><Icon name="visitor" size={21}/></i>Visitor Management</span></div>
    </section>
    <section className="auth-login-area"><div className="auth-login-stack"><header className="auth-login-brand"><img src="https://glasscolabs.com/wp-content/uploads/2024/03/Glassco-logo.jpg" alt="Glassco — A Glass Apart"/></header><div className="auth-card">
      <div className="auth-copy"><span>SECURE COMPANY ACCESS</span><h1>Sign in to Glassco Workspace</h1><p>Use your authorised Glassco business account to continue.</p></div>
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
    </div><footer className="auth-ownership"><strong>Developed and maintained by Department of IT</strong><span>Glassco Laboratory Equipments Pvt. Ltd. · Copyright © 2026</span><a href="mailto:dev@glasscolabs.com">Contact: dev@glasscolabs.com</a></footer></div></section>
  </main>
}
