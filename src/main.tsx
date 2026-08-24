import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './features/auth/AuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(identityEmail, logout, access) => <App identityEmail={identityEmail} logout={logout} access={access} />}</AuthGate>
  </StrictMode>,
)
