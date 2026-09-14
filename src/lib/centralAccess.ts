import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'
import type { RoleId } from './accessControl'
import type { GlasscoApplicationId } from './applicationAccess'

export type CentralAccessState = 'Active' | 'Suspended' | 'Archived'
export type CentralAccessAssignment = {
  id: string
  name: string
  email: string
  roleId: RoleId
  roleIds?: RoleId[]
  appIds?: GlasscoApplicationId[]
  status: CentralAccessState
  updatedAt: string
  updatedBy: string
  employeeId?: string
  employeeStatus?: 'Active' | 'Inactive'
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
  // Firestore rejects `undefined` values. Older/bootstrap access records may
  // not yet be linked to a User Master employee, so remove only absent optional
  // linkage fields while retaining the complete access authority record.
  const { employeeId, employeeStatus, ...required } = assignment
  await setDoc(doc(firestore, 'accessAssignments', nextId), {
    ...required,
    email: nextId,
    ...(employeeId ? { employeeId } : {}),
    ...(employeeStatus ? { employeeStatus } : {}),
  })
  if (previousEmail && accessDocumentId(previousEmail) !== nextId) {
    await deleteDoc(doc(firestore, 'accessAssignments', accessDocumentId(previousEmail)))
  }
}

export async function syncAssignmentFromUserMaster(user: { id: string; name: string; email: string; status: 'Active' | 'Inactive' }, actor: string, previousEmail?: string) {
  const priorAddress = accessDocumentId(previousEmail || user.email)
  const current = await getCentralAssignment(priorAddress)
  if (!current) return false
  const email = accessDocumentId(user.email)
  await saveCentralAssignment({
    ...current,
    name: user.name.trim(),
    email,
    employeeId: user.id,
    employeeStatus: user.status,
    status: user.status === 'Inactive' ? 'Suspended' : current.status,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  }, priorAddress)
  return true
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
