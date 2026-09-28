import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'

export type UserSelfCareProfile = {
  email: string
  photoDataUrl: string
  notificationEmail: boolean
  notificationInApp: boolean
  density: 'Comfortable' | 'Compact'
  updatedAt: string
}

const profileId = (email: string) => email.trim().toLowerCase()

export function subscribeUserSelfCare(email: string, receive: (profile: UserSelfCareProfile | null) => void) {
  if (!firestore || !email) return () => undefined
  return onSnapshot(doc(firestore, 'userSelfCare', profileId(email)), snapshot => receive(snapshot.exists() ? snapshot.data() as UserSelfCareProfile : null), () => receive(null))
}

export async function saveUserSelfCare(profile: UserSelfCareProfile) {
  if (!firestore) return
  await setDoc(doc(firestore, 'userSelfCare', profileId(profile.email)), profile, { merge: true })
}
