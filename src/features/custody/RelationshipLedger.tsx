import { useState } from 'react'
import { useLocalStore } from '../../lib/localStore'

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
    <div className="ledger-records">
      {view === 'User custody' ? visibleUsers.map((user) => {
        const current = activeLinks.filter((link) => link.allocation.userId === user.id)
        const history = [...allocations].filter((item) => item.userId === user.id).reverse()
        return <article className="ledger-card" key={user.id}><header><div><strong>{user.employeeCode} · {user.name}</strong><span>{departments.find((item) => item.id === user.departmentId)?.name ?? 'Department unavailable'} · {user.email}</span></div><span className="ledger-count">{current.length} current</span></header><div className="ledger-current"><b>Current assets</b>{current.length ? current.map(({ assetId, allocation }) => { const asset = assets.find((item) => item.id === assetId); return <span key={`${allocation.id}-${assetId}`}>{asset?.assetId ?? 'Asset unavailable'} · {modelLabel(asset?.modelId ?? '')} · since {allocation.allocationDate}</span> }) : <span>No active asset custody</span>}</div><details><summary>History · {history.length} transaction(s)</summary>{history.map((item) => <div className="ledger-event" key={item.id}><strong>{item.code} · {item.allocationKind ?? 'New allocation'} · {item.state}</strong><span>{item.assetIds.map((id) => assets.find((asset) => asset.id === id)?.assetId ?? 'Unavailable').join(', ')} · {stamp(item.itHeadApprovedAt || item.requestedAt)}</span>{item.replacementAssetId && <span>Replaced {assets.find((asset) => asset.id === item.replacementAssetId)?.assetId ?? 'Unavailable'}</span>}</div>)}</details></article>
      }) : visibleAssets.map((asset) => {
        const history = allocations.filter((item) => item.assetIds.includes(asset.id) || item.replacementAssetId === asset.id)
        const current = [...activeLinks].reverse().find((link) => link.assetId === asset.id)
        return <article className="ledger-card" key={asset.id}><header><div><strong>{asset.assetId} · {modelLabel(asset.modelId)}</strong><span>Serial {asset.serialNumber || 'Not applicable'} · {asset.stockStatus}</span></div><span className={`status ${current ? 'active' : 'inactive'}`}>{current ? 'In custody' : 'No active custody'}</span></header><div className="ledger-current"><b>Current custodian</b><span>{current ? `${userLabel(current.allocation.userId)} · since ${current.allocation.allocationDate}` : 'None'}</span></div><details><summary>History · {history.length} transaction(s)</summary>{[...history].reverse().map((item) => <div className="ledger-event" key={item.id}><strong>{item.code} · {item.replacementAssetId === asset.id ? 'Replaced asset returned' : item.allocationKind ?? 'New allocation'}</strong><span>{userLabel(item.userId)} · {item.state} · {stamp(item.itHeadApprovedAt || item.requestedAt)}</span></div>)}</details></article>
      })}
      {(view === 'User custody' ? visibleUsers.length === 0 : visibleAssets.length === 0) && <div className="empty-state"><span>⇄</span><strong>No matching relationships</strong><p>Complete an allocation or change the search criteria.</p></div>}
    </div>
  </section>
}
