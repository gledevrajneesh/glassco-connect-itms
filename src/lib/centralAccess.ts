import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'
import type { RoleId } from './accessControl'

export type CentralAccessState = 'Active' | 'Suspended' | 'Archived'
export type CentralAccessAssignment = {
  id: string
  name: string
  email: string
  roleId: RoleId
  roleIds?: RoleId[]
  status: CentralAccessState
  updatedAt: string
  updatedBy: string
}

export type CentralAccessEvent = {
  id: string
  principal: string
  before: string
  after: string
  action: string
  actor: string
  at: string
}

export const accessDocumentId = (email: string) => email.trim().toLowerCase()

export async function hasCentralAccess(email: string) {
  return (await getCentralAssignment(email))?.status === 'Active'
}

export async function getCentralAssignment(email: string) {
  if (!firestore) return null
  const snapshot = await getDoc(doc(firestore, 'accessAssignments', accessDocumentId(email)))
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.data().id || snapshot.id } as CentralAccessAssignment) : null
}

export async function loadCentralAssignments() {
  if (!firestore) return []
  const snapshot = await getDocs(collection(firestore, 'accessAssignments'))
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.data().id || entry.id } as CentralAccessAssignment))
}

export async function saveCentralAssignment(assignment: CentralAccessAssignment, previousEmail?: string) {
  if (!firestore) return
  const nextId = accessDocumentId(assignment.email)
  await setDoc(doc(firestore, 'accessAssignments', nextId), { ...assignment, email: nextId })
  if (previousEmail && accessDocumentId(previousEmail) !== nextId) {
    await deleteDoc(doc(firestore, 'accessAssignments', accessDocumentId(previousEmail)))
  }
}

export async function loadCentralEvents() {
  if (!firestore) return []
  const snapshot = await getDocs(collection(firestore, 'accessEvents'))
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.data().id || entry.id } as CentralAccessEvent))
}

export async function saveCentralEvent(event: CentralAccessEvent) {
  if (!firestore) return
  await setDoc(doc(firestore, 'accessEvents', event.id), event)
}
