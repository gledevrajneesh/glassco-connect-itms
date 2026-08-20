import { useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'

type Status = 'Active' | 'Inactive'
type Department = { id: string; code: string; name: string; status: Status }
type User = { id: string; employeeCode: string; name: string; email: string; departmentId: string; status: Status }
type Asset = { id: string; assetId: string; modelId: string; serialNumber: string; stockStatus: string }
type AssetType = { id: string; code: string; name: string; status: Status }
type Model = { id: string; brand: string; name: string; typeId: string }
type ApprovalState = 'Pending Asset Manager' | 'Pending IT Head' | 'Active custody'
type Allocation = { id: string; code: string; departmentId: string; userId: string; assetIds: string[]; allocationDate: string; expectedReturnDate: string; purpose: string; state: ApprovalState; requestedBy: string; requestedAt: string; assetManagerApprovedAt: string; itHeadApprovedAt: string }

const today = () => new Date().toISOString().slice(0, 10)
const blankForm = { departmentId: '', userId: '', assetIds: [] as string[], allocationDate: today(), expectedReturnDate: '', purpose: '' }

export default function AllocationCustody() {
  const [departments] = useLocalStore<Department[]>('itms.departments.v1', [])
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [assetTypes] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [allocations, setAllocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [form, setForm] = useState(blankForm)
  const [formOpen, setFormOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [message, setMessage] = useState('')

  const departmentUsers = users.filter((user) => user.status === 'Active' && user.departmentId === form.departmentId)
  const committedAssetIds = useMemo(() => new Set(allocations.flatMap((allocation) => allocation.assetIds)), [allocations])
  const eligibleAssets = assets.filter((asset) => asset.stockStatus === 'In stock' && !committedAssetIds.has(asset.id))
  const availableCategoryIds = useMemo(() => new Set(eligibleAssets.map((asset) => models.find((model) => model.id === asset.modelId)?.typeId).filter(Boolean)), [eligibleAssets, models])
  const categoryAssets = eligibleAssets.filter((asset) => models.find((model) => model.id === asset.modelId)?.typeId === categoryId)
  const activeCustody = allocations.filter((allocation) => allocation.state === 'Active custody')

  function nextCode() { return `ALLOC-${new Date().getFullYear()}-${String(allocations.length + 1).padStart(4, '0')}` }
  function closeForm() { setFormOpen(false); setForm(blankForm); setCategoryId('') }
  function changeCategory(value: string) { setCategoryId(value); setForm((current) => ({ ...current, assetIds: [] })) }
  function toggleAsset(assetId: string) { setForm((current) => ({ ...current, assetIds: current.assetIds.includes(assetId) ? current.assetIds.filter((id) => id !== assetId) : [...current.assetIds, assetId] })) }

  function createAllocation(event: FormEvent) {
    event.preventDefault()
    if (form.assetIds.length === 0) return
    const allocation: Allocation = { id: `allocation-${crypto.randomUUID()}`, code: nextCode(), ...form, state: 'Pending Asset Manager', requestedBy: 'dev@glasscolabs.com', requestedAt: new Date().toISOString(), assetManagerApprovedAt: '', itHeadApprovedAt: '' }
    setAllocations((current) => [...current, allocation])
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
    setAllocations((current) => current.map((item) => item.id === id ? { ...item, state: 'Active custody', itHeadApprovedAt: new Date().toISOString() } : item))
    setAssets((current) => current.map((asset) => allocation.assetIds.includes(asset.id) ? { ...asset, stockStatus: 'Allocated' } : asset))
    setMessage(`${allocation.code} approved. Custody is now active and assets are marked Allocated.`)
  }

  function assetLabel(asset: Asset) { const model = models.find((item) => item.id === asset.modelId); return `${asset.assetId} · ${model ? `${model.brand} ${model.name}` : 'Model unavailable'} · ${asset.serialNumber || 'No serial'}` }

  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-04</span><h1>Allocation & Custody</h1><p>Control multi-asset issue, dual approval and accountable employee custody.</p></div><span className="phase">DUAL APPROVAL</span></section>
    <section className="master-panel custody-panel">
      <div className="operation-heading"><div><span className="eyebrow">DEPARTMENT-FIRST ALLOCATION</span><h2>Asset allocation requests</h2><p>Only active employees and uncommitted in-stock assets are available.</p></div><button type="button" className="primary-action" onClick={() => setFormOpen(!formOpen)}>＋ New allocation</button></div>
      {formOpen && <form className="master-form allocation-form" onSubmit={createAllocation}>
        <label>Department<select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value, userId: '' })}><option value="">Select department</option>{departments.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Employee<select required disabled={!form.departmentId} value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}><option value="">{form.departmentId ? 'Select employee' : 'Select department first'}</option>{departmentUsers.map((item) => <option value={item.id} key={item.id}>{item.employeeCode} · {item.name}</option>)}</select></label>
        <label>Asset category<select required value={categoryId} onChange={(event) => changeCategory(event.target.value)}><option value="">Select category first</option>{assetTypes.filter((item) => item.status === 'Active' && availableCategoryIds.has(item.id)).map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Allocation date<input required type="date" value={form.allocationDate} onChange={(event) => setForm({ ...form, allocationDate: event.target.value })} /></label>
        <label>Expected return date<input type="date" min={form.allocationDate} value={form.expectedReturnDate} onChange={(event) => setForm({ ...form, expectedReturnDate: event.target.value })} /></label>
        <label className="wide-field">Business purpose<textarea required value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="Role requirement, onboarding, replacement or temporary allocation" /></label>
        <fieldset className="asset-picker"><legend>Items to allocate <span>{form.assetIds.length} selected</span></legend>{!categoryId ? <p>Select an asset category to display its available items.</p> : categoryAssets.length ? categoryAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={form.assetIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} /><span>{assetLabel(asset)}</span></label>) : <p>No eligible in-stock items are available in this category.</p>}</fieldset>
        <div className="approval-preview"><strong>Approval route</strong><span>1. IT Asset Manager</span><span>2. IT Head</span><span>3. Custody becomes active</span></div>
        <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action" disabled={form.assetIds.length === 0}>Submit allocation</button></div>
      </form>}
      {message && <div className="success-message" role="status">✓ {message}</div>}
      <div className="master-summary"><div><span>Allocation records</span><strong>{allocations.length}</strong></div><div><span>Pending approval</span><strong>{allocations.filter((item) => item.state !== 'Active custody').length}</strong></div><div><span>Active custody</span><strong>{activeCustody.length}</strong></div></div>
      <div className="records allocation-records">{[...allocations].reverse().map((allocation) => <article className="allocation-card" key={allocation.id}>
        <div className="allocation-main"><div><strong>{allocation.code} · {users.find((item) => item.id === allocation.userId)?.name ?? 'User unavailable'}</strong><span>{departments.find((item) => item.id === allocation.departmentId)?.name ?? 'Department unavailable'} · {allocation.assetIds.length} asset(s) · {allocation.allocationDate}</span><p>{allocation.purpose}</p></div><span className={`custody-state ${allocation.state === 'Active custody' ? 'active' : 'pending'}`}>{allocation.state}</span></div>
        <div className="allocated-assets">{allocation.assetIds.map((id) => <span key={id}>{assetLabel(assets.find((asset) => asset.id === id) ?? { id, assetId: 'Asset unavailable', modelId: '', serialNumber: '', stockStatus: '' })}</span>)}</div>
        <div className="approval-trail"><span className={allocation.assetManagerApprovedAt ? 'complete' : ''}>Asset Manager {allocation.assetManagerApprovedAt ? '✓' : 'pending'}</span><span className={allocation.itHeadApprovedAt ? 'complete' : ''}>IT Head {allocation.itHeadApprovedAt ? '✓' : 'pending'}</span>{allocation.state === 'Pending Asset Manager' && <button type="button" onClick={() => approveAssetManager(allocation.id)}>Approve as Asset Manager</button>}{allocation.state === 'Pending IT Head' && <button type="button" onClick={() => approveITHead(allocation.id)}>Approve as IT Head</button>}</div>
      </article>)}{allocations.length === 0 && <div className="empty-state"><span>⇄</span><strong>No allocation records</strong><p>Create the first request to begin controlled custody.</p></div>}</div>
    </section>
  </>
}
