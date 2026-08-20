import { useMemo, useState, type FormEvent } from 'react'
import DataTable from '../../components/DataTable'
import { useLocalStore } from '../../lib/localStore'

type Department = { id: string; code: string; name: string; status: string }
type User = { id: string; employeeCode: string; name: string; departmentId: string; status: string }
type Asset = { id: string; assetId: string; modelId: string; serialNumber: string; stockStatus: string }
type Model = { id: string; brand: string; name: string }
type Allocation = { userId: string; assetIds: string[]; allocationDate: string; state: string }
export type AssetDisposition = 'In stock' | 'Under repair' | 'Scrap'
export type CustodyMovement = { id: string; code: string; kind: 'Transfer' | 'Return'; assetId: string; fromUserId: string; toDepartmentId: string; toUserId: string; disposition?: AssetDisposition; plannedDate: string; effectiveDate: string; reason: string; state: 'Pending Asset Manager' | 'Pending IT Head' | 'Completed'; requestedBy: string; requestedAt: string; assetManagerApprovedAt: string; itHeadApprovedAt: string }

const today = () => new Date().toISOString().slice(0, 10)
type MovementForm = { kind: 'Transfer' | 'Return'; assetId: string; toDepartmentId: string; toUserId: string; disposition: AssetDisposition; plannedDate: string; effectiveDate: string; reason: string }
const blank: MovementForm = { kind: 'Transfer', assetId: '', toDepartmentId: '', toUserId: '', disposition: 'In stock', plannedDate: today(), effectiveDate: today(), reason: '' }

export function deriveCustody(allocations: Allocation[], movements: CustodyMovement[], assets: Asset[]) {
  const custody = new Map<string, { userId: string; since: string; source: string }>()
  allocations.filter((item) => item.state === 'Active custody').forEach((item) => item.assetIds.forEach((assetId) => {
    if (assets.some((asset) => asset.id === assetId)) custody.set(assetId, { userId: item.userId, since: item.allocationDate, source: 'Allocation' })
  }))
  movements.filter((item) => item.state === 'Completed').forEach((item) => {
    if (item.kind === 'Return') custody.delete(item.assetId)
    else custody.set(item.assetId, { userId: item.toUserId, since: item.effectiveDate, source: item.code })
  })
  return custody
}

export default function CustodyMovements() {
  const [departments] = useLocalStore<Department[]>('itms.departments.v1', [])
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [allocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [movements, setMovements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [form, setForm] = useState(blank)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const custody = useMemo(() => deriveCustody(allocations, movements, assets), [allocations, movements, assets])
  const pendingAssets = new Set(movements.filter((item) => item.state !== 'Completed').map((item) => item.assetId))
  const available = assets.filter((asset) => custody.has(asset.id) && !pendingAssets.has(asset.id))
  const targetUsers = users.filter((user) => user.status === 'Active' && user.departmentId === form.toDepartmentId && user.id !== custody.get(form.assetId)?.userId)
  const label = (assetId: string) => { const asset = assets.find((item) => item.id === assetId); const model = models.find((item) => item.id === asset?.modelId); return `${asset?.assetId ?? 'Unavailable'} · ${model ? `${model.brand} ${model.name}` : 'Model unavailable'}` }
  const userLabel = (id: string) => { const user = users.find((item) => item.id === id); return user ? `${user.employeeCode} · ${user.name}` : 'Unavailable' }
  const stamp = (value: string) => value ? new Date(value).toLocaleString('en-IN') : 'Pending'

  function create(event: FormEvent) {
    event.preventDefault()
    const fromUserId = custody.get(form.assetId)?.userId
    if (!fromUserId || (form.kind === 'Transfer' && !form.toUserId)) return
    const record: CustodyMovement = { id: crypto.randomUUID(), code: `MOVE-${new Date().getFullYear()}-${String(movements.length + 1).padStart(4, '0')}`, ...form, fromUserId, toDepartmentId: form.kind === 'Return' ? '' : form.toDepartmentId, toUserId: form.kind === 'Return' ? '' : form.toUserId, state: 'Pending Asset Manager', requestedBy: 'dev@glasscolabs.com', requestedAt: new Date().toISOString(), assetManagerApprovedAt: '', itHeadApprovedAt: '' }
    setMovements((current) => [...current, record]); setForm(blank); setOpen(false); setMessage(`${record.code} submitted for IT Asset Manager approval.`)
  }
  function managerApprove(id: string) { setMovements((current) => current.map((item) => item.id === id ? { ...item, state: 'Pending IT Head', assetManagerApprovedAt: new Date().toISOString() } : item)); setMessage('Asset Manager approval recorded.') }
  function headApprove(id: string) {
    const record = movements.find((item) => item.id === id); if (!record) return
    setMovements((current) => current.map((item) => item.id === id ? { ...item, state: 'Completed', itHeadApprovedAt: new Date().toISOString() } : item))
    setAssets((current) => current.map((asset) => asset.id === record.assetId ? { ...asset, stockStatus: record.kind === 'Return' ? (record.disposition ?? 'In stock') : 'Allocated' } : asset))
    setMessage(`${record.code} completed. ${record.kind === 'Return' ? 'Asset awaits inspection before restocking.' : 'New employee custody is active.'}`)
  }

  return <section className="master-panel custody-panel">
    <div className="operation-heading"><div><span className="eyebrow">CONTROLLED CUSTODY MOVEMENTS</span><h2>Transfers and returns</h2><p>Preserve the complete custody chain through dual approval and effective dates.</p></div><button className="primary-action" type="button" onClick={() => setOpen(!open)}>＋ New movement</button></div>
    {open && <form className="master-form allocation-form" onSubmit={create}>
      <label>Movement type<select value={form.kind} onChange={(event) => setForm({ ...blank, kind: event.target.value as 'Transfer' | 'Return' })}><option>Transfer</option><option>Return</option></select></label>
      <label>Currently allocated asset<select required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value, toUserId: '' })}><option value="">Select asset</option>{available.map((asset) => <option value={asset.id} key={asset.id}>{label(asset.id)} · {userLabel(custody.get(asset.id)?.userId ?? '')}</option>)}</select></label>
      {form.kind === 'Transfer' && <><label>New department<select required value={form.toDepartmentId} onChange={(event) => setForm({ ...form, toDepartmentId: event.target.value, toUserId: '' })}><option value="">Select department</option>{departments.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>New employee<select required disabled={!form.toDepartmentId} value={form.toUserId} onChange={(event) => setForm({ ...form, toUserId: event.target.value })}><option value="">Select employee</option>{targetUsers.map((item) => <option value={item.id} key={item.id}>{item.employeeCode} · {item.name}</option>)}</select></label></>}
      {form.kind === 'Return' && <label>Return disposition<select required value={form.disposition} onChange={(event) => setForm({ ...form, disposition: event.target.value as AssetDisposition })}><option>In stock</option><option>Under repair</option><option>Scrap</option></select></label>}
      <label>Planned date<input required type="date" value={form.plannedDate} onChange={(event) => setForm({ ...form, plannedDate: event.target.value })} /></label><label>Effective date<input required type="date" min={form.plannedDate} value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></label>
      <label className="wide-field">Reason / handover note<textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <div className="approval-preview"><strong>Approval route</strong><span>1. IT Asset Manager</span><span>2. IT Head</span><span>3. Custody ledger updates</span></div><div className="form-actions"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-action" type="submit">Submit movement</button></div>
    </form>}
    {message && <div className="success-message">✓ {message}</div>}
    <div className="master-summary"><div><span>Movement records</span><strong>{movements.length}</strong></div><div><span>Pending approval</span><strong>{movements.filter((item) => item.state !== 'Completed').length}</strong></div><div><span>Completed</span><strong>{movements.filter((item) => item.state === 'Completed').length}</strong></div></div>
    <DataTable rows={[...movements].reverse()} rowKey={(item) => item.id} columns={[
      { key: 'code', label: 'Movement', sticky: true, width: '180px', render: (item) => <><strong>{item.code}</strong><small>{item.kind}</small></> }, { key: 'asset', label: 'Asset', width: '260px', render: (item) => label(item.assetId) }, { key: 'from', label: 'From employee', width: '220px', render: (item) => userLabel(item.fromUserId) }, { key: 'to', label: 'To / disposition', width: '220px', render: (item) => item.kind === 'Return' ? 'IT stock inspection' : userLabel(item.toUserId) }, { key: 'date', label: 'Effective date', width: '130px', render: (item) => item.effectiveDate }, { key: 'state', label: 'Status', width: '170px', render: (item) => <span className={`custody-state ${item.state === 'Completed' ? 'active' : 'pending'}`}>{item.state}</span> }, { key: 'trail', label: 'Approval history', width: '300px', render: (item) => <><small>Requested {stamp(item.requestedAt)}</small><small>Manager {stamp(item.assetManagerApprovedAt)}</small><small>IT Head {stamp(item.itHeadApprovedAt)}</small></> }, { key: 'action', label: 'Action', width: '170px', render: (item) => item.state === 'Pending Asset Manager' ? <button className="table-action" type="button" onClick={() => managerApprove(item.id)}>Manager approve</button> : item.state === 'Pending IT Head' ? <button className="table-action" type="button" onClick={() => headApprove(item.id)}>IT Head approve</button> : 'Completed' },
    ]} empty={<div className="empty-state"><strong>No transfer or return records</strong><p>Create a movement when custody must change.</p></div>} />
  </section>
}
