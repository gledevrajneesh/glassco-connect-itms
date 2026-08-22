import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseEnabled = import.meta.env.VITE_FIREBASE_ENABLED === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredConfig = Object.entries(firebaseConfig).filter(([, value]) => !value)

if (firebaseEnabled && requiredConfig.length) {
  throw new Error(`Firebase is enabled but configuration is incomplete: ${requiredConfig.map(([key]) => key).join(', ')}`)
}

export const firebaseApp: FirebaseApp | null = firebaseEnabled
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const firestore: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
export const isFirebaseEnabled = firebaseEnabled
export const firebaseProjectId = firebaseConfig.projectId || ''
