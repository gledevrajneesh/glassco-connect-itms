import { useEffect, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'

type Status = 'Active' | 'Inactive'
type CatalogueTab = 'Vendors' | 'Asset groups' | 'Asset types' | 'Brands' | 'Models' | 'Configuration profiles'
type Vendor = { id: string; code: string; name: string; gst: string; contact: string; email: string; address: string; status: Status }
type AssetGroup = { id: string; code: string; name: string; lifecycleYears: string; status: Status }
type AssetType = { id: string; code: string; name: string; groupId: string; inspectionFrequency: string; status: Status }
type Brand = { id: string; code: string; name: string; status: Status }
type AssetModel = { id: string; code: string; name: string; typeId: string; brand: string; warrantyMonths: string; status: Status }
type ConfigProfile = { id: string; code: string; name: string; typeId: string; specification: string; status: Status }

const tabs: CatalogueTab[] = ['Vendors', 'Asset groups', 'Asset types', 'Brands', 'Models', 'Configuration profiles']
const blankVendor = { code: '', name: '', gst: '', contact: '', email: '', address: '', status: 'Active' as Status }
const blankGroup = { code: '', name: '', lifecycleYears: '', status: 'Active' as Status }
const blankType = { code: '', name: '', groupId: '', inspectionFrequency: 'Quarterly', status: 'Active' as Status }
const blankBrand = { code: '', name: '', status: 'Active' as Status }
const blankModel = { code: '', name: '', typeId: '', brand: '', warrantyMonths: '', status: 'Active' as Status }
const blankProfile = { code: '', name: '', typeId: '', specification: '', status: 'Active' as Status }

const defaultGroups: AssetGroup[] = [
  ['EUC', 'End User Computing', '4'], ['SDC', 'Server & Data Centre', '5'], ['NET', 'Network & Security', '5'], ['PWR', 'Power & Environment', '6'], ['PRN', 'Printing & Peripherals', '5'], ['STG', 'Storage & Backup', '5'], ['VOC', 'Voice & Collaboration', '5'],
].map(([code, name, lifecycleYears]) => ({ id: `group-default-${code}`, code, name, lifecycleYears, status: 'Active' }))

const defaultTypes: AssetType[] = [
  ['LAPTOP', 'Laptop', 'EUC'], ['DESKTOP', 'Desktop', 'EUC'], ['WORKSTATION', 'Workstation', 'EUC'], ['MONITOR', 'Monitor', 'PRN'], ['SERVER', 'Server', 'SDC'], ['NAS', 'NAS / Storage Appliance', 'STG'], ['SWITCH', 'Managed Switch', 'NET'], ['FIREWALL', 'Firewall / UTM', 'NET'], ['WIFI-AP', 'Wi-Fi Access Point', 'NET'], ['UPS', 'UPS', 'PWR'], ['PRINTER', 'Printer', 'PRN'], ['SCANNER', 'Scanner', 'PRN'], ['IP-PHONE', 'VoIP IP Phone', 'VOC'], ['VOIP-SRV', 'VoIP Server', 'VOC'], ['HVAC', 'Data Centre HVAC', 'PWR'], ['EXT-BACKUP', 'External Backup Drive', 'STG'],
].map(([code, name, groupCode]) => ({ id: `type-default-${code}`, code, name, groupId: `group-default-${groupCode}`, inspectionFrequency: ['LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'SCANNER', 'IP-PHONE'].includes(code) ? 'Yearly' : 'Quarterly', status: 'Active' }))

const defaultBrands: Brand[] = [
  ['DELL', 'Dell'], ['HP', 'HP'], ['LENOVO', 'Lenovo'], ['APPLE', 'Apple'], ['CISCO', 'Cisco'], ['HPE', 'Hewlett Packard Enterprise'], ['FORTINET', 'Fortinet'], ['SOPHOS', 'Sophos'], ['UBIQUITI', 'Ubiquiti'], ['ARUBA', 'Aruba'], ['APC', 'APC'], ['EATON', 'Eaton'], ['VERTIV', 'Vertiv'], ['SYNOLOGY', 'Synology'], ['QNAP', 'QNAP'], ['NETGEAR', 'Netgear'], ['TPLINK', 'TP-Link'], ['CANON', 'Canon'], ['EPSON', 'Epson'], ['BROTHER', 'Brother'], ['YEALINK', 'Yealink'], ['MIKROTIK', 'MikroTik'],
].map(([code, name]) => ({ id: `brand-default-${code}`, code, name, status: 'Active' }))

function createId(prefix: string) { return `${prefix}-${crypto.randomUUID()}` }

export default function AssetCatalogue() {
  const [tab, setTab] = useState<CatalogueTab>('Vendors')
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [vendors, setVendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [groups, setGroups] = useLocalStore<AssetGroup[]>('itms.asset-groups.v1', [])
  const [types, setTypes] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [brands, setBrands] = useLocalStore<Brand[]>('itms.brands.v1', [])
  const [models, setModels] = useLocalStore<AssetModel[]>('itms.asset-models.v1', [])
  const [profiles, setProfiles] = useLocalStore<ConfigProfile[]>('itms.config-profiles.v1', [])
  const [vendorForm, setVendorForm] = useState(blankVendor)
  const [groupForm, setGroupForm] = useState(blankGroup)
  const [typeForm, setTypeForm] = useState(blankType)
  const [brandForm, setBrandForm] = useState(blankBrand)
  const [modelForm, setModelForm] = useState(blankModel)
  const [profileForm, setProfileForm] = useState(blankProfile)

  const records = tab === 'Vendors' ? vendors : tab === 'Asset groups' ? groups : tab === 'Asset types' ? types : tab === 'Brands' ? brands : tab === 'Models' ? models : profiles
  const activeCount = records.filter((record) => record.status === 'Active').length

  useEffect(() => {
    setGroups((current) => [...current, ...defaultGroups.filter((item) => !current.some((record) => record.code === item.code))])
    setTypes((current) => [...current, ...defaultTypes.filter((item) => !current.some((record) => record.code === item.code))])
    setBrands((current) => [...current, ...defaultBrands.filter((item) => !current.some((record) => record.code === item.code))])
  }, [setBrands, setGroups, setTypes])

  function resetForm() {
    setFormOpen(false); setVendorForm(blankVendor); setGroupForm(blankGroup); setTypeForm(blankType); setBrandForm(blankBrand); setModelForm(blankModel); setProfileForm(blankProfile)
  }

  function normalize(value: string) { return value.trim().toUpperCase() }

  function saveRecord(event: FormEvent) {
    event.preventDefault()
    if (tab === 'Vendors') setVendors((current) => [...current, { id: createId('vendor'), ...vendorForm, code: normalize(vendorForm.code), name: vendorForm.name.trim(), email: vendorForm.email.trim().toLowerCase() }])
    if (tab === 'Asset groups') setGroups((current) => [...current, { id: createId('group'), ...groupForm, code: normalize(groupForm.code), name: groupForm.name.trim() }])
    if (tab === 'Asset types') setTypes((current) => [...current, { id: createId('type'), ...typeForm, code: normalize(typeForm.code), name: typeForm.name.trim() }])
    if (tab === 'Brands') setBrands((current) => [...current, { id: createId('brand'), ...brandForm, code: normalize(brandForm.code), name: brandForm.name.trim() }])
    if (tab === 'Models') setModels((current) => [...current, { id: createId('model'), ...modelForm, code: normalize(modelForm.code), name: modelForm.name.trim(), brand: modelForm.brand.trim() }])
    if (tab === 'Configuration profiles') setProfiles((current) => [...current, { id: createId('config'), ...profileForm, code: normalize(profileForm.code), name: profileForm.name.trim() }])
    setMessage(`${tab.slice(0, -1)} saved to the controlled catalogue.`)
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
  }

  function recordContext(record: Vendor | AssetGroup | AssetType | Brand | AssetModel | ConfigProfile) {
    if ('gst' in record) return `${record.gst || 'GST not recorded'} · ${record.contact || 'Contact not recorded'} · ${record.email || 'Email not recorded'}`
    if ('lifecycleYears' in record) return `Planned lifecycle: ${record.lifecycleYears || 'Not set'} years`
    if ('inspectionFrequency' in record) return `${groups.find((item) => item.id === record.groupId)?.name ?? 'Group unavailable'} · ${record.inspectionFrequency} inspection`
    if ('brand' in record) return `${record.brand} · ${types.find((item) => item.id === record.typeId)?.name ?? 'Type unavailable'} · ${record.warrantyMonths || '0'} months warranty`
    if ('specification' in record) return `${types.find((item) => item.id === record.typeId)?.name ?? 'Type unavailable'} · ${record.specification}`
    return 'Approved product brand available for model standardization'
  }

  return <>
    <section className="page-heading"><div><span className="eyebrow">GCCP-ITMS-BUILD-02</span><h1>Vendor & Asset Catalogue</h1><p>Standardize suppliers, asset classifications, models and approved configurations.</p></div><span className="phase">CONTROLLED MASTERS</span></section>
    <section className="master-panel">
      <div className="master-toolbar"><div className="master-tabs" role="tablist" aria-label="Catalogue master type">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} key={item} onClick={() => { setTab(item); setMessage(''); resetForm() }}>{item}</button>)}</div><button type="button" className="primary-action" onClick={() => setFormOpen(!formOpen)}>＋ Add record</button></div>
      {formOpen && <form className="master-form catalogue-form" onSubmit={saveRecord}>
        {tab === 'Vendors' && <><label>Vendor code<input required value={vendorForm.code} onChange={(event) => setVendorForm({ ...vendorForm, code: event.target.value })} /></label><label>Vendor name<input required value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} /></label><label>GST number<input value={vendorForm.gst} onChange={(event) => setVendorForm({ ...vendorForm, gst: event.target.value })} /></label><label>Contact number<input required value={vendorForm.contact} onChange={(event) => setVendorForm({ ...vendorForm, contact: event.target.value })} /></label><label>Email<input required type="email" value={vendorForm.email} onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })} /></label><label className="wide-field">Address<textarea required value={vendorForm.address} onChange={(event) => setVendorForm({ ...vendorForm, address: event.target.value })} /></label></>}
        {tab === 'Asset groups' && <><label>Group code<input required value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} /></label><label>Group name<input required value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /></label><label>Planned lifecycle (years)<input required type="number" min="1" max="25" value={groupForm.lifecycleYears} onChange={(event) => setGroupForm({ ...groupForm, lifecycleYears: event.target.value })} /></label></>}
        {tab === 'Asset types' && <><label>Type code<input required value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} /></label><label>Type name<input required value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} /></label><label>Asset group<select required value={typeForm.groupId} onChange={(event) => setTypeForm({ ...typeForm, groupId: event.target.value })}><option value="">Select group</option>{groups.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Default inspection<select value={typeForm.inspectionFrequency} onChange={(event) => setTypeForm({ ...typeForm, inspectionFrequency: event.target.value })}><option>Monthly</option><option>Quarterly</option><option>Half-yearly</option><option>Yearly</option><option>On demand</option></select></label></>}
        {tab === 'Brands' && <><label>Brand code<input required value={brandForm.code} onChange={(event) => setBrandForm({ ...brandForm, code: event.target.value })} /></label><label>Brand name<input required value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} /></label></>}
        {tab === 'Models' && <><label>Model code<input required value={modelForm.code} onChange={(event) => setModelForm({ ...modelForm, code: event.target.value })} /></label><label>Model name<input required value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} /></label><label>Brand<select required value={modelForm.brand} onChange={(event) => setModelForm({ ...modelForm, brand: event.target.value })}><option value="">Select brand</option>{brands.filter((item) => item.status === 'Active').map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select></label><label>Asset type<select required value={modelForm.typeId} onChange={(event) => setModelForm({ ...modelForm, typeId: event.target.value })}><option value="">Select type</option>{types.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Warranty (months)<input required type="number" min="0" max="120" value={modelForm.warrantyMonths} onChange={(event) => setModelForm({ ...modelForm, warrantyMonths: event.target.value })} /></label></>}
        {tab === 'Configuration profiles' && <><label>Profile code<input required value={profileForm.code} onChange={(event) => setProfileForm({ ...profileForm, code: event.target.value })} /></label><label>Profile name<input required value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label><label>Asset type<select required value={profileForm.typeId} onChange={(event) => setProfileForm({ ...profileForm, typeId: event.target.value })}><option value="">Select type</option>{types.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="wide-field">Approved specification<textarea required value={profileForm.specification} onChange={(event) => setProfileForm({ ...profileForm, specification: event.target.value })} placeholder="Processor, memory, storage, operating requirements or other standard configuration" /></label></>}
        <label>Status<select value={tab === 'Vendors' ? vendorForm.status : tab === 'Asset groups' ? groupForm.status : tab === 'Asset types' ? typeForm.status : tab === 'Brands' ? brandForm.status : tab === 'Models' ? modelForm.status : profileForm.status} onChange={(event) => { const status = event.target.value as Status; if (tab === 'Vendors') setVendorForm({ ...vendorForm, status }); if (tab === 'Asset groups') setGroupForm({ ...groupForm, status }); if (tab === 'Asset types') setTypeForm({ ...typeForm, status }); if (tab === 'Brands') setBrandForm({ ...brandForm, status }); if (tab === 'Models') setModelForm({ ...modelForm, status }); if (tab === 'Configuration profiles') setProfileForm({ ...profileForm, status }) }}><option>Active</option><option>Inactive</option></select></label>
        <div className="form-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" className="primary-action">Save record</button></div>
      </form>}
      {message && <div className="success-message" role="status">✓ {message}</div>}
      <div className="master-summary"><div><span>Total records</span><strong>{records.length}</strong></div><div><span>Active</span><strong>{activeCount}</strong></div><div><span>Inactive</span><strong>{records.length - activeCount}</strong></div></div>
      <div className="records">{records.map((record) => <article className="record" key={record.id}><div><strong>{record.code} · {record.name}</strong><span>{recordContext(record)}</span></div><div className="record-actions"><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span><button type="button" onClick={() => toggleStatus(record.id)}>{record.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button></div></article>)}{records.length === 0 && <div className="empty-state"><span>▣</span><strong>No {tab.toLowerCase()} recorded</strong><p>Add the first controlled record to continue.</p></div>}</div>
    </section>
  </>
}
