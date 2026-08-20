import { useState } from 'react'
import { useLocalStore } from '../../lib/localStore'
import DataTable from '../../components/DataTable'

type Status = 'Active' | 'Inactive'
type Department = { id: string; code: string; name: string; status: Status }
type User = { id: string; employeeCode: string; name: string; email: string; departmentId: string; status: Status }
type Asset = { id: string; assetId: string; modelId: string; serialNumber: string; stockStatus: string }
type Model = { id: string; brand: string; name: string; typeId: string }
type Allocation = { id: string; code: string; userId: string; assetIds: string[]; allocationKind?: string; replacementAssetId?: string; allocationDate: string; purpose: string; state: string; requestedAt: string; itHeadApprovedAt: string }

export default function RelationshipLedger() {
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [departments] = useLocalStore<Department[]>('itms.departments.v1', [])
  const [assets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [allocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [view, setView] = useState<'User custody' | 'Asset custody'>('User custody')
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const activeAllocations = allocations.filter((item) => item.state === 'Active custody')
  const activeLinks = activeAllocations.flatMap((allocation) => allocation.assetIds.map((assetId) => ({ allocation, assetId }))).filter(({ assetId }) => assets.find((asset) => asset.id === assetId)?.stockStatus === 'Allocated')
  const linkedUserIds = new Set(allocations.map((item) => item.userId))
  const linkedAssetIds = new Set(allocations.flatMap((item) => [...item.assetIds, ...(item.replacementAssetId ? [item.replacementAssetId] : [])]))

  function modelLabel(modelId: string) { const model = models.find((item) => item.id === modelId); return model ? `${model.brand} ${model.name}` : 'Model unavailable' }
  function userLabel(userId: string) { const user = users.find((item) => item.id === userId); return user ? `${user.employeeCode} · ${user.name}` : 'User unavailable' }
  function stamp(value: string) { return value ? new Date(value).toLocaleString('en-IN') : 'Pending' }
  const visibleUsers = users.filter((user) => linkedUserIds.has(user.id) && (!query || `${user.employeeCode} ${user.name} ${user.email}`.toLowerCase().includes(query)))
  const visibleAssets = assets.filter((asset) => linkedAssetIds.has(asset.id) && (!query || `${asset.assetId} ${asset.serialNumber} ${modelLabel(asset.modelId)}`.toLowerCase().includes(query)))

  return <section className="master-panel relationship-ledger">
    <div className="operation-heading"><div><span className="eyebrow">EMPLOYEE–ASSET RELATIONSHIP LEDGER</span><h2>Two-way custody history</h2><p>Current possession and historical relationships are calculated from governed allocation transactions.</p></div></div>
    <div className="ledger-controls"><div className="master-tabs">{(['User custody', 'Asset custody'] as const).map((item) => <button type="button" className={view === item ? 'selected' : ''} onClick={() => setView(item)} key={item}>{item}</button>)}</div><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'User custody' ? 'Employee code, name or email' : 'Asset ID, serial or model'} /></label></div>
    <div className="master-summary"><div><span>People with history</span><strong>{linkedUserIds.size}</strong></div><div><span>Assets with history</span><strong>{linkedAssetIds.size}</strong></div><div><span>Active custody links</span><strong>{activeLinks.length}</strong></div></div>
    {view === 'User custody' ? <DataTable rows={visibleUsers} rowKey={(item) => item.id} columns={[
      { key: 'employee', label: 'Employee', sticky: true, width: '220px', render: (item) => <><strong>{item.employeeCode}</strong><small>{item.name}</small></> }, { key: 'department', label: 'Department', width: '190px', render: (item) => departments.find((department) => department.id === item.departmentId)?.name ?? 'Unavailable' }, { key: 'email', label: 'Email', width: '230px', render: (item) => item.email }, { key: 'current', label: 'Current assets', width: '420px', render: (item) => { const links = activeLinks.filter((link) => link.allocation.userId === item.id); return links.length ? links.map((link) => { const asset = assets.find((candidate) => candidate.id === link.assetId); return `${asset?.assetId ?? 'Unavailable'} · ${modelLabel(asset?.modelId ?? '')}` }).join(' | ') : 'No active custody' } }, { key: 'count', label: 'Current count', width: '110px', render: (item) => activeLinks.filter((link) => link.allocation.userId === item.id).length }, { key: 'history', label: 'Historical transactions', width: '430px', render: (item) => { const history = allocations.filter((allocation) => allocation.userId === item.id); return history.length ? [...history].reverse().map((allocation) => `${allocation.code} · ${allocation.allocationKind ?? 'New allocation'} · ${stamp(allocation.itHeadApprovedAt || allocation.requestedAt)}`).join(' | ') : 'No history' } },
    ]} empty={<div className="empty-state"><span>⇄</span><strong>No matching relationships</strong><p>Complete an allocation or change the search criteria.</p></div>} /> : <DataTable rows={visibleAssets} rowKey={(item) => item.id} columns={[
      { key: 'asset', label: 'Asset ID', sticky: true, width: '190px', render: (item) => <strong>{item.assetId}</strong> }, { key: 'model', label: 'Brand / model', width: '240px', render: (item) => modelLabel(item.modelId) }, { key: 'serial', label: 'Serial number', width: '170px', render: (item) => item.serialNumber || 'Not applicable' }, { key: 'status', label: 'Lifecycle status', width: '190px', render: (item) => item.stockStatus }, { key: 'custodian', label: 'Current custodian', width: '260px', render: (item) => { const current = [...activeLinks].reverse().find((link) => link.assetId === item.id); return current ? `${userLabel(current.allocation.userId)} · since ${current.allocation.allocationDate}` : 'None' } }, { key: 'history', label: 'Custody history', width: '430px', render: (item) => { const history = allocations.filter((allocation) => allocation.assetIds.includes(item.id) || allocation.replacementAssetId === item.id); return history.length ? [...history].reverse().map((allocation) => `${allocation.code} · ${allocation.replacementAssetId === item.id ? 'Replaced/returned' : userLabel(allocation.userId)} · ${stamp(allocation.itHeadApprovedAt || allocation.requestedAt)}`).join(' | ') : 'No history' } },
    ]} empty={<div className="empty-state"><span>⇄</span><strong>No matching relationships</strong><p>Complete an allocation or change the search criteria.</p></div>} />}
  </section>
}
