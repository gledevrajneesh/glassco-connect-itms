import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'
import DataTable from '../../components/DataTable'
import Icon from '../../components/Icon'
import type { CustodyMovement } from '../../lib/custodyLifecycle'

type Status = 'Active' | 'Inactive'
type Vendor = { id: string; code: string; name: string; status: Status }
type AssetType = { id: string; code: string; name: string; trackingMode?: string; status: Status }
type AssetModel = { id: string; code: string; name: string; typeId: string; brand: string; warrantyMonths: string; status: Status }
type ConfigProfile = { id: string; code: string; name: string; typeId: string; specification: string; status: Status }
type Location = { id: string; code: string; name: string; status: Status }
type ReceiptOutcome = 'Accepted' | 'Quarantined' | 'Rejected'
type Receipt = { id: string; grn: string; vendorId: string; invoiceNumber: string; purchaseOrder: string; receivedDate: string; receivedBy: string; typeId: string; modelId: string; quantity: number; outcome: ReceiptOutcome; inspectionNote: string; createdAt: string }
type Asset = { id: string; assetId: string; receiptId: string; typeId: string; modelId: string; serialNumber: string; locationId: string; configId: string; purchaseDate: string; cost: number; condition: string; stockStatus: string; createdAt: string }
type Allocation = { id: string; code: string; userId: string; assetIds: string[]; replacementAssetId?: string; allocationKind?: string; allocationDate: string; state: string; requestedAt: string; itHeadApprovedAt: string }
type User = { id: string; employeeCode: string; name: string }
type Lifecycle = { id: string; code: string; kind: 'Onboarding' | 'Offboarding'; userId: string; assetIds: string[]; disposition?: string; state: string; createdAt: string; effectiveDate: string }

const today = () => new Date().toISOString().slice(0, 10)
const newReceipt = { vendorId: '', invoiceNumber: '', purchaseOrder: '', receivedDate: today(), receivedBy: 'dev@glasscolabs.com', typeId: '', modelId: '', quantity: '1', outcome: 'Accepted' as ReceiptOutcome, inspectionNote: '' }
const newAsset = { receiptId: '', serialNumber: '', locationId: '', configId: '', purchaseDate: today(), cost: '', condition: 'New', stockStatus: 'In stock' }

const demoReceipts: Receipt[] = [
  { id: 'demo-receipt-laptop', grn: 'GRN-DEMO-0001', vendorId: 'demo-vendor-VND-DELL', purchaseOrder: 'DEMO-PO-1001', invoiceNumber: 'DEMO-INV-1001', receivedDate: '2026-08-01', receivedBy: 'Demo Store Receiver', typeId: 'type-default-LAPTOP', modelId: 'demo-model-LAT-5440', quantity: 2, outcome: 'Accepted', inspectionNote: 'Demo stock accepted after visual inspection.', createdAt: '2026-08-01T09:00:00.000Z' },
  { id: 'demo-receipt-hp', grn: 'GRN-DEMO-0002', vendorId: 'demo-vendor-VND-HP', purchaseOrder: 'DEMO-PO-1002', invoiceNumber: 'DEMO-INV-1002', receivedDate: '2026-08-02', receivedBy: 'Demo Store Receiver', typeId: 'type-default-LAPTOP', modelId: 'demo-model-ELITE-840', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo stock accepted after visual inspection.', createdAt: '2026-08-02T09:00:00.000Z' },
  { id: 'demo-receipt-monitor', grn: 'GRN-DEMO-0003', vendorId: 'demo-vendor-VND-DELL', purchaseOrder: 'DEMO-PO-1003', invoiceNumber: 'DEMO-INV-1003', receivedDate: '2026-08-03', receivedBy: 'Demo Store Receiver', typeId: 'type-default-MONITOR', modelId: 'demo-model-P2422H', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo display accepted after visual inspection.', createdAt: '2026-08-03T09:00:00.000Z' },
  { id: 'demo-receipt-switch', grn: 'GRN-DEMO-0004', vendorId: 'demo-vendor-VND-CISCO', purchaseOrder: 'DEMO-PO-1004', invoiceNumber: 'DEMO-INV-1004', receivedDate: '2026-08-04', receivedBy: 'Demo Store Receiver', typeId: 'type-default-SWITCH', modelId: 'demo-model-CBS350', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo network equipment accepted after inspection.', createdAt: '2026-08-04T09:00:00.000Z' },
]

const demoAssets: Asset[] = [
  ['GL-IT-DEMO-001', 'demo-receipt-laptop', 'LAPTOP', 'LAT-5440', 'DEMO-LAT-001', 'LAP-STD', 72500], ['GL-IT-DEMO-002', 'demo-receipt-laptop', 'LAPTOP', 'LAT-5440', 'DEMO-LAT-002', 'LAP-STD', 72500], ['GL-IT-DEMO-003', 'demo-receipt-hp', 'LAPTOP', 'ELITE-840', 'DEMO-HP-001', 'LAP-PRO', 88500], ['GL-IT-DEMO-004', 'demo-receipt-monitor', 'MONITOR', 'P2422H', 'DEMO-MON-001', 'MON-24', 14500], ['GL-IT-DEMO-005', 'demo-receipt-switch', 'SWITCH', 'CBS350', 'DEMO-SW-001', 'SW-24P', 42000],
].map(([assetId, receiptId, type, model, serialNumber, config, cost]) => ({ id: `demo-asset-${assetId}`, assetId: String(assetId), receiptId: String(receiptId), typeId: `type-default-${type}`, modelId: `demo-model-${model}`, serialNumber: String(serialNumber), locationId: 'demo-location-AMB-HO', configId: `demo-config-${config}`, purchaseDate: '2026-08-01', cost: Number(cost), condition: 'New', stockStatus: 'In stock', createdAt: '2026-08-01T10:00:00.000Z' }))

export default function InventoryOperations({ mode }: { mode: 'Goods receipt' | 'Asset register' }) {
  const [vendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<AssetModel[]>('itms.asset-models.v1', [])
  const [profiles] = useLocalStore<ConfigProfile[]>('itms.config-profiles.v1', [])
  const [locations] = useLocalStore<Location[]>('itms.locations.v1', [])
  const [receipts, setReceipts] = useLocalStore<Receipt[]>('itms.receipts.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [allocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [movements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [lifecycle] = useLocalStore<Lifecycle[]>('itms.employee-lifecycle.v1', [])
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [receiptForm, setReceiptForm] = useState(newReceipt)
  const [assetForm, setAssetForm] = useState(newAsset)

  useEffect(() => {
    setReceipts((current) => [...current, ...demoReceipts.filter((seed) => !current.some((item) => item.grn === seed.grn))])
    setAssets((current) => [...current, ...demoAssets.filter((seed) => !current.some((item) => item.assetId === seed.assetId))])
  }, [setAssets, setReceipts])
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assetSearch, setAssetSearch] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')

  const acceptedReceipts = useMemo(() => receipts.filter((receipt) => receipt.outcome === 'Accepted' && assets.filter((asset) => asset.receiptId === receipt.id).length < receipt.quantity), [assets, receipts])
  const selectedReceipt = receipts.find((receipt) => receipt.id === assetForm.receiptId)
  const selectedType = types.find((item) => item.id === selectedReceipt?.typeId)
  const registeredForSelected = selectedReceipt ? assets.filter((asset) => asset.receiptId === selectedReceipt.id).length : 0
  const assetStatuses = [...new Set(assets.map((asset) => asset.stockStatus))].sort()
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase()
    return assets.filter((asset) => {
      const model = models.find((item) => item.id === asset.modelId)
      return (categoryFilter === 'all' || asset.typeId === categoryFilter) && (statusFilter === 'all' || asset.stockStatus === statusFilter) && (!query || `${asset.assetId} ${asset.serialNumber} ${model?.brand ?? ''} ${model?.name ?? ''}`.toLowerCase().includes(query))
    })
  }, [assetSearch, assets, categoryFilter, models, statusFilter])
  const selectedAssetRecord = assets.find((asset) => asset.id === selectedAssetId)
  const categoryCounts = types.map((type) => ({ ...type, count: assets.filter((asset) => asset.typeId === type.id).length })).filter((item) => item.count > 0)

  function userLabel(id: string) { const user = users.find((item) => item.id === id); return user ? `${user.employeeCode} · ${user.name}` : 'User unavailable' }
  function assetHistory(asset: Asset) {
    const receipt = receipts.find((item) => item.id === asset.receiptId)
    const events: { id: string; at: string; title: string; detail: string }[] = [{ id: `registered-${asset.id}`, at: asset.createdAt, title: 'Asset registered', detail: `Created as ${asset.stockStatus} · purchase date ${asset.purchaseDate}` }]
    if (receipt) events.push({ id: `receipt-${receipt.id}`, at: receipt.createdAt, title: `Purchased / received · ${receipt.grn}`, detail: `Invoice ${receipt.invoiceNumber} · ${vendors.find((item) => item.id === receipt.vendorId)?.name ?? 'Vendor unavailable'} · outcome ${receipt.outcome}` })
    allocations.filter((item) => item.assetIds.includes(asset.id) || item.replacementAssetId === asset.id).forEach((item) => events.push({ id: `allocation-${item.id}`, at: item.itHeadApprovedAt || item.requestedAt, title: `${item.code} · ${item.replacementAssetId === asset.id ? 'Replaced / released' : item.allocationKind ?? 'Allocation'}`, detail: `${userLabel(item.userId)} · ${item.state}` }))
    movements.filter((item) => item.assetId === asset.id).forEach((item) => events.push({ id: `movement-${item.id}`, at: item.itHeadApprovedAt || item.requestedAt, title: `${item.code} · ${item.kind}`, detail: item.kind === 'Transfer' ? `${userLabel(item.fromUserId)} → ${userLabel(item.toUserId)} · ${item.state}` : `${userLabel(item.fromUserId)} → ${item.disposition ?? 'Return processing'} · ${item.state}` }))
    lifecycle.filter((item) => item.assetIds.includes(asset.id)).forEach((item) => events.push({ id: `lifecycle-${item.id}`, at: item.createdAt, title: `${item.code} · Employee ${item.kind}`, detail: `${userLabel(item.userId)} · ${item.state}${item.disposition ? ` · ${item.disposition}` : ''}` }))
    return events.sort((a, b) => b.at.localeCompare(a.at))
  }

  function nextCode(prefix: string, count: number) { return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}` }
  function closeForm() { setFormOpen(false); setReceiptForm(newReceipt); setAssetForm(newAsset) }

  function saveReceipt(event: FormEvent) {
    event.preventDefault()
    const receipt: Receipt = { id: `receipt-${crypto.randomUUID()}`, grn: nextCode('GRN', receipts.length), ...receiptForm, quantity: Number(receiptForm.quantity), invoiceNumber: receiptForm.invoiceNumber.trim(), purchaseOrder: receiptForm.purchaseOrder.trim(), inspectionNote: receiptForm.inspectionNote.trim(), createdAt: new Date().toISOString() }
    setReceipts((current) => [...current, receipt])
    setMessage(`${receipt.grn} recorded with outcome ${receipt.outcome}.`)
    closeForm()
  }

  function saveAsset(event: FormEvent) {
    event.preventDefault()
    if (!selectedReceipt || selectedReceipt.outcome !== 'Accepted' || registeredForSelected >= selectedReceipt.quantity) return
    const asset: Asset = { id: `asset-${crypto.randomUUID()}`, assetId: nextCode('GL-IT', assets.length), receiptId: selectedReceipt.id, typeId: selectedReceipt.typeId, modelId: selectedReceipt.modelId, serialNumber: assetForm.serialNumber.trim(), locationId: assetForm.locationId, configId: assetForm.configId, purchaseDate: assetForm.purchaseDate, cost: Number(assetForm.cost), condition: assetForm.condition, stockStatus: assetForm.stockStatus, createdAt: new Date().toISOString() }
    setAssets((current) => [...current, asset])
    setMessage(`${asset.assetId} created and placed in stock.`)
    closeForm()
  }

  return <section className="master-panel inventory-operations">
    <div className="operation-heading"><div><span className="eyebrow">{mode === 'Goods receipt' ? 'INCOMING GOODS CONTROL' : 'INDIVIDUAL ASSET CONTROL'}</span><h2>{mode === 'Goods receipt' ? 'Goods receipt & inspection' : 'Asset register'}</h2><p>{mode === 'Goods receipt' ? 'Record delivery references, quantity and inspection disposition.' : 'Convert accepted units into uniquely identified stock records.'}</p></div><button type="button" className="primary-action" onClick={() => setFormOpen(!formOpen)}>＋ {mode === 'Goods receipt' ? 'Record receipt' : 'Register asset'}</button></div>

    {formOpen && mode === 'Goods receipt' && <form className="master-form operation-form" onSubmit={saveReceipt}>
      <label>Vendor<select required value={receiptForm.vendorId} onChange={(event) => setReceiptForm({ ...receiptForm, vendorId: event.target.value })}><option value="">Select vendor</option>{vendors.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Invoice number<input required value={receiptForm.invoiceNumber} onChange={(event) => setReceiptForm({ ...receiptForm, invoiceNumber: event.target.value })} /></label>
      <label>Purchase order reference<input value={receiptForm.purchaseOrder} onChange={(event) => setReceiptForm({ ...receiptForm, purchaseOrder: event.target.value })} /></label>
      <label>Received date<input required type="date" value={receiptForm.receivedDate} onChange={(event) => setReceiptForm({ ...receiptForm, receivedDate: event.target.value })} /></label>
      <label>Received by<input readOnly value={receiptForm.receivedBy} /></label>
      <label>Asset type<select required value={receiptForm.typeId} onChange={(event) => setReceiptForm({ ...receiptForm, typeId: event.target.value, modelId: '' })}><option value="">Select type</option>{types.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Model<select required value={receiptForm.modelId} onChange={(event) => setReceiptForm({ ...receiptForm, modelId: event.target.value })}><option value="">Select model</option>{models.filter((item) => item.status === 'Active' && item.typeId === receiptForm.typeId).map((item) => <option value={item.id} key={item.id}>{item.brand} · {item.name}</option>)}</select></label>
      <label>Quantity<input required type="number" min="1" max="1000" value={receiptForm.quantity} onChange={(event) => setReceiptForm({ ...receiptForm, quantity: event.target.value })} /></label>
      <label>Inspection outcome<select value={receiptForm.outcome} onChange={(event) => setReceiptForm({ ...receiptForm, outcome: event.target.value as ReceiptOutcome })}><option>Accepted</option><option>Quarantined</option><option>Rejected</option></select></label>
      <label className="wide-field">Inspection note<textarea required value={receiptForm.inspectionNote} onChange={(event) => setReceiptForm({ ...receiptForm, inspectionNote: event.target.value })} placeholder="Condition, quantity verification and exceptions" /></label>
      <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action">Save receipt</button></div>
    </form>}

    {formOpen && mode === 'Asset register' && <form className="master-form operation-form" onSubmit={saveAsset}>
      <label>Accepted receipt<select required value={assetForm.receiptId} onChange={(event) => setAssetForm({ ...assetForm, receiptId: event.target.value, configId: '' })}><option value="">Select GRN</option>{acceptedReceipts.map((item) => <option value={item.id} key={item.id}>{item.grn} · {models.find((model) => model.id === item.modelId)?.name ?? 'Model'} · {assets.filter((asset) => asset.receiptId === item.id).length}/{item.quantity} registered</option>)}</select></label>
      <label>Serial number<input required={selectedType?.trackingMode !== 'Consumable'} value={assetForm.serialNumber} onChange={(event) => setAssetForm({ ...assetForm, serialNumber: event.target.value })} placeholder={selectedType?.trackingMode === 'Consumable' ? 'Optional for consumable' : 'Manufacturer serial number'} /></label>
      <label>Stock location<select required value={assetForm.locationId} onChange={(event) => setAssetForm({ ...assetForm, locationId: event.target.value })}><option value="">Select location</option>{locations.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Configuration profile<select value={assetForm.configId} onChange={(event) => setAssetForm({ ...assetForm, configId: event.target.value })}><option value="">No configuration profile</option>{profiles.filter((item) => item.status === 'Active' && item.typeId === selectedReceipt?.typeId).map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Purchase date<input required type="date" value={assetForm.purchaseDate} onChange={(event) => setAssetForm({ ...assetForm, purchaseDate: event.target.value })} /></label>
      <label>Unit cost<input required type="number" min="0" step="0.01" value={assetForm.cost} onChange={(event) => setAssetForm({ ...assetForm, cost: event.target.value })} /></label>
      <label>Condition<select value={assetForm.condition} onChange={(event) => setAssetForm({ ...assetForm, condition: event.target.value })}><option>New</option><option>Good</option><option>Fair</option><option>Needs attention</option></select></label>
      <label>Initial status<select value={assetForm.stockStatus} onChange={(event) => setAssetForm({ ...assetForm, stockStatus: event.target.value })}><option>In stock</option><option>Reserved</option><option>Quarantined</option></select></label>
      <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action">Create Asset ID</button></div>
    </form>}

    {message && <div className="success-message" role="status">✓ {message}</div>}
    {mode === 'Goods receipt' ? <><div className="master-summary"><div><span>Total receipts</span><strong>{receipts.length}</strong></div><div><span>Accepted</span><strong>{receipts.filter((item) => item.outcome === 'Accepted').length}</strong></div><div><span>Exceptions</span><strong>{receipts.filter((item) => item.outcome !== 'Accepted').length}</strong></div></div><DataTable rows={receipts} rowKey={(item) => item.id} columns={[
      { key: 'grn', label: 'GRN', sticky: true, width: '170px', render: (item) => <strong>{item.grn}</strong> }, { key: 'model', label: 'Model', width: '230px', render: (item) => `${models.find((model) => model.id === item.modelId)?.brand ?? ''} ${models.find((model) => model.id === item.modelId)?.name ?? 'Unavailable'}` }, { key: 'vendor', label: 'Vendor', width: '220px', render: (item) => vendors.find((vendor) => vendor.id === item.vendorId)?.name ?? 'Unavailable' }, { key: 'po', label: 'Purchase order', width: '160px', render: (item) => item.purchaseOrder || 'Not recorded' }, { key: 'invoice', label: 'Invoice', width: '160px', render: (item) => item.invoiceNumber }, { key: 'quantity', label: 'Quantity', width: '90px', render: (item) => item.quantity }, { key: 'received', label: 'Received date', width: '130px', render: (item) => item.receivedDate }, { key: 'outcome', label: 'Outcome', width: '120px', render: (item) => <span className={`status ${item.outcome === 'Accepted' ? 'active' : 'inactive'}`}>{item.outcome}</span> },
    ]} empty={<EmptyState text="No goods receipts recorded" />} /></> : <><div className="master-summary"><div><span>Registered assets</span><strong>{assets.length}</strong></div><div><span>In stock</span><strong>{assets.filter((item) => item.stockStatus === 'In stock').length}</strong></div><div><span>Inventory value</span><strong>₹{assets.reduce((sum, item) => sum + item.cost, 0).toLocaleString('en-IN')}</strong></div></div>
    <div className="category-overview"><button type="button" className={categoryFilter === 'all' ? 'selected' : ''} onClick={() => setCategoryFilter('all')}><span>All categories</span><strong>{assets.length}</strong></button>{categoryCounts.map((item) => <button type="button" className={categoryFilter === item.id ? 'selected' : ''} onClick={() => setCategoryFilter(item.id)} key={item.id}><span>{item.name}</span><strong>{item.count}</strong></button>)}</div>
    <div className="asset-register-filters"><label>Search assets<input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Asset ID, serial, brand or model" /></label><label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{types.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Lifecycle status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{assetStatuses.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => { setAssetSearch(''); setCategoryFilter('all'); setStatusFilter('all') }}>Clear filters</button></div>
    <div className="filter-result">Showing <strong>{filteredAssets.length}</strong> of {assets.length} assets</div><DataTable rows={filteredAssets} rowKey={(item) => item.id} columns={[
      { key: 'assetId', label: 'Asset ID', sticky: true, width: '190px', render: (item) => <button type="button" className="asset-link" onClick={() => setSelectedAssetId(item.id)}>{item.assetId}</button> }, { key: 'category', label: 'Category', width: '200px', render: (item) => types.find((type) => type.id === item.typeId)?.name ?? 'Unavailable' }, { key: 'model', label: 'Brand / model', width: '240px', render: (item) => `${models.find((model) => model.id === item.modelId)?.brand ?? ''} ${models.find((model) => model.id === item.modelId)?.name ?? 'Unavailable'}` }, { key: 'serial', label: 'Serial number', width: '170px', render: (item) => item.serialNumber || 'Not applicable' }, { key: 'location', label: 'Location', width: '190px', render: (item) => locations.find((location) => location.id === item.locationId)?.name ?? 'Unavailable' }, { key: 'purchase', label: 'Purchase date', width: '130px', render: (item) => item.purchaseDate }, { key: 'cost', label: 'Cost', width: '130px', render: (item) => `₹${item.cost.toLocaleString('en-IN')}` }, { key: 'condition', label: 'Condition', width: '130px', render: (item) => item.condition }, { key: 'status', label: 'Lifecycle status', width: '190px', render: (item) => <span className={`status ${item.stockStatus === 'In stock' || item.stockStatus === 'Allocated' ? 'active' : 'inactive'}`}>{item.stockStatus}</span> },
    ]} empty={<EmptyState text="No assets match these filters" />} />
    {selectedAssetRecord && <section className="asset-history-panel"><header><div><span className="eyebrow">COMPLETE ASSET LIFECYCLE</span><h3>{selectedAssetRecord.assetId} · {models.find((item) => item.id === selectedAssetRecord.modelId)?.brand} {models.find((item) => item.id === selectedAssetRecord.modelId)?.name}</h3><p>{types.find((item) => item.id === selectedAssetRecord.typeId)?.name} · Serial {selectedAssetRecord.serialNumber || 'Not applicable'} · Current status {selectedAssetRecord.stockStatus}</p></div><button type="button" onClick={() => setSelectedAssetId('')}>Close</button></header><div className="asset-history-meta"><span>Purchase: <b>{selectedAssetRecord.purchaseDate}</b></span><span>Cost: <b>₹{selectedAssetRecord.cost.toLocaleString('en-IN')}</b></span><span>Condition: <b>{selectedAssetRecord.condition}</b></span><span>Location: <b>{locations.find((item) => item.id === selectedAssetRecord.locationId)?.name ?? 'Unavailable'}</b></span></div><div className="asset-timeline">{assetHistory(selectedAssetRecord).map((event) => <article key={event.id}><i></i><div><strong>{event.title}</strong><span>{event.detail}</span><small>{event.at ? new Date(event.at).toLocaleString('en-IN') : 'Date unavailable'}</small></div></article>)}</div></section>}
    </>}
  </section>
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span><Icon name="package" size={32}/></span><strong>{text}</strong><p>Use the action above to create the first governed record.</p></div> }
