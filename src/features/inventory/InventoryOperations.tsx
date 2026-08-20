import { useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'

type Status = 'Active' | 'Inactive'
type Vendor = { id: string; code: string; name: string; status: Status }
type AssetType = { id: string; code: string; name: string; trackingMode?: string; status: Status }
type AssetModel = { id: string; code: string; name: string; typeId: string; brand: string; warrantyMonths: string; status: Status }
type ConfigProfile = { id: string; code: string; name: string; typeId: string; specification: string; status: Status }
type Location = { id: string; code: string; name: string; status: Status }
type ReceiptOutcome = 'Accepted' | 'Quarantined' | 'Rejected'
type Receipt = { id: string; grn: string; vendorId: string; invoiceNumber: string; purchaseOrder: string; receivedDate: string; receivedBy: string; typeId: string; modelId: string; quantity: number; outcome: ReceiptOutcome; inspectionNote: string; createdAt: string }
type Asset = { id: string; assetId: string; receiptId: string; typeId: string; modelId: string; serialNumber: string; locationId: string; configId: string; purchaseDate: string; cost: number; condition: string; stockStatus: string; createdAt: string }

const today = () => new Date().toISOString().slice(0, 10)
const newReceipt = { vendorId: '', invoiceNumber: '', purchaseOrder: '', receivedDate: today(), receivedBy: 'dev@glasscolabs.com', typeId: '', modelId: '', quantity: '1', outcome: 'Accepted' as ReceiptOutcome, inspectionNote: '' }
const newAsset = { receiptId: '', serialNumber: '', locationId: '', configId: '', purchaseDate: today(), cost: '', condition: 'New', stockStatus: 'In stock' }

export default function InventoryOperations({ mode }: { mode: 'Goods receipt' | 'Asset register' }) {
  const [vendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<AssetModel[]>('itms.asset-models.v1', [])
  const [profiles] = useLocalStore<ConfigProfile[]>('itms.config-profiles.v1', [])
  const [locations] = useLocalStore<Location[]>('itms.locations.v1', [])
  const [receipts, setReceipts] = useLocalStore<Receipt[]>('itms.receipts.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [receiptForm, setReceiptForm] = useState(newReceipt)
  const [assetForm, setAssetForm] = useState(newAsset)
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')

  const acceptedReceipts = useMemo(() => receipts.filter((receipt) => receipt.outcome === 'Accepted' && assets.filter((asset) => asset.receiptId === receipt.id).length < receipt.quantity), [assets, receipts])
  const selectedReceipt = receipts.find((receipt) => receipt.id === assetForm.receiptId)
  const selectedType = types.find((item) => item.id === selectedReceipt?.typeId)
  const registeredForSelected = selectedReceipt ? assets.filter((asset) => asset.receiptId === selectedReceipt.id).length : 0

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
    {mode === 'Goods receipt' ? <><div className="master-summary"><div><span>Total receipts</span><strong>{receipts.length}</strong></div><div><span>Accepted</span><strong>{receipts.filter((item) => item.outcome === 'Accepted').length}</strong></div><div><span>Exceptions</span><strong>{receipts.filter((item) => item.outcome !== 'Accepted').length}</strong></div></div><div className="records">{receipts.map((receipt) => <article className="record" key={receipt.id}><div><strong>{receipt.grn} · {models.find((item) => item.id === receipt.modelId)?.name ?? 'Model unavailable'}</strong><span>{vendors.find((item) => item.id === receipt.vendorId)?.name ?? 'Vendor unavailable'} · Invoice {receipt.invoiceNumber} · Qty {receipt.quantity} · {receipt.receivedDate}</span></div><span className={`status ${receipt.outcome === 'Accepted' ? 'active' : 'inactive'}`}>{receipt.outcome}</span></article>)}{receipts.length === 0 && <EmptyState text="No goods receipts recorded" />}</div></> : <><div className="master-summary"><div><span>Registered assets</span><strong>{assets.length}</strong></div><div><span>In stock</span><strong>{assets.filter((item) => item.stockStatus === 'In stock').length}</strong></div><div><span>Inventory value</span><strong>₹{assets.reduce((sum, item) => sum + item.cost, 0).toLocaleString('en-IN')}</strong></div></div><div className="records">{assets.map((asset) => <article className="record" key={asset.id}><div><strong>{asset.assetId} · {models.find((item) => item.id === asset.modelId)?.brand ?? ''} {models.find((item) => item.id === asset.modelId)?.name ?? 'Model unavailable'}</strong><span>Serial: {asset.serialNumber || 'Not applicable'} · {locations.find((item) => item.id === asset.locationId)?.name ?? 'Location unavailable'} · {asset.condition}</span></div><span className="status active">{asset.stockStatus}</span></article>)}{assets.length === 0 && <EmptyState text="No assets registered" />}</div></>}
  </section>
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span>▣</span><strong>{text}</strong><p>Use the action above to create the first governed record.</p></div> }
