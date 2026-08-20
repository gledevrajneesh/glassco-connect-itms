import { useLocalStore } from './localStore'

export type MasterAuditEvent = { id: string; module: string; recordId: string; recordCode: string; action: 'Created' | 'Updated' | 'Status changed'; changedFields: string; actor: string; timestamp: string }

export function useMasterAudit() {
  const [events, setEvents] = useLocalStore<MasterAuditEvent[]>('itms.master-audit.v1', [])
  function record(event: Omit<MasterAuditEvent, 'id' | 'actor' | 'timestamp'>) {
    setEvents((current) => [...current, { ...event, id: `audit-${crypto.randomUUID()}`, actor: 'dev@glasscolabs.com', timestamp: new Date().toISOString() }])
  }
  return { events, record }
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const ignored = new Set(['id'])
  const changed = Object.keys(after).filter((key) => !ignored.has(key) && before[key] !== after[key])
  return changed.length ? changed.join(', ') : 'No field changes'
}
