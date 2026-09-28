import { collection, onSnapshot } from 'firebase/firestore'
import { firestore } from './firebase'

export type WorkspaceSearchRow = { id: string; application: 'ITMS' | 'ITSD' | 'NCR'; kind: string; reference: string; title: string; detail: string; route: string; recordId: string }

export function subscribeWorkspaceSearch(receive: (rows: WorkspaceSearchRow[]) => void) {
  if (!firestore) return () => undefined
  let tickets: WorkspaceSearchRow[] = [], requests: WorkspaceSearchRow[] = []
  const emit = () => receive([...tickets, ...requests])
  const stopTickets = onSnapshot(collection(firestore, 'supportTickets'), snapshot => {
    tickets = snapshot.docs.map(entry => { const value = entry.data(); return { id: `support-${entry.id}`, application: 'ITSD', kind: 'IT support ticket', reference: String(value.code || entry.id), title: String(value.title || 'IT support request'), detail: `${value.requesterName || value.requesterEmail || ''} · ${value.status || 'Open'} · ${value.category || ''}`, route: 'tickets', recordId: entry.id } as WorkspaceSearchRow })
    emit()
  }, () => { tickets = []; emit() })
  const stopRequests = onSnapshot(collection(firestore, 'ncrRequests'), snapshot => {
    requests = snapshot.docs.map(entry => { const value = entry.data(); const first = Array.isArray(value.items) ? value.items[0] : undefined; return { id: `ncr-${entry.id}`, application: 'NCR', kind: 'Consumable purchase request', reference: String(value.code || entry.id), title: String(first?.description || value.purpose || 'Purchase request'), detail: `${value.requesterName || value.requesterEmail || ''} · ${value.state || 'Submitted'} · ${value.departmentName || value.department || ''}`, route: 'tracking', recordId: entry.id } as WorkspaceSearchRow })
    emit()
  }, () => { requests = []; emit() })
  return () => { stopTickets(); stopRequests() }
}
