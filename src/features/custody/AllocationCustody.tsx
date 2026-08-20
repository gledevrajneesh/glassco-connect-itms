import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'
import RelationshipLedger from './RelationshipLedger'
import CustodyMovements from './CustodyMovements'
import { deriveCustody, type CustodyMovement } from '../../lib/custodyLifecycle'
import EmployeeLifecycle from './EmployeeLifecycle'
import LifecycleIntegrity from './LifecycleIntegrity'
import DataTable from '../../components/DataTable'

type Status = 'Active' | 'Inactive'
type Department = { id: string; code: string; name: string; status: Status }
type User = { id: string; employeeCode: string; name: string; email: string; departmentId: string; status: Status }
type Asset = { id: string; assetId: string; modelId: string; serialNumber: string; stockStatus: string }
type AssetType = { id: string; code: string; name: string; status: Status }
type Model = { id: string; brand: string; name: string; typeId: string }
type ApprovalState = 'Pending Asset Manager' | 'Pending IT Head' | 'Active custody' | 'Cancelled' | 'Closed - offboarded' | 'Closed - replaced'
type AllocationKind = 'New allocation' | 'Replacement' | 'Temporary issue'
type Allocation = { id: string; code: string; departmentId: string; userId: string; assetIds: string[]; allocationKind?: AllocationKind; replacementAssetId?: string; allocationDate: string; expectedReturnDate: string; purpose: string; state: ApprovalState; requestedBy: string; requestedAt: string; assetManagerApprovedAt: string; itHeadApprovedAt: string }

const today = () => new Date().toISOString().slice(0, 10)
const blankForm = { departmentId: '', userId: '', assetIds: [] as string[], allocationKind: 'New allocation' as AllocationKind, replacementAssetId: '', allocationDate: today(), expectedReturnDate: '', purpose: '' }

export default function AllocationCustody() {
  const [workspace, setWorkspace] = useState<'Allocation workflow' | 'Transfers & returns' | 'Onboarding & offboarding' | 'Relationship ledger' | 'Integrity checks'>('Allocation workflow')
  const [departments] = useLocalStore<Department[]>('itms.departments.v1', [])
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [assetTypes] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [allocations, setAllocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [movements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [form, setForm] = useState(blankForm)
  const [formOpen, setFormOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [message, setMessage] = useState('')

  const departmentUsers = users.filter((user) => user.status === 'Active' && user.departmentId === form.departmentId)
  const currentCustody = useMemo(() => deriveCustody(allocations, movements, assets), [allocations, movements, assets])
  const committedAssetIds = useMemo(() => new Set([...currentCustody.keys(), ...allocations.filter((allocation) => allocation.state === 'Pending Asset Manager' || allocation.state === 'Pending IT Head').flatMap((allocation) => allocation.assetIds)]), [allocations, currentCustody])
  const eligibleAssets = assets.filter((asset) => asset.stockStatus === 'In stock' && !committedAssetIds.has(asset.id))
  const availableCategoryIds = useMemo(() => new Set(eligibleAssets.map((asset) => models.find((model) => model.id === asset.modelId)?.typeId).filter(Boolean)), [eligibleAssets, models])
  const categoryAssets = eligibleAssets.filter((asset) => models.find((model) => model.id === asset.modelId)?.typeId === categoryId)
  const activeCustody = allocations.filter((allocation) => allocation.state === 'Active custody')
  const employeeCustodyAssetIds = new Set(activeCustody.filter((allocation) => allocation.userId === form.userId).flatMap((allocation) => allocation.assetIds))
  const employeeCustodyAssets = assets.filter((asset) => employeeCustodyAssetIds.has(asset.id) && asset.stockStatus === 'Allocated')
  const categoryCustodyAssets = employeeCustodyAssets.filter((asset) => models.find((model) => model.id === asset.modelId)?.typeId === categoryId)

  useEffect(() => {
    const pendingIds = new Set(allocations.filter((item) => item.state === 'Pending Asset Manager' || item.state === 'Pending IT Head').flatMap((item) => item.assetIds))
    setAssets((current) => {
      let changed = false
      const next = current.map((asset) => {
        const expected = currentCustody.has(asset.id) ? 'Allocated' : pendingIds.has(asset.id) ? 'Reserved' : asset.stockStatus
        if (expected !== asset.stockStatus) { changed = true; return { ...asset, stockStatus: expected } }
        return asset
      })
      return changed ? next : current
    })
  }, [allocations, currentCustody, setAssets])

  function nextCode() { return `ALLOC-${new Date().getFullYear()}-${String(allocations.length + 1).padStart(4, '0')}` }
  function closeForm() { setFormOpen(false); setForm(blankForm); setCategoryId('') }
  function changeCategory(value: string) { setCategoryId(value); setForm((current) => ({ ...current, assetIds: [], replacementAssetId: '' })) }
  function toggleAsset(assetId: string) { setForm((current) => ({ ...current, assetIds: current.assetIds.includes(assetId) ? current.assetIds.filter((id) => id !== assetId) : [...current.assetIds, assetId] })) }

  function createAllocation(event: FormEvent) {
    event.preventDefault()
    if (form.assetIds.length === 0 || (form.allocationKind === 'Replacement' && !form.replacementAssetId)) return
    const allocation: Allocation = { id: `allocation-${crypto.randomUUID()}`, code: nextCode(), ...form, state: 'Pending Asset Manager', requestedBy: 'dev@glasscolabs.com', requestedAt: new Date().toISOString(), assetManagerApprovedAt: '', itHeadApprovedAt: '' }
    setAllocations((current) => [...current, allocation])
    setAssets((current) => current.map((asset) => allocation.assetIds.includes(asset.id) ? { ...asset, stockStatus: 'Reserved' } : asset))
    setMessage(`${allocation.code} submitted for IT Asset Manager approval.`)
    closeForm()
  }

  function approveAssetManager(id: string) {
    setAllocations((current) => current.map((allocation) => allocation.id === id && allocation.state === 'Pending Asset Manager' ? { ...allocation, state: 'Pending IT Head', assetManagerApprovedAt: new Date().toISOString() } : allocation))
    setMessage('IT Asset Manager approval recorded. IT Head approval is now required.')
  }

  function approveITHead(id: string) {
    const allocation = allocations.find((item) => item.id === id)
    if (!allocation || allocation.state !== 'Pending IT Head') return
    setAllocations((current) => current.map((item) => {
      if (item.id === id) return { ...item, state: 'Active custody', itHeadApprovedAt: new Date().toISOString() }
      if (allocation.allocationKind === 'Replacement' && allocation.replacementAssetId && item.state === 'Active custody' && item.assetIds.includes(allocation.replacementAssetId)) {
        const remaining = item.assetIds.filter((assetId) => assetId !== allocation.replacementAssetId)
        return { ...item, assetIds: remaining, state: remaining.length ? item.state : 'Closed - replaced' as ApprovalState }
      }
      return item
    }))
    setAssets((current) => current.map((asset) => allocation.assetIds.includes(asset.id) ? { ...asset, stockStatus: 'Allocated' } : allocation.allocationKind === 'Replacement' && asset.id === allocation.replacementAssetId ? { ...asset, stockStatus: 'Returned - inspection pending' } : asset))
    setMessage(`${allocation.code} approved. Custody is now active and assets are marked Allocated.`)
  }

  function cancelAllocation(id: string) {
    const allocation = allocations.find((item) => item.id === id)
    if (!allocation || (allocation.state !== 'Pending Asset Manager' && allocation.state !== 'Pending IT Head')) return
    setAllocations((current) => current.map((item) => item.id === id ? { ...item, state: 'Cancelled' } : item))
    setAssets((current) => current.map((asset) => allocation.assetIds.includes(asset.id) && asset.stockStatus === 'Reserved' ? { ...asset, stockStatus: 'In stock' } : asset))
    setMessage(`${allocation.code} cancelled. Reserved assets are available in stock again.`)
  }

  function assetLabel(asset: Asset) { const model = models.find((item) => item.id === asset.modelId); return `${asset.assetId} · ${model ? `${model.brand} ${model.name}` : 'Model unavailable'} · ${asset.serialNumber || 'No serial'}` }
  function formatStamp(value: string) { return value ? new Date(value).toLocaleString('en-IN') : 'Pending' }

  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-04</span><h1>Allocation & Custody</h1><p>Control multi-asset issue, dual approval and accountable employee custody.</p></div><span className="phase">DUAL APPROVAL</span></section>
    <nav className="workspace-tabs" aria-label="Allocation and custody workspace">{(['Allocation workflow', 'Transfers & returns', 'Onboarding & offboarding', 'Relationship ledger', 'Integrity checks'] as const).map((item) => <button type="button" className={workspace === item ? 'selected' : ''} onClick={() => setWorkspace(item)} key={item}>{item}</button>)}</nav>
    {workspace === 'Integrity checks' ? <LifecycleIntegrity /> : workspace === 'Relationship ledger' ? <RelationshipLedger /> : workspace === 'Transfers & returns' ? <CustodyMovements /> : workspace === 'Onboarding & offboarding' ? <EmployeeLifecycle /> : <section className="master-panel custody-panel">
      <div className="operation-heading"><div><span className="eyebrow">DEPARTMENT-FIRST ALLOCATION</span><h2>Asset allocation requests</h2><p>Only active employees and uncommitted in-stock assets are available.</p></div><button type="button" className="primary-action" onClick={() => setFormOpen(!formOpen)}>＋ New allocation</button></div>
      {formOpen && <form className="master-form allocation-form" onSubmit={createAllocation}>
        <label>Department<select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value, userId: '' })}><option value="">Select department</option>{departments.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Employee<select required disabled={!form.departmentId} value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value, replacementAssetId: '' })}><option value="">{form.departmentId ? 'Select employee' : 'Select department first'}</option>{departmentUsers.map((item) => <option value={item.id} key={item.id}>{item.employeeCode} · {item.name}</option>)}</select></label>
        <label>Allocation reason<select value={form.allocationKind} onChange={(event) => setForm({ ...form, allocationKind: event.target.value as AllocationKind, replacementAssetId: '' })}><option>New allocation</option><option>Replacement</option><option>Temporary issue</option></select></label>
        <label>Asset category<select required value={categoryId} onChange={(event) => changeCategory(event.target.value)}><option value="">Select category first</option>{assetTypes.filter((item) => item.status === 'Active' && availableCategoryIds.has(item.id)).map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        {form.allocationKind === 'Replacement' && <label>Asset being replaced<select required disabled={!form.userId || !categoryId} value={form.replacementAssetId} onChange={(event) => setForm({ ...form, replacementAssetId: event.target.value })}><option value="">{!form.userId ? 'Select employee first' : !categoryId ? 'Select category first' : 'Select current asset'}</option>{categoryCustodyAssets.map((asset) => <option value={asset.id} key={asset.id}>{assetLabel(asset)}</option>)}</select></label>}
        <label>Allocation date<input required type="date" value={form.allocationDate} onChange={(event) => setForm({ ...form, allocationDate: event.target.value })} /></label>
        <label>Expected return date<input type="date" min={form.allocationDate} value={form.expectedReturnDate} onChange={(event) => setForm({ ...form, expectedReturnDate: event.target.value })} /></label>
        <label className="wide-field">Business purpose<textarea required value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="Role requirement, onboarding, replacement or temporary allocation" /></label>
        <fieldset className="asset-picker"><legend>Items to allocate <span>{form.assetIds.length} selected</span></legend>{!categoryId ? <p>Select an asset category to display its available items.</p> : categoryAssets.length ? categoryAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={form.assetIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} /><span>{assetLabel(asset)}</span></label>) : <p>No eligible in-stock items are available in this category.</p>}</fieldset>
        <div className="approval-preview"><strong>Approval route</strong><span>1. IT Asset Manager</span><span>2. IT Head</span><span>3. Custody becomes active</span></div>
        <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action" disabled={form.assetIds.length === 0}>Submit allocation</button></div>
      </form>}
      {message && <div className="success-message" role="status">✓ {message}</div>}
      <div className="master-summary"><div><span>Allocation records</span><strong>{allocations.length}</strong></div><div><span>Pending approval</span><strong>{allocations.filter((item) => item.state === 'Pending Asset Manager' || item.state === 'Pending IT Head').length}</strong></div><div><span>Active custody</span><strong>{activeCustody.length}</strong></div></div>
      <DataTable rows={[...allocations].reverse()} rowKey={(item) => item.id} columns={[
        { key: 'code', label: 'Allocation', sticky: true, width: '180px', render: (item) => <><strong>{item.code}</strong><small>{item.allocationKind ?? 'New allocation'}</small></> }, { key: 'employee', label: 'Employee', width: '210px', render: (item) => users.find((user) => user.id === item.userId)?.name ?? 'Unavailable' }, { key: 'department', label: 'Department', width: '190px', render: (item) => departments.find((department) => department.id === item.departmentId)?.name ?? 'Unavailable' }, { key: 'assets', label: 'Allocated items', width: '360px', render: (item) => item.assetIds.map((id) => assetLabel(assets.find((asset) => asset.id === id) ?? { id, assetId: 'Unavailable', modelId: '', serialNumber: '', stockStatus: '' })).join(' | ') }, { key: 'date', label: 'Allocation date', width: '130px', render: (item) => item.allocationDate }, { key: 'status', label: 'Status', width: '180px', render: (item) => <span className={`custody-state ${item.state === 'Active custody' ? 'active' : 'pending'}`}>{item.state}</span> }, { key: 'trail', label: 'Approval history', width: '290px', render: (item) => <><small>Requested {formatStamp(item.requestedAt)}</small><small>Manager {formatStamp(item.assetManagerApprovedAt)}</small><small>IT Head {formatStamp(item.itHeadApprovedAt)}</small></> }, { key: 'action', label: 'Action', width: '230px', render: (item) => item.state === 'Pending Asset Manager' ? <div className="table-actions"><button className="table-action" type="button" onClick={() => approveAssetManager(item.id)}>Manager approve</button><button className="table-action" type="button" onClick={() => cancelAllocation(item.id)}>Cancel</button></div> : item.state === 'Pending IT Head' ? <div className="table-actions"><button className="table-action" type="button" onClick={() => approveITHead(item.id)}>IT Head approve</button><button className="table-action" type="button" onClick={() => cancelAllocation(item.id)}>Cancel</button></div> : item.state },
      ]} empty={<div className="empty-state"><span>⇄</span><strong>No allocation records</strong><p>Create the first request to begin controlled custody.</p></div>} />
    </section>}
  </>
}
