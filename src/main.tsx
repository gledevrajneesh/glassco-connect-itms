import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './features/auth/AuthGate.tsx'
import PasswordActionPage from './features/auth/PasswordActionPage.tsx'

const isEmailAction=new URLSearchParams(window.location.search).get('mode')==='resetPassword'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isEmailAction?<PasswordActionPage/>:<AuthGate>{(identityEmail, logout, access) => <App identityEmail={identityEmail} logout={logout} access={access} />}</AuthGate>}
  </StrictMode>,
)
