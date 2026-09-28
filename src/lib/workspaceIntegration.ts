import { addDoc, collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { firestore } from './firebase'

export type WorkspaceApplicationId = 'itms' | 'support' | 'requests' | 'facilities' | 'pms' | 'flow'
export type CanonicalWorkspaceStatus = 'Draft' | 'Submitted' | 'Assigned' | 'In progress' | 'Waiting' | 'Completed' | 'Verified' | 'Closed' | 'Reopened' | 'Cancelled' | 'Archived'
export type WorkspaceEventName = 'Created' | 'Assigned' | 'Approved' | 'Rejected' | 'Returned' | 'Status changed' | 'Material required' | 'Received' | 'Completed' | 'Reopened' | 'Cancelled' | 'Archived'

export type WorkspaceRecordRef = { application: WorkspaceApplicationId; recordId: string; recordCode: string; route?: string }
export type WorkspaceLink = {
  id: string
  source: WorkspaceRecordRef
  target: WorkspaceRecordRef
  linkType: 'Originated from' | 'Requires' | 'Converted to' | 'Related to' | 'Resolved by'
  createdAt: string
  createdBy: string
  status: 'Active' | 'Superseded'
}
export type WorkspaceEvent = {
  id: string
  idempotencyKey: string
  application: WorkspaceApplicationId
  recordId: string
  recordCode: string
  event: WorkspaceEventName
  canonicalStatus?: CanonicalWorkspaceStatus
  actorEmail: string
  occurredAt: string
  payload?: Record<string, unknown>
  deliveryStatus: 'Pending' | 'Delivered' | 'Failed'
  attempts: number
  lastError?: string
}
export type IntegrationHealth = {
  id: string
  service: string
  application: WorkspaceApplicationId | 'workspace'
  status: 'Healthy' | 'Degraded' | 'Failed'
  lastSuccessAt?: string
  lastFailureAt?: string
  pendingCount: number
  failureCount: number
  detail: string
  updatedAt: string
}

const clean = (value: string) => value.trim()
export function workspaceLinkId(source: WorkspaceRecordRef, target: WorkspaceRecordRef, linkType: WorkspaceLink['linkType']) {
  return `${source.application}:${source.recordId}:${linkType}:${target.application}:${target.recordId}`.toLowerCase().replaceAll(/[^a-z0-9:-]+/g, '-')
}

export async function saveWorkspaceLink(input: Omit<WorkspaceLink, 'id' | 'createdAt' | 'status'>) {
  if (!firestore) throw new Error('Workspace linking requires Firebase.')
  if (!clean(input.source.recordId) || !clean(input.target.recordId)) throw new Error('Both linked records require permanent IDs.')
  const id = workspaceLinkId(input.source, input.target, input.linkType)
  const row: WorkspaceLink = { ...input, id, createdAt: new Date().toISOString(), status: 'Active' }
  await setDoc(doc(firestore, 'workspaceLinks', id), row, { merge: false })
  return row
}

export function subscribeWorkspaceLinks(reference: WorkspaceRecordRef, receive: (links: WorkspaceLink[]) => void) {
  if (!firestore) return () => undefined
  const sourceQuery = query(collection(firestore, 'workspaceLinks'), where('source.recordId', '==', reference.recordId))
  return onSnapshot(sourceQuery, snapshot => receive(snapshot.docs.map(item => item.data() as WorkspaceLink)), () => receive([]))
}

export async function publishWorkspaceEvent(input: Omit<WorkspaceEvent, 'id' | 'occurredAt' | 'deliveryStatus' | 'attempts'>) {
  if (!firestore) throw new Error('Workspace events require Firebase.')
  if (!input.idempotencyKey.trim()) throw new Error('Workspace events require an idempotency key.')
  const reference = doc(firestore, 'workspaceEvents', input.idempotencyKey)
  const row: WorkspaceEvent = { ...input, id: input.idempotencyKey, occurredAt: new Date().toISOString(), deliveryStatus: 'Pending', attempts: 0 }
  await setDoc(reference, row, { merge: false })
  return row
}

export async function markWorkspaceEventResult(id: string, delivered: boolean, error = '') {
  if (!firestore) return
  await updateDoc(doc(firestore, 'workspaceEvents', id), {
    deliveryStatus: delivered ? 'Delivered' : 'Failed',
    lastError: error,
    deliveredAt: delivered ? new Date().toISOString() : '',
  })
}

export function subscribePendingWorkspaceEvents(receive: (events: WorkspaceEvent[]) => void) {
  if (!firestore) return () => undefined
  return onSnapshot(query(collection(firestore, 'workspaceEvents'), where('deliveryStatus', 'in', ['Pending', 'Failed'])), snapshot => receive(snapshot.docs.map(item => item.data() as WorkspaceEvent)), () => receive([]))
}

export async function recordIntegrationHealth(input: Omit<IntegrationHealth, 'id' | 'updatedAt'>) {
  if (!firestore) return false
  const id = `${input.application}:${input.service}`.toLowerCase().replaceAll(/[^a-z0-9:-]+/g, '-')
  await setDoc(doc(firestore, 'workspaceIntegrationHealth', id), { ...input, id, updatedAt: new Date().toISOString() }, { merge: true })
  return true
}

export function subscribeIntegrationHealth(receive: (rows: IntegrationHealth[]) => void) {
  if (!firestore) return () => undefined
  return onSnapshot(collection(firestore, 'workspaceIntegrationHealth'), snapshot => receive(snapshot.docs.map(item => item.data() as IntegrationHealth).sort((a, b) => a.service.localeCompare(b.service))), () => receive([]))
}

export async function appendWorkspaceAudit(event: { application: WorkspaceApplicationId; module: string; recordId: string; recordCode: string; action: string; changedFields: string; actor: string; timestamp?: string }) {
  if (!firestore) return false
  await addDoc(collection(firestore, 'workspaceAudit'), { ...event, timestamp: event.timestamp || new Date().toISOString() })
  return true
}
