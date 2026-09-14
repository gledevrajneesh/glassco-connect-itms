import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { firestore } from './firebase'

export type UserNotification = {
  id: string
  recipientEmail: string
  title: string
  message: string
  category: 'Access' | 'System'
  application: string
  createdAt: string
  createdBy: string
  readAt?: string
}

export async function createUserNotification(notification: Omit<UserNotification, 'id' | 'readAt'>) {
  if (!firestore) return false
  await addDoc(collection(firestore, 'userNotifications'), notification)
  return true
}

export function subscribeUserNotifications(email: string, receive: (rows: UserNotification[]) => void) {
  if (!firestore || !email) return () => undefined
  return onSnapshot(
    query(collection(firestore, 'userNotifications'), where('recipientEmail', '==', email.trim().toLowerCase())),
    snapshot => receive(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() } as UserNotification)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    () => receive([]),
  )
}

export async function markUserNotificationRead(id: string) {
  if (!firestore) return
  await updateDoc(doc(firestore, 'userNotifications', id), { readAt: new Date().toISOString() })
}
