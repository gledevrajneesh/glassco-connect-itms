import DataTable from '../../components/DataTable'
import { useLocalStore } from '../../lib/localStore'
import { auditLifecycleIntegrity } from '../../lib/lifecycleIntegrity'
import type { CustodyMovement } from '../../lib/custodyLifecycle'

type User = { id: string; employeeCode: string; status: string }
type Asset = { id: string; assetId: string; stockStatus: string }
type Allocation = { id: string; code: string; userId: string; assetIds: string[]; state: string }
type Lifecycle = { id: string; code: string; kind: 'Onboarding' | 'Offboarding'; userId: string; assetIds: string[]; state: string }

export default function LifecycleIntegrity() {
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [assets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [allocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [movements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [lifecycle] = useLocalStore<Lifecycle[]>('itms.employee-lifecycle.v1', [])
  const issues = auditLifecycleIntegrity(users, assets, allocations, movements, lifecycle)
  return <section className="master-panel"><div className="operation-heading"><div><span className="eyebrow">CROSS-LIFECYCLE ASSURANCE</span><h2>User–asset integrity checks</h2><p>Continuous controls across masters, inventory, custody, movements and employee lifecycle.</p></div><span className={`phase ${issues.length ? '' : 'healthy'}`}>{issues.length ? `${issues.length} EXCEPTIONS` : 'ALL CHECKS PASSED'}</span></div><div className="master-summary"><div><span>Assets tested</span><strong>{assets.length}</strong></div><div><span>Critical</span><strong>{issues.filter((item) => item.severity === 'Critical').length}</strong></div><div><span>Warnings</span><strong>{issues.filter((item) => item.severity === 'Warning').length}</strong></div></div><DataTable rows={issues} rowKey={(item) => item.id} columns={[{ key: 'severity', label: 'Severity', sticky: true, width: '140px', render: (item) => <strong>{item.severity}</strong> }, { key: 'entity', label: 'Record', width: '220px', render: (item) => item.entity }, { key: 'message', label: 'Integrity exception', width: '650px', render: (item) => item.message }]} empty={<div className="empty-state"><strong>User and asset lifecycles are aligned</strong><p>No contradictory custody, status, reservation or offboarding records were detected.</p></div>} /></section>
}
