import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useLocalStore } from '../../lib/localStore'
import DataTable from '../../components/DataTable'
import { changedFields, useMasterAudit } from '../../lib/masterAudit'

type Status = 'Active' | 'Inactive'
type TrackingMode = 'Serialized asset' | 'Accessory / component' | 'Consumable'
type CatalogueTab = 'Vendors' | 'Asset groups' | 'Asset types' | 'Brands' | 'Models' | 'Configuration profiles'
type VendorClass = 'Preferred' | 'Approved' | 'Conditional' | 'Blocked'
type Vendor = { id: string; code: string; name: string; gst: string; contact: string; email: string; address: string; slaDays?: string; escalationContact?: string; performanceStatus?: VendorClass; status: Status }
type AssetGroup = { id: string; code: string; name: string; lifecycleYears: string; status: Status }
type AssetType = { id: string; code: string; name: string; groupId: string; inspectionFrequency: string; trackingMode?: TrackingMode; status: Status }
type Brand = { id: string; code: string; name: string; status: Status }
type AssetModel = { id: string; code: string; name: string; typeId: string; brand: string; warrantyMonths: string; status: Status }
type ConfigProfile = { id: string; code: string; name: string; typeId: string; specification: string; cpu?: string; ram?: string; storage?: string; operatingSystem?: string; display?: string; connectivity?: string; identifier?: string; status: Status }

const tabs: CatalogueTab[] = ['Vendors', 'Asset groups', 'Asset types', 'Brands', 'Models', 'Configuration profiles']
const blankVendor = { code: '', name: '', gst: '', contact: '', email: '', address: '', slaDays: '7', escalationContact: '', performanceStatus: 'Approved' as VendorClass, status: 'Active' as Status }
const blankGroup = { code: '', name: '', lifecycleYears: '', status: 'Active' as Status }
const blankType = { code: '', name: '', groupId: '', inspectionFrequency: 'Quarterly', trackingMode: 'Serialized asset' as TrackingMode, status: 'Active' as Status }
const blankBrand = { code: '', name: '', status: 'Active' as Status }
const blankModel = { code: '', name: '', typeId: '', brand: '', warrantyMonths: '', status: 'Active' as Status }
const blankProfile = { code: '', name: '', typeId: '', specification: '', cpu: '', ram: '', storage: '', operatingSystem: '', display: '', connectivity: '', identifier: '', status: 'Active' as Status }

const defaultGroups: AssetGroup[] = [
  ['EUC', 'End User Computing', '4'], ['SDC', 'Server & Data Centre', '5'], ['NET', 'Network & Security', '5'], ['PWR', 'Power & Environment', '6'], ['PRN', 'Printing & Peripherals', '5'], ['STG', 'Storage & Backup', '5'], ['VOC', 'Voice & Collaboration', '5'], ['ACC', 'Accessories & Components', '3'], ['MAV', 'Mobile & Audio Visual', '4'],
].map(([code, name, lifecycleYears]) => ({ id: `group-default-${code}`, code, name, lifecycleYears, status: 'Active' }))

const defaultTypes: AssetType[] = [
  ['LAPTOP', 'Laptop', 'EUC'], ['DESKTOP', 'Desktop', 'EUC'], ['WORKSTATION', 'Workstation', 'EUC'], ['MONITOR', 'Monitor', 'PRN'], ['SERVER', 'Server', 'SDC'], ['NAS', 'NAS / Storage Appliance', 'STG'], ['SWITCH', 'Managed Switch', 'NET'], ['FIREWALL', 'Firewall / UTM', 'NET'], ['WIFI-AP', 'Wi-Fi Access Point', 'NET'], ['UPS', 'UPS', 'PWR'], ['PRINTER', 'Printer', 'PRN'], ['SCANNER', 'Scanner', 'PRN'], ['IP-PHONE', 'VoIP IP Phone', 'VOC'], ['VOIP-SRV', 'VoIP Server', 'VOC'], ['HVAC', 'Data Centre HVAC', 'PWR'], ['EXT-BACKUP', 'External Backup Drive', 'STG'],
].map(([code, name, groupCode]) => ({ id: `type-default-${code}`, code, name, groupId: `group-default-${groupCode}`, inspectionFrequency: ['LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'SCANNER', 'IP-PHONE'].includes(code) ? 'Yearly' : 'Quarterly', trackingMode: 'Serialized asset', status: 'Active' }))

const additionalDefaultTypes: AssetType[] = [
  ['PENDRIVE', 'Pen Drive', 'STG', 'Accessory / component'], ['MOBILE', 'Mobile Phone', 'MAV', 'Serialized asset'], ['HDD-INT', 'Internal Hard Drive', 'STG', 'Accessory / component'], ['HDD-EXT', 'External Hard Drive', 'STG', 'Accessory / component'], ['RAM', 'RAM Module', 'ACC', 'Accessory / component'], ['AIO', 'All-in-One Computer', 'EUC', 'Serialized asset'], ['POWER-SOCKET', 'Power Socket / Extension Strip', 'PWR', 'Accessory / component'], ['LAP-CHARGER', 'Laptop Charger', 'ACC', 'Accessory / component'], ['MOB-CHARGER', 'Mobile Charger', 'ACC', 'Accessory / component'], ['USBC-CHARGER', 'USB Type-C Charger', 'ACC', 'Accessory / component'], ['POWERBANK', 'Power Bank', 'ACC', 'Accessory / component'], ['UPS-1BAT', 'Single-Battery UPS', 'PWR', 'Serialized asset'], ['UPS-2BAT', 'Double-Battery UPS', 'PWR', 'Serialized asset'], ['MOUSE-WL', 'Wireless Mouse', 'ACC', 'Accessory / component'], ['KB-WL', 'Wireless Keyboard', 'ACC', 'Accessory / component'], ['KB-WIRED', 'Wired Keyboard', 'ACC', 'Accessory / component'], ['MOUSE-WIRED', 'Wired Mouse', 'ACC', 'Accessory / component'], ['CART-PRN', 'Printer Cartridge', 'PRN', 'Consumable'], ['BT-DONGLE', 'Bluetooth Dongle', 'ACC', 'Accessory / component'], ['WIFI-DONGLE', 'Wi-Fi Dongle', 'NET', 'Accessory / component'], ['EARBUDS', 'Earbuds', 'MAV', 'Accessory / component'], ['HEADPHONE', 'Headphones', 'MAV', 'Accessory / component'], ['TV', 'Television / Display', 'MAV', 'Serialized asset'], ['LAN-CONV', 'LAN / USB Ethernet Converter', 'NET', 'Accessory / component'], ['SWITCH-UNM', 'Unmanaged Network Switch', 'NET', 'Serialized asset'], ['SWITCH-POE', 'PoE Network Switch', 'NET', 'Serialized asset'], ['SWITCH-CORE', 'Core Network Switch', 'NET', 'Serialized asset'], ['SWITCH-ACCESS', 'Access Network Switch', 'NET', 'Serialized asset'], ['SWITCH-L3', 'Layer-3 Network Switch', 'NET', 'Serialized asset'],
].map(([code, name, groupCode, trackingMode]) => ({ id: `type-default-${code}`, code, name, groupId: `group-default-${groupCode}`, inspectionFrequency: trackingMode === 'Serialized asset' ? 'Quarterly' : 'Yearly', trackingMode: trackingMode as TrackingMode, status: 'Active' }))

const defaultBrands: Brand[] = [
  ['DELL', 'Dell'], ['HP', 'HP'], ['LENOVO', 'Lenovo'], ['APPLE', 'Apple'], ['CISCO', 'Cisco'], ['HPE', 'Hewlett Packard Enterprise'], ['FORTINET', 'Fortinet'], ['SOPHOS', 'Sophos'], ['UBIQUITI', 'Ubiquiti'], ['ARUBA', 'Aruba'], ['APC', 'APC'], ['EATON', 'Eaton'], ['VERTIV', 'Vertiv'], ['SYNOLOGY', 'Synology'], ['QNAP', 'QNAP'], ['NETGEAR', 'Netgear'], ['TPLINK', 'TP-Link'], ['CANON', 'Canon'], ['EPSON', 'Epson'], ['BROTHER', 'Brother'], ['YEALINK', 'Yealink'], ['MIKROTIK', 'MikroTik'],
].map(([code, name]) => ({ id: `brand-default-${code}`, code, name, status: 'Active' }))

const demoVendors: Vendor[] = [
  ['VND-DELL', 'Dell India Demo', '06AAAAA0000A1Z5'], ['VND-HP', 'HP India Demo', '06BBBBB0000B1Z5'], ['VND-LEN', 'Lenovo India Demo', '06CCCCC0000C1Z5'], ['VND-CISCO', 'Cisco Partner Demo', '06DDDDD0000D1Z5'], ['VND-LOCAL', 'Glassco Local IT Supplier Demo', '06EEEEE0000E1Z5'],
].map(([code, name, gst], index) => ({ id: `demo-vendor-${code}`, code, name, gst, contact: `90000001${String(index + 1).padStart(2, '0')}`, email: `${code.toLowerCase()}@example.test`, address: 'Demo address, Ambala, Haryana', status: 'Active' }))

const demoModels: AssetModel[] = [
  ['LAT-5440', 'Latitude 5440', 'LAPTOP', 'Dell', '36'], ['ELITE-840', 'EliteBook 840 G10', 'LAPTOP', 'HP', '36'], ['THINK-E14', 'ThinkPad E14 Gen 5', 'LAPTOP', 'Lenovo', '36'], ['P2422H', 'P2422H Monitor', 'MONITOR', 'Dell', '36'], ['CBS350', 'CBS350 Managed Switch', 'SWITCH', 'Cisco', '12'],
].map(([code, name, type, brand, warrantyMonths]) => ({ id: `demo-model-${code}`, code, name, typeId: `type-default-${type}`, brand, warrantyMonths, status: 'Active' }))

const demoProfiles: ConfigProfile[] = [
  ['LAP-STD', 'Standard Business Laptop', 'LAPTOP', 'Core i5, 16 GB RAM, 512 GB SSD'], ['LAP-PRO', 'Power User Laptop', 'LAPTOP', 'Core i7, 32 GB RAM, 1 TB SSD'], ['MON-24', '24-inch Office Monitor', 'MONITOR', '24-inch IPS, Full HD, HDMI/DisplayPort'], ['SW-24P', '24-port Managed Access Switch', 'SWITCH', '24 x Gigabit, VLAN, STP, managed'], ['UPS-1K', '1 kVA UPS Standard', 'UPS', '1 kVA line-interactive with monitoring'],
].map(([code, name, type, specification]) => ({ id: `demo-config-${code}`, code, name, typeId: `type-default-${type}`, specification, status: 'Active' }))

function createId(prefix: string) { return `${prefix}-${crypto.randomUUID()}` }

type Receipt = { id: string; vendorId: string; outcome: string; receivedDate: string }
type Asset = { id: string; receiptId: string; cost: number }
type Maintenance = { id: string; vendorId: string; kind: string; cost: number; state: string; createdAt: string; completedAt: string; gatePass?: { dispatchedDate: string; returnedAt: string } }
type Claim = { id: string; vendorId: string; claimStatus: string; reportedDate: string; closedAt: string }
type VendorMetric = { vendor: Vendor; receipts: number; purchaseSpend: number; repairJobs: number; repairSpend: number; overdueRepairs: number; averageTurnaround: number; acceptedRate: number; claimResolutionRate: number; score: number; suggestedClass: VendorClass }

export default function AssetCatalogue({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<CatalogueTab>('Vendors')
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [vendors, setVendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [groups, setGroups] = useLocalStore<AssetGroup[]>('itms.asset-groups.v1', [])
  const [types, setTypes] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [brands, setBrands] = useLocalStore<Brand[]>('itms.brands.v1', [])
  const [models, setModels] = useLocalStore<AssetModel[]>('itms.asset-models.v1', [])
  const [profiles, setProfiles] = useLocalStore<ConfigProfile[]>('itms.config-profiles.v1', [])
  const [receipts] = useLocalStore<Receipt[]>('itms.receipts.v1', [])
  const [assets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [maintenance] = useLocalStore<Maintenance[]>('itms.asset-maintenance.v1', [])
  const [claims] = useLocalStore<Claim[]>('itms.warranty-claims.v1', [])
  const [vendorForm, setVendorForm] = useState(blankVendor)
  const [groupForm, setGroupForm] = useState(blankGroup)
  const [typeForm, setTypeForm] = useState(blankType)
  const [brandForm, setBrandForm] = useState(blankBrand)
  const [modelForm, setModelForm] = useState(blankModel)
  const [profileForm, setProfileForm] = useState(blankProfile)
  const [editingId, setEditingId] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [evaluationVendorId, setEvaluationVendorId] = useState('')
  const audit = useMasterAudit()

  const records = tab === 'Vendors' ? vendors : tab === 'Asset groups' ? groups : tab === 'Asset types' ? types : tab === 'Brands' ? brands : tab === 'Models' ? models : profiles
  const activeCount = records.filter((record) => record.status === 'Active').length
  const vendorMetrics = useMemo<VendorMetric[]>(() => vendors.map((vendor) => {
    const vendorReceipts = receipts.filter((receipt) => receipt.vendorId === vendor.id)
    const receiptIds = new Set(vendorReceipts.map((receipt) => receipt.id))
    const vendorRepairs = maintenance.filter((record) => record.vendorId === vendor.id && record.kind === 'Repair')
    const vendorClaims = claims.filter((claim) => claim.vendorId === vendor.id)
    const completedTurnarounds = vendorRepairs.flatMap((record) => {
      const start = record.gatePass?.dispatchedDate || record.createdAt?.slice(0, 10)
      const end = record.gatePass?.returnedAt || record.completedAt
      if (!start || !end) return []
      return [Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000))]
    })
    const acceptedRate = vendorReceipts.length ? Math.round(vendorReceipts.filter((receipt) => receipt.outcome === 'Accepted').length / vendorReceipts.length * 100) : 100
    const resolvedClaims = vendorClaims.filter((claim) => ['Resolved', 'Replaced', 'Closed'].includes(claim.claimStatus)).length
    const claimResolutionRate = vendorClaims.length ? Math.round(resolvedClaims / vendorClaims.length * 100) : 100
    const averageTurnaround = completedTurnarounds.length ? Math.round(completedTurnarounds.reduce((sum, days) => sum + days, 0) / completedTurnarounds.length) : 0
    const overdueRepairs = vendorRepairs.filter((record) => record.state !== 'Completed' && record.gatePass?.dispatchedDate && new Date(record.gatePass.dispatchedDate).getTime() < Date.now() - Number(vendor.slaDays || 7) * 86400000).length
    const slaPenalty = averageTurnaround > Number(vendor.slaDays || 7) ? Math.min((averageTurnaround - Number(vendor.slaDays || 7)) * 3, 20) : 0
    const score = Math.max(0, Math.round(100 - (100 - acceptedRate) * .35 - overdueRepairs * 12 - (100 - claimResolutionRate) * .2 - slaPenalty))
    const suggestedClass: VendorClass = score >= 85 ? 'Preferred' : score >= 70 ? 'Approved' : score >= 50 ? 'Conditional' : 'Blocked'
    return { vendor, receipts: vendorReceipts.length, purchaseSpend: assets.filter((asset) => receiptIds.has(asset.receiptId)).reduce((sum, asset) => sum + Number(asset.cost || 0), 0), repairJobs: vendorRepairs.length, repairSpend: vendorRepairs.reduce((sum, record) => sum + Number(record.cost || 0), 0), overdueRepairs, averageTurnaround, acceptedRate, claimResolutionRate, score, suggestedClass }
  }), [assets, claims, maintenance, receipts, vendors])
  const selectedEvaluation = vendorMetrics.find((metric) => metric.vendor.id === evaluationVendorId)

  useEffect(() => {
    setVendors((current) => [...current, ...demoVendors.filter((item) => !current.some((record) => record.code === item.code))])
    setGroups((current) => [...current, ...defaultGroups.filter((item) => !current.some((record) => record.code === item.code))])
    setTypes((current) => [...current, ...[...defaultTypes, ...additionalDefaultTypes].filter((item) => !current.some((record) => record.code === item.code))])
    setBrands((current) => [...current, ...defaultBrands.filter((item) => !current.some((record) => record.code === item.code))])
    setModels((current) => [...current, ...demoModels.filter((item) => !current.some((record) => record.code === item.code))])
    setProfiles((current) => [...current, ...demoProfiles.filter((item) => !current.some((record) => record.code === item.code))])
  }, [setBrands, setGroups, setModels, setProfiles, setTypes, setVendors])

  function resetForm() {
    setFormOpen(false); setEditingId(''); setVendorForm(blankVendor); setGroupForm(blankGroup); setTypeForm(blankType); setBrandForm(blankBrand); setModelForm(blankModel); setProfileForm(blankProfile)
  }

  function normalize(value: string) { return value.trim().toUpperCase() }

  function saveRecord(event: FormEvent) {
    event.preventDefault()
    const source = records.find((item) => item.id === editingId)
    const persist = <T extends { id: string; code: string; status: Status }>(setter: Dispatch<SetStateAction<T[]>>, record: T) => {
      setter((current) => editingId ? current.map((item) => item.id === editingId ? record : item) : [...current, record])
      audit.record({ module: tab, recordId: record.id, recordCode: record.code, action: editingId ? 'Updated' : 'Created', changedFields: editingId && source ? changedFields(source, record) : 'Initial record' })
    }
    if (tab === 'Vendors') persist<Vendor>(setVendors, { id: editingId || createId('vendor'), ...vendorForm, code: normalize(vendorForm.code), name: vendorForm.name.trim(), email: vendorForm.email.trim().toLowerCase() })
    if (tab === 'Asset groups') persist(setGroups, { id: editingId || createId('group'), ...groupForm, code: normalize(groupForm.code), name: groupForm.name.trim() })
    if (tab === 'Asset types') persist<AssetType>(setTypes, { id: editingId || createId('type'), ...typeForm, code: normalize(typeForm.code), name: typeForm.name.trim() })
    if (tab === 'Brands') persist(setBrands, { id: editingId || createId('brand'), ...brandForm, code: normalize(brandForm.code), name: brandForm.name.trim() })
    if (tab === 'Models') persist(setModels, { id: editingId || createId('model'), ...modelForm, code: normalize(modelForm.code), name: modelForm.name.trim(), brand: modelForm.brand.trim() })
    if (tab === 'Configuration profiles') persist<ConfigProfile>(setProfiles, { id: editingId || createId('config'), ...profileForm, code: normalize(profileForm.code), name: profileForm.name.trim() })
    setMessage(`${tab.slice(0, -1)} ${editingId ? 'updated' : 'saved'} in the controlled catalogue.`)
    resetForm()
  }

  function toggleStatus(id: string) {
    const flip = <T extends { id: string; status: Status }>(items: T[]) => items.map((item) => item.id === id ? { ...item, status: item.status === 'Active' ? 'Inactive' as Status : 'Active' as Status } : item)
    if (tab === 'Vendors') setVendors(flip)
    if (tab === 'Asset groups') setGroups(flip)
    if (tab === 'Asset types') setTypes(flip)
    if (tab === 'Brands') setBrands(flip)
    if (tab === 'Models') setModels(flip)
    if (tab === 'Configuration profiles') setProfiles(flip)
    const before = records.find((item) => item.id === id)
    if (before) audit.record({ module: tab, recordId: id, recordCode: before.code, action: 'Status changed', changedFields: `status: ${before.status} → ${before.status === 'Active' ? 'Inactive' : 'Active'}` })
  }

  function editRecord(record: Vendor | AssetGroup | AssetType | Brand | AssetModel | ConfigProfile) {
    setEditingId(record.id); setFormOpen(true); setShowHistory(false)
    if ('gst' in record) setVendorForm({ code: record.code, name: record.name, gst: record.gst, contact: record.contact, email: record.email, address: record.address, slaDays: record.slaDays ?? '7', escalationContact: record.escalationContact ?? '', performanceStatus: record.performanceStatus ?? 'Approved', status: record.status })
    else if ('lifecycleYears' in record) setGroupForm({ code: record.code, name: record.name, lifecycleYears: record.lifecycleYears, status: record.status })
    else if ('inspectionFrequency' in record) setTypeForm({ code: record.code, name: record.name, groupId: record.groupId, inspectionFrequency: record.inspectionFrequency, trackingMode: record.trackingMode ?? 'Serialized asset', status: record.status })
    else if ('brand' in record) setModelForm({ code: record.code, name: record.name, typeId: record.typeId, brand: record.brand, warrantyMonths: record.warrantyMonths, status: record.status })
    else if ('specification' in record) setProfileForm({ code: record.code, name: record.name, typeId: record.typeId, specification: record.specification, cpu: record.cpu ?? '', ram: record.ram ?? '', storage: record.storage ?? '', operatingSystem: record.operatingSystem ?? '', display: record.display ?? '', connectivity: record.connectivity ?? '', identifier: record.identifier ?? '', status: record.status })
    else setBrandForm({ code: record.code, name: record.name, status: record.status })
  }

  function recordContext(record: Vendor | AssetGroup | AssetType | Brand | AssetModel | ConfigProfile) {
    if ('gst' in record) return `${record.gst || 'GST not recorded'} · ${record.contact || 'Contact not recorded'} · ${record.email || 'Email not recorded'} · SLA ${record.slaDays || 'Not set'} days · ${record.performanceStatus ?? 'Approved'}`
    if ('lifecycleYears' in record) return `Planned lifecycle: ${record.lifecycleYears || 'Not set'} years`
    if ('inspectionFrequency' in record) return `${groups.find((item) => item.id === record.groupId)?.name ?? 'Group unavailable'} · ${record.trackingMode ?? 'Serialized asset'} · ${record.inspectionFrequency} inspection`
    if ('brand' in record) return `${record.brand} · ${types.find((item) => item.id === record.typeId)?.name ?? 'Type unavailable'} · ${record.warrantyMonths || '0'} months warranty`
    if ('specification' in record) return `${types.find((item) => item.id === record.typeId)?.name ?? 'Type unavailable'} · ${[record.cpu, record.ram, record.storage, record.operatingSystem, record.display, record.connectivity, record.identifier, record.specification].filter(Boolean).join(' · ')}`
    return 'Approved product brand available for model standardization'
  }

  return <>
    {!embedded && <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-02</span><h1>Vendor & Asset Catalogue</h1><p>Standardize suppliers, asset classifications, models and approved configurations.</p></div><span className="phase">CONTROLLED MASTERS</span></section>}
    <section className="master-panel">
      <div className="master-toolbar"><div className="master-tabs" role="tablist" aria-label="Catalogue master type">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} key={item} onClick={() => { setTab(item); setMessage(''); setShowHistory(false); resetForm() }}>{item}</button>)}</div><div className="toolbar-actions"><button type="button" className="secondary-action" onClick={() => { setShowHistory(!showHistory); resetForm() }}>Edit history</button><button type="button" className="primary-action" onClick={() => { setShowHistory(false); setFormOpen(!formOpen) }}>＋ Add record</button></div></div>
      {formOpen && <form className="master-form catalogue-form" onSubmit={saveRecord}>
        {tab === 'Vendors' && <><label>Vendor code<input required value={vendorForm.code} onChange={(event) => setVendorForm({ ...vendorForm, code: event.target.value })} /></label><label>Vendor name<input required value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} /></label><label>GST number<input value={vendorForm.gst} onChange={(event) => setVendorForm({ ...vendorForm, gst: event.target.value })} /></label><label>Contact number<input required value={vendorForm.contact} onChange={(event) => setVendorForm({ ...vendorForm, contact: event.target.value })} /></label><label>Email<input required type="email" value={vendorForm.email} onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })} /></label><label>Service SLA (days)<input type="number" min="1" value={vendorForm.slaDays} onChange={(event) => setVendorForm({ ...vendorForm, slaDays: event.target.value })}/></label><label>Escalation contact<input value={vendorForm.escalationContact} onChange={(event) => setVendorForm({ ...vendorForm, escalationContact: event.target.value })}/></label><label>Governed classification<select value={vendorForm.performanceStatus} onChange={(event) => setVendorForm({ ...vendorForm, performanceStatus: event.target.value as VendorClass })}><option>Preferred</option><option>Approved</option><option>Conditional</option><option>Blocked</option></select></label><label className="wide-field">Address<textarea required value={vendorForm.address} onChange={(event) => setVendorForm({ ...vendorForm, address: event.target.value })} /></label></>}
        {tab === 'Asset groups' && <><label>Group code<input required value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} /></label><label>Group name<input required value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /></label><label>Planned lifecycle (years)<input required type="number" min="1" max="25" value={groupForm.lifecycleYears} onChange={(event) => setGroupForm({ ...groupForm, lifecycleYears: event.target.value })} /></label></>}
        {tab === 'Asset types' && <><label>Type code<input required value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} /></label><label>Type name<input required value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} /></label><label>Asset group<select required value={typeForm.groupId} onChange={(event) => setTypeForm({ ...typeForm, groupId: event.target.value })}><option value="">Select group</option>{groups.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Tracking mode<select value={typeForm.trackingMode} onChange={(event) => setTypeForm({ ...typeForm, trackingMode: event.target.value as TrackingMode })}><option>Serialized asset</option><option>Accessory / component</option><option>Consumable</option></select></label><label>Default inspection<select value={typeForm.inspectionFrequency} onChange={(event) => setTypeForm({ ...typeForm, inspectionFrequency: event.target.value })}><option>Monthly</option><option>Quarterly</option><option>Half-yearly</option><option>Yearly</option><option>On demand</option></select></label></>}
        {tab === 'Brands' && <><label>Brand code<input required value={brandForm.code} onChange={(event) => setBrandForm({ ...brandForm, code: event.target.value })} /></label><label>Brand name<input required value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} /></label></>}
        {tab === 'Models' && <><label>Model code<input required value={modelForm.code} onChange={(event) => setModelForm({ ...modelForm, code: event.target.value })} /></label><label>Model name<input required value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} /></label><label>Brand<select required value={modelForm.brand} onChange={(event) => setModelForm({ ...modelForm, brand: event.target.value })}><option value="">Select brand</option>{brands.filter((item) => item.status === 'Active').map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></label><label>Asset type<select required value={modelForm.typeId} onChange={(event) => setModelForm({ ...modelForm, typeId: event.target.value })}><option value="">Select type</option>{types.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Warranty (months)<input required type="number" min="0" max="120" value={modelForm.warrantyMonths} onChange={(event) => setModelForm({ ...modelForm, warrantyMonths: event.target.value })} /></label></>}
        {tab === 'Configuration profiles' && <><label>Profile code<input required value={profileForm.code} onChange={(event) => setProfileForm({ ...profileForm, code: event.target.value })} /></label><label>Profile name<input required value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label><label>Asset type<select required value={profileForm.typeId} onChange={(event) => setProfileForm({ ...profileForm, typeId: event.target.value })}><option value="">Select type</option>{types.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><fieldset className="configuration-fields wide-field"><legend>Structured configuration <span>used by inventory filters</span></legend><label>Processor / CPU<input value={profileForm.cpu} onChange={(event) => setProfileForm({ ...profileForm, cpu: event.target.value })} placeholder="e.g. Intel Core i5-1345U" /></label><label>RAM<input value={profileForm.ram} onChange={(event) => setProfileForm({ ...profileForm, ram: event.target.value })} placeholder="e.g. 16 GB DDR5" /></label><label>Storage<input value={profileForm.storage} onChange={(event) => setProfileForm({ ...profileForm, storage: event.target.value })} placeholder="e.g. 512 GB NVMe SSD" /></label><label>Operating system / firmware<input value={profileForm.operatingSystem} onChange={(event) => setProfileForm({ ...profileForm, operatingSystem: event.target.value })} placeholder="e.g. Windows 11 Pro" /></label><label>Display / print specification<input value={profileForm.display} onChange={(event) => setProfileForm({ ...profileForm, display: event.target.value })} placeholder="e.g. 14-inch FHD or duplex laser" /></label><label>Connectivity / ports<input value={profileForm.connectivity} onChange={(event) => setProfileForm({ ...profileForm, connectivity: event.target.value })} placeholder="e.g. Wi-Fi 6E, GbE, USB-C" /></label><label>Technical identifier<input value={profileForm.identifier} onChange={(event) => setProfileForm({ ...profileForm, identifier: event.target.value })} placeholder="MAC, IMEI, extension or other standard" /></label></fieldset><label className="wide-field">Additional approved specification<textarea required value={profileForm.specification} onChange={(event) => setProfileForm({ ...profileForm, specification: event.target.value })} placeholder="Any category-specific requirements not covered above" /></label></>}
        <label>Status<select value={tab === 'Vendors' ? vendorForm.status : tab === 'Asset groups' ? groupForm.status : tab === 'Asset types' ? typeForm.status : tab === 'Brands' ? brandForm.status : tab === 'Models' ? modelForm.status : profileForm.status} onChange={(event) => { const status = event.target.value as Status; if (tab === 'Vendors') setVendorForm({ ...vendorForm, status }); if (tab === 'Asset groups') setGroupForm({ ...groupForm, status }); if (tab === 'Asset types') setTypeForm({ ...typeForm, status }); if (tab === 'Brands') setBrandForm({ ...brandForm, status }); if (tab === 'Models') setModelForm({ ...modelForm, status }); if (tab === 'Configuration profiles') setProfileForm({ ...profileForm, status }) }}><option>Active</option><option>Inactive</option></select></label>
        <div className="form-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" className="primary-action">Save record</button></div>
      </form>}
      {message && <div className="success-message" role="status">✓ {message}</div>}
      <div className="master-summary"><div><span>Total records</span><strong>{records.length}</strong></div><div><span>Active</span><strong>{activeCount}</strong></div><div><span>Inactive</span><strong>{records.length - activeCount}</strong></div></div>
      <DataTable rows={records} rowKey={(record) => record.id} columns={[
        { key: 'code', label: 'Code', sticky: true, width: '160px', render: (record) => <strong>{record.code}</strong> },
        { key: 'name', label: 'Name', width: '260px', render: (record) => record.name },
        { key: 'details', label: 'Controlled details', width: '420px', render: (record) => recordContext(record) },
        { key: 'status', label: 'Status', width: '110px', render: (record) => <span className={`status ${record.status.toLowerCase()}`}>{record.status}</span> },
        { key: 'actions', label: 'Actions', width: '210px', render: (record) => <div className="table-actions"><button className="table-action" type="button" onClick={() => editRecord(record)}>Edit</button><button className="table-action" type="button" onClick={() => toggleStatus(record.id)}>{record.status === 'Active' ? 'Remove' : 'Restore'}</button></div> },
      ]} empty={<div className="empty-state"><span>▣</span><strong>No {tab.toLowerCase()} recorded</strong><p>Add the first controlled record to continue.</p></div>} />
      {tab === 'Vendors' && <section className="vendor-performance"><header><div><span className="eyebrow">VENDOR PERFORMANCE &amp; SERVICE CONTROL</span><h2>Live supplier scorecards</h2><p>Calculated from receipts, repair service, spend, SLA adherence and warranty outcomes already recorded in ITMS.</p></div></header><DataTable rows={vendorMetrics} rowKey={(metric) => metric.vendor.id} columns={[
        { key: 'vendor', label: 'Vendor', sticky: true, width: '220px', render: (metric) => <div><strong>{metric.vendor.code} · {metric.vendor.name}</strong><small>Governed: {metric.vendor.performanceStatus ?? 'Approved'} · SLA {metric.vendor.slaDays ?? '7'} days</small></div> },
        { key: 'spend', label: 'Purchase / repair spend', width: '180px', render: (metric) => `₹${metric.purchaseSpend.toLocaleString('en-IN')} / ₹${metric.repairSpend.toLocaleString('en-IN')}` }, { key: 'service', label: 'Receipts / repairs', width: '150px', render: (metric) => `${metric.receipts} / ${metric.repairJobs}` }, { key: 'sla', label: 'Avg TAT / overdue', width: '150px', render: (metric) => `${metric.averageTurnaround || '—'} days / ${metric.overdueRepairs}` }, { key: 'quality', label: 'Acceptance / claims', width: '170px', render: (metric) => `${metric.acceptedRate}% / ${metric.claimResolutionRate}%` }, { key: 'score', label: 'Score', width: '120px', render: (metric) => <strong className={`vendor-score ${metric.score >= 70 ? 'good' : metric.score >= 50 ? 'warn' : 'poor'}`}>{metric.score}/100</strong> }, { key: 'suggested', label: 'Suggested class', width: '140px', render: (metric) => metric.suggestedClass }, { key: 'action', label: 'Evaluation', width: '120px', render: (metric) => <button type="button" className="table-action" onClick={() => setEvaluationVendorId(metric.vendor.id)}>Review</button> },
      ]} empty={<div className="empty-state"><strong>No vendor performance data</strong></div>} />{selectedEvaluation && <div className="vendor-evaluation-actions"><div><strong>{selectedEvaluation.vendor.name}</strong><span>Internal score {selectedEvaluation.score}/100 · suggested {selectedEvaluation.suggestedClass}</span></div><div><button type="button" onClick={() => setEvaluationVendorId('')}>Close</button><button type="button" className="primary-action" onClick={() => window.print()}>Print evaluation</button></div></div>}</section>}
      {showHistory && <DataTable rows={[...audit.events].filter((event) => event.module === tab).reverse()} rowKey={(event) => event.id} columns={[{ key: 'time', label: 'Timestamp', sticky: true, width: '190px', render: (event) => new Date(event.timestamp).toLocaleString('en-IN') }, { key: 'record', label: 'Record', width: '160px', render: (event) => event.recordCode }, { key: 'action', label: 'Action', width: '130px', render: (event) => event.action }, { key: 'fields', label: 'Changed fields', width: '360px', render: (event) => event.changedFields }, { key: 'actor', label: 'Changed by', width: '220px', render: (event) => event.actor }]} empty={<div className="empty-state"><span>◷</span><strong>No edit history</strong><p>Future changes to this master will be recorded here.</p></div>} />}
    </section>
    {selectedEvaluation && <article className="vendor-evaluation-print"><header><div className="print-brand"><strong>GLASSCO</strong><span>CONNECT · ITMS</span></div><span>CONTROLLED INTERNAL RECORD</span></header><h1>Vendor Performance Evaluation</h1><div className="print-meta"><p><span>Vendor</span><b>{selectedEvaluation.vendor.name}</b></p><p><span>Vendor code</span><b>{selectedEvaluation.vendor.code}</b></p><p><span>GST</span><b>{selectedEvaluation.vendor.gst || 'Not recorded'}</b></p><p><span>Evaluation date</span><b>{new Date().toLocaleDateString('en-IN')}</b></p><p><span>Governed classification</span><b>{selectedEvaluation.vendor.performanceStatus ?? 'Approved'}</b></p><p><span>System suggestion</span><b>{selectedEvaluation.suggestedClass}</b></p></div><table><thead><tr><th>Performance measure</th><th>Result</th></tr></thead><tbody><tr><td>Composite service score</td><td>{selectedEvaluation.score}/100</td></tr><tr><td>Purchase spend</td><td>₹{selectedEvaluation.purchaseSpend.toLocaleString('en-IN')}</td></tr><tr><td>Repair spend</td><td>₹{selectedEvaluation.repairSpend.toLocaleString('en-IN')}</td></tr><tr><td>Accepted receipts</td><td>{selectedEvaluation.acceptedRate}% across {selectedEvaluation.receipts} receipt(s)</td></tr><tr><td>Repair turnaround</td><td>{selectedEvaluation.averageTurnaround || 'No completed repair'} days average; {selectedEvaluation.overdueRepairs} overdue</td></tr><tr><td>Warranty resolution</td><td>{selectedEvaluation.claimResolutionRate}%</td></tr></tbody></table><section className="print-declaration"><b>Evaluation basis</b><p>This internal evaluation is generated from current controlled ITMS records. Classification remains a management decision and does not constitute external certification.</p></section><div className="signature-grid"><div><i></i><b>IT Asset Manager</b><small>Date</small></div><div><i></i><b>IT Head</b><small>Date</small></div></div><footer>Glassco CONNECT ITMS · Vendor performance and service control</footer></article>}
  </>
}
