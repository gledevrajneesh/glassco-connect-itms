import { useMemo, useState, type FormEvent } from 'react'
import DataTable from '../../components/DataTable'
import Icon from '../../components/Icon'
import { useLocalStore } from '../../lib/localStore'
import './MaintenanceWorkspace.css'

type Asset = { id: string; assetId: string; modelId: string; typeId: string; serialNumber: string; stockStatus: string; condition: string }
type Model = { id: string; brand: string; name: string }
type AssetType = { id: string; name: string }
type Vendor = { id: string; code: string; name: string; status: string }
export type MaintenanceRecord = { id: string; code: string; assetId: string; activity: string; kind: 'Preventive maintenance' | 'Inspection' | 'Repair' | 'Calibration'; frequency: string; dueDate: string; responsible: string; vendorId: string; notes: string; state: 'Scheduled' | 'Completed' | 'Cancelled'; createdAt: string; completedAt: string; performedDate: string; technician: string; cost: number; findings: string; outcome: string; nextDueDate: string; disposition: string }

const today = () => new Date().toISOString().slice(0, 10)
const emptySchedule = { assetId: '', activity: '', kind: 'Preventive maintenance' as MaintenanceRecord['kind'], frequency: 'Monthly', dueDate: today(), responsible: 'dev@glasscolabs.com', vendorId: '', notes: '' }
const emptyOutcome = { performedDate: today(), technician: 'dev@glasscolabs.com', cost: '', findings: '', outcome: 'Passed', nextDueDate: '', disposition: 'Keep current status' }

export default function MaintenanceWorkspace() {
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [vendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [records, setRecords] = useLocalStore<MaintenanceRecord[]>('itms.asset-maintenance.v1', [])
  const [tab, setTab] = useState<'Schedule' | 'Due calendar' | 'Service history'>('Schedule')
  const [formOpen, setFormOpen] = useState(false)
  const [schedule, setSchedule] = useState(emptySchedule)
  const [completionId, setCompletionId] = useState('')
  const [completion, setCompletion] = useState(emptyOutcome)
  const [message, setMessage] = useState('')
  const [itemGroupId, setItemGroupId] = useState('')
  const [dueGroupId, setDueGroupId] = useState('all')
  const [dueAssetId, setDueAssetId] = useState('all')
  const [windowFilter, setWindowFilter] = useState<'All' | 'Overdue' | '7 days' | '30 days'>('All')
  const assetLabel = (id: string) => { const asset = assets.find((item) => item.id === id); const model = models.find((item) => item.id === asset?.modelId); return `${asset?.assetId ?? 'Unavailable'} · ${model ? `${model.brand} ${model.name}` : 'Model unavailable'}` }
  const openRecords = records.filter((item) => item.state === 'Scheduled')
  const dueRecords = useMemo(() => openRecords.filter((item) => { const days = Math.ceil((new Date(item.dueDate).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000); const asset = assets.find((entry) => entry.id === item.assetId); const inGroup = dueGroupId === 'all' || asset?.typeId === dueGroupId; const isAsset = dueAssetId === 'all' || item.assetId === dueAssetId; return inGroup && isAsset && (windowFilter === 'All' || (windowFilter === 'Overdue' && days < 0) || (windowFilter === '7 days' && days >= 0 && days <= 7) || (windowFilter === '30 days' && days >= 0 && days <= 30)) }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assets, dueAssetId, dueGroupId, openRecords, windowFilter])
  const overdue = openRecords.filter((item) => item.dueDate < today()).length

  function saveSchedule(event: FormEvent) {
    event.preventDefault()
    const record: MaintenanceRecord = { id: crypto.randomUUID(), code: `MNT-${new Date().getFullYear()}-${String(records.length + 1).padStart(4, '0')}`, ...schedule, state: 'Scheduled', createdAt: new Date().toISOString(), completedAt: '', performedDate: '', technician: '', cost: 0, findings: '', outcome: '', nextDueDate: '', disposition: '' }
    setRecords((current) => [...current, record]); setSchedule(emptySchedule); setItemGroupId(''); setFormOpen(false); setMessage(`${record.code} scheduled for ${record.dueDate}.`)
  }
  function completeRecord(event: FormEvent) {
    event.preventDefault(); const source = records.find((item) => item.id === completionId); if (!source) return
    const disposition = completion.disposition
    setRecords((current) => current.map((item) => item.id === completionId ? { ...item, ...completion, cost: Number(completion.cost || 0), state: 'Completed', completedAt: new Date().toISOString() } : item))
    if (disposition !== 'Keep current status') setAssets((current) => current.map((asset) => asset.id === source.assetId ? { ...asset, stockStatus: disposition, condition: disposition === 'Scrapped' ? 'Beyond repair' : asset.condition } : asset))
    if (completion.nextDueDate) setRecords((current) => [...current, { ...source, id: crypto.randomUUID(), code: `MNT-${new Date().getFullYear()}-${String(current.length + 1).padStart(4, '0')}`, dueDate: completion.nextDueDate, state: 'Scheduled', createdAt: new Date().toISOString(), completedAt: '', performedDate: '', technician: '', cost: 0, findings: '', outcome: '', nextDueDate: '', disposition: '' }])
    setMessage(`${source.code} completed and retained in the asset lifecycle.`); setCompletionId(''); setCompletion(emptyOutcome)
  }

  const columns = [
    { key: 'code', label: 'Reference', sticky: true, width: '160px', render: (item: MaintenanceRecord) => <><strong>{item.code}</strong><small>{item.kind}</small></> },
    { key: 'asset', label: 'Asset', width: '260px', render: (item: MaintenanceRecord) => assetLabel(item.assetId) },
    { key: 'activity', label: 'Activity', width: '260px', render: (item: MaintenanceRecord) => item.activity },
    { key: 'due', label: 'Due date', width: '130px', render: (item: MaintenanceRecord) => <span className={item.state === 'Scheduled' && item.dueDate < today() ? 'due-overdue' : ''}>{item.dueDate}</span> },
    { key: 'responsible', label: 'Responsible', width: '210px', render: (item: MaintenanceRecord) => item.responsible },
    { key: 'status', label: 'Status', width: '120px', render: (item: MaintenanceRecord) => <span className={`status ${item.state === 'Completed' ? 'active' : 'inactive'}`}>{item.state}</span> },
    { key: 'action', label: 'Action', width: '150px', render: (item: MaintenanceRecord) => item.state === 'Scheduled' ? <button className="table-action" type="button" onClick={() => { setCompletionId(item.id); setCompletion({ ...emptyOutcome, nextDueDate: '' }) }}>Record outcome</button> : item.outcome || 'Completed' },
  ]

  return <div className="maintenance-workspace"><section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-12</span><h1>Maintenance &amp; Inspection</h1><p>Plan, perform and evidence asset care throughout the controlled lifecycle.</p></div><span className="phase">LIFECYCLE CONTROL</span></section>
    <section className="master-panel"><div className="master-toolbar"><div className="master-tabs">{(['Schedule', 'Due calendar', 'Service history'] as const).map((item) => <button type="button" className={tab === item ? 'selected' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><button className="primary-action" type="button" onClick={() => setFormOpen(!formOpen)}>＋ Schedule activity</button></div>
      {formOpen && <form className="master-form operation-form" onSubmit={saveSchedule}><label>Item group / category<select required value={itemGroupId} onChange={(e) => { setItemGroupId(e.target.value); setSchedule({ ...schedule, assetId: '' }) }}><option value="">Select item group first</option>{types.filter((type) => assets.some((asset) => asset.typeId === type.id && asset.stockStatus !== 'Scrapped')).map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label>{itemGroupId && <label>Item / asset<select required value={schedule.assetId} onChange={(e) => setSchedule({ ...schedule, assetId: e.target.value })}><option value="">Select item</option>{assets.filter((item) => item.typeId === itemGroupId && item.stockStatus !== 'Scrapped').map((item) => <option value={item.id} key={item.id}>{assetLabel(item.id)}</option>)}</select></label>}{schedule.assetId && <><label>Activity<input required value={schedule.activity} onChange={(e) => setSchedule({ ...schedule, activity: e.target.value })} placeholder="Battery health inspection" /></label><label>Control type<select value={schedule.kind} onChange={(e) => setSchedule({ ...schedule, kind: e.target.value as MaintenanceRecord['kind'] })}><option>Preventive maintenance</option><option>Inspection</option><option>Repair</option><option>Calibration</option></select></label><label>Frequency<select value={schedule.frequency} onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}><option>One time</option><option>Monthly</option><option>Quarterly</option><option>Half-yearly</option><option>Yearly</option></select></label><label>Due date<input required type="date" value={schedule.dueDate} onChange={(e) => setSchedule({ ...schedule, dueDate: e.target.value })} /></label><label>Responsible person<input required value={schedule.responsible} onChange={(e) => setSchedule({ ...schedule, responsible: e.target.value })} /></label><label>Service vendor<select value={schedule.vendorId} onChange={(e) => setSchedule({ ...schedule, vendorId: e.target.value })}><option value="">Internal / no vendor</option>{vendors.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="wide-field">Scope / instruction<textarea required value={schedule.notes} onChange={(e) => setSchedule({ ...schedule, notes: e.target.value })} /></label><div className="form-actions"><button type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-action" type="submit">Save schedule</button></div></>}</form>}
      {completionId && <form className="master-form operation-form outcome-form" onSubmit={completeRecord}><div className="form-banner"><strong>Complete {records.find((item) => item.id === completionId)?.code}</strong><span>{assetLabel(records.find((item) => item.id === completionId)?.assetId ?? '')}</span></div><label>Performed date<input required type="date" value={completion.performedDate} onChange={(e) => setCompletion({ ...completion, performedDate: e.target.value })} /></label><label>Technician / inspector<input required value={completion.technician} onChange={(e) => setCompletion({ ...completion, technician: e.target.value })} /></label><label>Outcome<select value={completion.outcome} onChange={(e) => setCompletion({ ...completion, outcome: e.target.value })}><option>Passed</option><option>Passed with observation</option><option>Failed</option><option>Repair completed</option></select></label><label>Cost (INR)<input min="0" step="0.01" type="number" value={completion.cost} onChange={(e) => setCompletion({ ...completion, cost: e.target.value })} /></label><label>Next due date<input type="date" value={completion.nextDueDate} onChange={(e) => setCompletion({ ...completion, nextDueDate: e.target.value })} /></label><label>Asset disposition<select value={completion.disposition} onChange={(e) => setCompletion({ ...completion, disposition: e.target.value })}><option>Keep current status</option><option>In stock</option><option>Under repair</option><option>Quarantined</option><option>Scrapped</option></select></label><label className="wide-field">Findings and work performed<textarea required value={completion.findings} onChange={(e) => setCompletion({ ...completion, findings: e.target.value })} /></label><div className="form-actions"><button type="button" onClick={() => setCompletionId('')}>Cancel</button><button className="primary-action" type="submit">Complete &amp; retain history</button></div></form>}
      {message && <div className="success-message">✓ {message}</div>}
      <div className="master-summary maintenance-summary"><div><span>Open schedules</span><strong>{openRecords.length}</strong></div><div><span>Overdue</span><strong>{overdue}</strong></div><div><span>Completed</span><strong>{records.filter((item) => item.state === 'Completed').length}</strong></div><div><span>Maintenance cost</span><strong>₹{records.reduce((sum, item) => sum + item.cost, 0).toLocaleString('en-IN')}</strong></div></div>
      {tab === 'Due calendar' && <div className="maintenance-filter"><label>Item group / category<select value={dueGroupId} onChange={(e) => { setDueGroupId(e.target.value); setDueAssetId('all') }}><option value="all">All item groups</option>{types.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label>{dueGroupId !== 'all' && <label>Item / asset<select value={dueAssetId} onChange={(e) => setDueAssetId(e.target.value)}><option value="all">All items in group</option>{assets.filter((asset) => asset.typeId === dueGroupId && openRecords.some((record) => record.assetId === asset.id)).map((asset) => <option value={asset.id} key={asset.id}>{assetLabel(asset.id)}</option>)}</select></label>}<div>{(['All', 'Overdue', '7 days', '30 days'] as const).map((item) => <button type="button" className={windowFilter === item ? 'selected' : ''} onClick={() => setWindowFilter(item)} key={item}>{item}</button>)}</div></div>}
      <DataTable rows={tab === 'Service history' ? [...records].filter((item) => item.state === 'Completed').reverse() : tab === 'Due calendar' ? dueRecords : [...records].reverse()} rowKey={(item) => item.id} columns={columns} empty={<div className="empty-state"><span><Icon name="maintenance" size={32}/></span><strong>No maintenance records</strong><p>Schedule the first controlled activity for an IT asset.</p></div>} />
    </section></div>
}
