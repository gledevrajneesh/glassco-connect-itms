import { useLocalStore } from './localStore'
import { firebaseAuth } from './firebase'
import { appendWorkspaceAudit, type WorkspaceApplicationId } from './workspaceIntegration'

export type MasterAuditEvent = { id: string; module: string; recordId: string; recordCode: string; action: 'Created' | 'Updated' | 'Status changed'; changedFields: string; actor: string; timestamp: string }

export function useMasterAudit() {
  const [events, setEvents] = useLocalStore<MasterAuditEvent[]>('itms.master-audit.v1', [])
  function record(event: Omit<MasterAuditEvent, 'id' | 'actor' | 'timestamp'>) {
    const actor = firebaseAuth?.currentUser?.email?.toLowerCase() || 'system'
    const timestamp = new Date().toISOString()
    setEvents((current) => [...current, { ...event, id: `audit-${crypto.randomUUID()}`, actor, timestamp }])
    void appendWorkspaceAudit({ application: 'itms' as WorkspaceApplicationId, ...event, actor, timestamp })
  }
  return { events, record }
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const ignored = new Set(['id'])
  const changed = Object.keys(after).filter((key) => !ignored.has(key) && before[key] !== after[key])
  return changed.length ? changed.join(', ') : 'No field changes'
}
