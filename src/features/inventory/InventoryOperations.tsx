import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocalStore } from '../../lib/localStore'
import DataTable from '../../components/DataTable'
import Icon, { type IconName } from '../../components/Icon'
import { openAttachment, type LocalAttachment } from '../../lib/localAttachmentStore'
import { beginInventoryAttachmentUpload, openInventoryAttachment, queueInventoryBill, validateInventoryBill, type InventoryAttachment } from '../../lib/inventoryAttachmentStore'
import { firebaseAuth } from '../../lib/firebase'
import type { CustodyMovement } from '../../lib/custodyLifecycle'
import type { MaintenanceRecord } from '../maintenance/MaintenanceWorkspace'
import type { DisposalRecord, VerificationRecord } from '../assurance/AssuranceWorkspace'
import type { RetirementRecord } from '../retirement/RetirementWorkspace'
import { changedFields, useMasterAudit } from '../../lib/masterAudit'
import { canDo, type RoleId } from '../../lib/accessControl'
import { defaultPrefix, suggestedCode, type InventoryCodeRule } from './inventoryCode'
import { specificationsFor, visibleSpecifications, type ModelSpecificationDefaults, type SpecificationChange, type SpecificationField } from './assetSpecifications'
import './InventoryOperations.css'

type Status = 'Active' | 'Inactive'
type Vendor = { id: string; code: string; name: string; status: Status }
type AssetGroup = { id: string; code: string; name: string; status: Status }
type AssetType = { id: string; code: string; name: string; groupId?: string; trackingMode?: string; status: Status }
type AssetModel = { id: string; code: string; name: string; typeId: string; brand: string; warrantyMonths: string; status: Status }
type ConfigProfile = { id: string; code: string; name: string; typeId: string; specification: string; cpu?: string; ram?: string; storage?: string; operatingSystem?: string; display?: string; connectivity?: string; identifier?: string; status: Status }
type Location = { id: string; code: string; name: string; status: Status }
type ReceiptOutcome = 'Accepted' | 'Quarantined' | 'Rejected' | 'Voided'
type ReceiptLine = { id: string; typeId: string; modelId: string; quantity: number }
type Receipt = { id: string; grn: string; groupId?: string; vendorId: string; invoiceNumber: string; purchaseOrder: string; receivedDate: string; receivedBy: string; typeId: string; modelId: string; quantity: number; lines?: ReceiptLine[]; outcome: ReceiptOutcome; inspectionNote: string; bill?: LocalAttachment | InventoryAttachment; createdAt: string; updatedAt?: string; voidReason?: string; voidedAt?: string }
type Asset = { id: string; assetId: string; receiptId: string; receiptLineId?: string; typeId: string; modelId: string; serialNumber: string; locationId: string; configId: string; specifications?: Record<string,string>; iconName?: IconName; purchaseDate: string; cost: number; condition: string; stockStatus: string; createdAt: string }
type Allocation = { id: string; code: string; userId: string; assetIds: string[]; replacementAssetId?: string; allocationKind?: string; allocationDate: string; state: string; requestedAt: string; itHeadApprovedAt: string }
type User = { id: string; employeeCode: string; name: string }
type Lifecycle = { id: string; code: string; kind: 'Onboarding' | 'Offboarding'; userId: string; assetIds: string[]; disposition?: string; state: string; createdAt: string; effectiveDate: string }
type WarrantyClaim = { id: string; code: string; assetId: string; claimStatus: string; rmaReference: string; resolutionType?: string; replacementAssetId?: string; replacementOutcome: string; reportedDate: string; updatedAt: string }

const today = () => new Date().toISOString().slice(0, 10)
const newReceipt = { groupId: '', vendorId: '', invoiceNumber: '', purchaseOrder: '', receivedDate: today(), receivedBy: 'dev@glasscolabs.com', typeId: '', modelId: '', quantity: '1', outcome: 'Accepted' as ReceiptOutcome, inspectionNote: '' }
const newAsset = { receiptId: '', receiptLineId: '', inventoryCode: '', serialNumber: '', locationId: '', configId: '', specifications:{} as Record<string,string>, iconName: 'package' as IconName, purchaseDate: today(), cost: '', condition: 'New', stockStatus: 'In stock' }
type ReceiptLineDraft = { id: string; typeId: string; modelId: string; quantity: string }
const blankReceiptLine = (): ReceiptLineDraft => ({ id: crypto.randomUUID(), typeId: '', modelId: '', quantity: '1' })
function receiptLinesFor(receipt: Receipt): ReceiptLine[] { return receipt.lines?.length ? receipt.lines : [{ id: 'legacy', typeId: receipt.typeId, modelId: receipt.modelId, quantity: receipt.quantity }] }
const assetIcons:{name:IconName;label:string}[]=[{name:'laptop',label:'Laptop'},{name:'cpu',label:'CPU / desktop'},{name:'ram',label:'RAM'},{name:'storage',label:'HDD / storage'},{name:'printer',label:'Printer'},{name:'voip',label:'VoIP'},{name:'mobile',label:'Mobile'},{name:'monitor',label:'Monitor'},{name:'network',label:'Network'},{name:'package',label:'Other'}]
function suggestedIcon(type?:AssetType):IconName{const value=`${type?.code??''} ${type?.name??''}`.toLowerCase();if(value.includes('laptop'))return'laptop';if(value.includes('desktop')||value.includes('cpu')||value.includes('all in one'))return'cpu';if(value.includes('ram')||value.includes('memory'))return'ram';if(value.includes('hard')||value.includes('storage')||value.includes('nas'))return'storage';if(value.includes('printer')||value.includes('cartridge'))return'printer';if(value.includes('voip')||value.includes('phone'))return'voip';if(value.includes('mobile'))return'mobile';if(value.includes('monitor')||value.includes('tv'))return'monitor';if(value.includes('switch')||value.includes('wifi')||value.includes('firewall')||value.includes('dongle'))return'network';return'package'}
function escapedPattern(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

const demoReceipts: Receipt[] = [
  { id: 'demo-receipt-laptop', grn: 'GRN-DEMO-0001', vendorId: 'demo-vendor-VND-DELL', purchaseOrder: 'DEMO-PO-1001', invoiceNumber: 'DEMO-INV-1001', receivedDate: '2026-08-01', receivedBy: 'Demo Store Receiver', typeId: 'type-default-LAPTOP', modelId: 'demo-model-LAT-5440', quantity: 2, outcome: 'Accepted', inspectionNote: 'Demo stock accepted after visual inspection.', createdAt: '2026-08-01T09:00:00.000Z' },
  { id: 'demo-receipt-hp', grn: 'GRN-DEMO-0002', vendorId: 'demo-vendor-VND-HP', purchaseOrder: 'DEMO-PO-1002', invoiceNumber: 'DEMO-INV-1002', receivedDate: '2026-08-02', receivedBy: 'Demo Store Receiver', typeId: 'type-default-LAPTOP', modelId: 'demo-model-ELITE-840', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo stock accepted after visual inspection.', createdAt: '2026-08-02T09:00:00.000Z' },
  { id: 'demo-receipt-monitor', grn: 'GRN-DEMO-0003', vendorId: 'demo-vendor-VND-DELL', purchaseOrder: 'DEMO-PO-1003', invoiceNumber: 'DEMO-INV-1003', receivedDate: '2026-08-03', receivedBy: 'Demo Store Receiver', typeId: 'type-default-MONITOR', modelId: 'demo-model-P2422H', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo display accepted after visual inspection.', createdAt: '2026-08-03T09:00:00.000Z' },
  { id: 'demo-receipt-switch', grn: 'GRN-DEMO-0004', vendorId: 'demo-vendor-VND-CISCO', purchaseOrder: 'DEMO-PO-1004', invoiceNumber: 'DEMO-INV-1004', receivedDate: '2026-08-04', receivedBy: 'Demo Store Receiver', typeId: 'type-default-SWITCH', modelId: 'demo-model-CBS350', quantity: 1, outcome: 'Accepted', inspectionNote: 'Demo network equipment accepted after inspection.', createdAt: '2026-08-04T09:00:00.000Z' },
]

const demoAssets: Asset[] = [
  ['GL-IT-DEMO-001', 'demo-receipt-laptop', 'LAPTOP', 'LAT-5440', 'DEMO-LAT-001', 'LAP-STD', 72500], ['GL-IT-DEMO-002', 'demo-receipt-laptop', 'LAPTOP', 'LAT-5440', 'DEMO-LAT-002', 'LAP-STD', 72500], ['GL-IT-DEMO-003', 'demo-receipt-hp', 'LAPTOP', 'ELITE-840', 'DEMO-HP-001', 'LAP-PRO', 88500], ['GL-IT-DEMO-004', 'demo-receipt-monitor', 'MONITOR', 'P2422H', 'DEMO-MON-001', 'MON-24', 14500], ['GL-IT-DEMO-005', 'demo-receipt-switch', 'SWITCH', 'CBS350', 'DEMO-SW-001', 'SW-24P', 42000],
].map(([assetId, receiptId, type, model, serialNumber, config, cost]) => ({ id: `demo-asset-${assetId}`, assetId: String(assetId), receiptId: String(receiptId), typeId: `type-default-${type}`, modelId: `demo-model-${model}`, serialNumber: String(serialNumber), locationId: 'demo-location-AMB-HO', configId: `demo-config-${config}`, purchaseDate: '2026-08-01', cost: Number(cost), condition: 'New', stockStatus: 'In stock', createdAt: '2026-08-01T10:00:00.000Z' }))

export default function InventoryOperations({ mode, initialAssetCode = '' }: { mode: 'Goods receipt' | 'Asset register'; initialAssetCode?: string }) {
  const [activeRole] = useLocalStore<RoleId>('itms.active-role.v1', 'administrator')
  const [vendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [assetGroups] = useLocalStore<AssetGroup[]>('itms.asset-groups.v1', [])
  const [types] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [models] = useLocalStore<AssetModel[]>('itms.asset-models.v1', [])
  const [profiles] = useLocalStore<ConfigProfile[]>('itms.config-profiles.v1', [])
  const [customSpecifications] = useLocalStore<SpecificationField[]>('itms.asset-specifications.v1', [])
  const [modelSpecificationDefaults] = useLocalStore<ModelSpecificationDefaults[]>('itms.asset-model-specifications.v1', [])
  const [,setSpecificationHistory] = useLocalStore<SpecificationChange[]>('itms.asset-specification-history.v1', [])
  const [locations] = useLocalStore<Location[]>('itms.locations.v1', [])
  const [receipts, setReceipts] = useLocalStore<Receipt[]>('itms.receipts.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [allocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [movements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [lifecycle] = useLocalStore<Lifecycle[]>('itms.employee-lifecycle.v1', [])
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [maintenance] = useLocalStore<MaintenanceRecord[]>('itms.asset-maintenance.v1', [])
  const [verifications] = useLocalStore<VerificationRecord[]>('itms.asset-verifications.v1', [])
  const [disposals] = useLocalStore<DisposalRecord[]>('itms.asset-disposals.v1', [])
  const [retirements] = useLocalStore<RetirementRecord[]>('itms.asset-retirements.v1', [])
  const [warrantyClaims] = useLocalStore<WarrantyClaim[]>('itms.warranty-claims.v1', [])
  const [codeRules, setCodeRules] = useLocalStore<InventoryCodeRule[]>('itms.inventory-code-rules.v1', [])
  const [receiptForm, setReceiptForm] = useState(newReceipt)
  const [receiptLines, setReceiptLines] = useState<ReceiptLineDraft[]>([blankReceiptLine()])
  const [assetForm, setAssetForm] = useState(newAsset)
  const [registrationQuantity, setRegistrationQuantity] = useState('1')
  const [serialNumbers, setSerialNumbers] = useState('')
  const [billFile,setBillFile]=useState<File|null>(null)
  const [receiptEdit, setReceiptEdit] = useState<Receipt | null>(null)
  const [voidingReceipt, setVoidingReceipt] = useState<Receipt | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [registrationGroupId, setRegistrationGroupId] = useState('')
  const [registrationGrnId, setRegistrationGrnId] = useState('')
  const [registrationLineKeys, setRegistrationLineKeys] = useState<string[]>([])
  const [registrationDraftReady, setRegistrationDraftReady] = useState(false)

  useEffect(() => {
    setReceipts((current) => [...current, ...demoReceipts.filter((seed) => !current.some((item) => item.grn === seed.grn))])
    setAssets((current) => [...current, ...demoAssets.filter((seed) => !current.some((item) => item.assetId === seed.assetId))])
  }, [setAssets, setReceipts])
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [receiptSearch, setReceiptSearch] = useState('')
  const [formHint, setFormHint] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [brandFilter,setBrandFilter]=useState('all')
  const [profileFilter,setProfileFilter]=useState('all')
  const [cpuFilter,setCpuFilter]=useState('')
  const [ramFilter,setRamFilter]=useState('')
  const [storageFilter,setStorageFilter]=useState('')
  const [assetSearch, setAssetSearch] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const initialAssetOpened = useRef(false)
  const [assetEdit, setAssetEdit] = useState<Asset | null>(null)
  const [assetIdChange, setAssetIdChange] = useState<{ asset: Asset; nextId: string } | null>(null)
  const [showAssetHistory, setShowAssetHistory] = useState(false)
  const [registerView, setRegisterView] = useState<'Active' | 'Removed'>('Active')
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [assetSort, setAssetSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'assetId', direction: 'asc' })
  const audit = useMasterAudit()
  const receiptEditHasAssets = Boolean(receiptEdit && assets.some((asset) => asset.receiptId === receiptEdit.id))

  useEffect(() => {
    if (mode !== 'Asset register' || registrationDraftReady) return
    try {
      const draft = JSON.parse(window.localStorage.getItem('itms.asset-registration-draft.v1') ?? '{}') as Partial<{ groupId: string; grnId: string; lineKeys: string[]; assetForm: typeof newAsset; quantity: string; serialNumbers: string }>
      if (draft.groupId) setRegistrationGroupId(draft.groupId)
      if (draft.grnId) setRegistrationGrnId(draft.grnId)
      if (draft.lineKeys) setRegistrationLineKeys(draft.lineKeys)
      if (draft.assetForm) setAssetForm(draft.assetForm)
      if (draft.quantity) setRegistrationQuantity(draft.quantity)
      if (draft.serialNumbers) setSerialNumbers(draft.serialNumbers)
    } catch { /* A corrupt local draft is ignored safely. */ }
    setRegistrationDraftReady(true)
  }, [mode, registrationDraftReady])

  useEffect(() => {
    if (mode !== 'Asset register' || !registrationDraftReady || !formOpen) return
    window.localStorage.setItem('itms.asset-registration-draft.v1', JSON.stringify({ groupId: registrationGroupId, grnId: registrationGrnId, lineKeys: registrationLineKeys, assetForm, quantity: registrationQuantity, serialNumbers, updatedAt: new Date().toISOString() }))
  }, [assetForm, formOpen, mode, registrationDraftReady, registrationGrnId, registrationGroupId, registrationLineKeys, registrationQuantity, serialNumbers])

  const acceptedReceiptLines = useMemo(() => receipts.flatMap((receipt) => receipt.outcome !== 'Accepted' ? [] : receiptLinesFor(receipt).filter((line) => assets.filter((asset) => asset.receiptId === receipt.id && (asset.receiptLineId ?? 'legacy') === line.id).length < line.quantity).map((line) => ({ receipt, line }))), [assets, receipts])
  const registrationReceipts = useMemo(() => receipts.filter((receipt) => receipt.outcome === 'Accepted' && (receipt.groupId ?? types.find((type) => type.id === receipt.typeId)?.groupId) === registrationGroupId && acceptedReceiptLines.some((entry) => entry.receipt.id === receipt.id)), [acceptedReceiptLines, receipts, registrationGroupId, types])
  const registrationLines = useMemo(() => acceptedReceiptLines.filter((entry) => (!registrationGroupId || (entry.receipt.groupId ?? types.find((type) => type.id === entry.line.typeId)?.groupId) === registrationGroupId) && (!registrationGrnId || entry.receipt.id === registrationGrnId)), [acceptedReceiptLines, registrationGroupId, registrationGrnId, types])
  const selectedReceipt = receipts.find((receipt) => receipt.id === assetForm.receiptId)
  const selectedReceiptLine = selectedReceipt ? receiptLinesFor(selectedReceipt).find((line) => line.id === assetForm.receiptLineId) : undefined
  const selectedType = types.find((item) => item.id === selectedReceiptLine?.typeId)
  const selectedSpecifications = specificationsFor(selectedType, customSpecifications)
  const visibleSelectedSpecifications = visibleSpecifications(selectedSpecifications, assetForm.specifications)
  const selectedFilterFields = categoryFilter==='all'?[]:specificationsFor(types.find(item=>item.id===categoryFilter),customSpecifications).filter(field=>field.filterable).map(field=>field.key)
  const selectedCodeRule = codeRules.find((item) => item.typeId === selectedReceiptLine?.typeId && item.status === 'Active')
  const proposedInventoryCode = selectedType ? suggestedCode(selectedCodeRule, selectedType.code, assets) : ''
  const canOverrideInventoryCode = canDo(activeRole, 'manage.inventory')
  const codeFormatFor = (type?: AssetType) => {
    const rule = codeRules.find((item) => item.typeId === type?.id && item.status === 'Active')
    return { prefix: rule?.prefix.trim().toUpperCase() || defaultPrefix(type?.code ?? ''), padding: Math.max(3, Math.min(8, Number(rule?.padding ?? 4))) }
  }
  const selectedCodeFormat = codeFormatFor(selectedType)
  const enteredInventoryCode = assetForm.inventoryCode.trim().toUpperCase()
  const inventoryCodePattern = new RegExp(`^${escapedPattern(selectedCodeFormat.prefix)}-\\d{${selectedCodeFormat.padding}}$`)
  const inventoryCodeError = !enteredInventoryCode ? ''
    : !canOverrideInventoryCode ? 'Only an Asset Manager, IT Head or Administrator can change the generated Asset ID.'
    : !inventoryCodePattern.test(enteredInventoryCode) ? `Use the approved format: ${selectedCodeFormat.prefix}-${'0'.repeat(selectedCodeFormat.padding)}.`
    : assets.some((asset) => asset.assetId.toLowerCase() === enteredInventoryCode.toLowerCase()) ? 'This Asset ID already exists. Enter an unused ID.'
    : ''
  const canEditInventoryCode = Boolean(selectedReceiptLine && Number(registrationQuantity) === 1 && canOverrideInventoryCode)
  const editAssetType = types.find((type) => type.id === assetEdit?.typeId)
  const editCodeFormat = codeFormatFor(editAssetType)
  const editInventoryCode = assetEdit?.assetId.trim().toUpperCase() ?? ''
  const editInventoryCodeError = !assetEdit || !editInventoryCode ? 'Asset ID is required.'
    : !canOverrideInventoryCode ? 'Only an Asset Manager, IT Head or Administrator can change the Asset ID.'
    : !new RegExp(`^${escapedPattern(editCodeFormat.prefix)}-\\d{${editCodeFormat.padding}}$`).test(editInventoryCode) ? `Use the approved format: ${editCodeFormat.prefix}-${'0'.repeat(editCodeFormat.padding)}.`
    : assets.some((asset) => asset.id !== assetEdit.id && asset.assetId.toLowerCase() === editInventoryCode.toLowerCase()) ? 'This Asset ID already exists. Enter an unused ID.'
    : ''
  const assetIdChangeType = types.find((type) => type.id === assetIdChange?.asset.typeId)
  const assetIdChangeFormat = codeFormatFor(assetIdChangeType)
  const requestedAssetIdChange = assetIdChange?.nextId.trim().toUpperCase() ?? ''
  const assetIdChangeError = !assetIdChange || !requestedAssetIdChange ? 'Enter an Asset ID.'
    : !canOverrideInventoryCode ? 'Only an Asset Manager, IT Head or Administrator can change the Asset ID.'
    : !new RegExp(`^${escapedPattern(assetIdChangeFormat.prefix)}-\\d{${assetIdChangeFormat.padding}}$`).test(requestedAssetIdChange) ? `Use the approved format: ${assetIdChangeFormat.prefix}-${'0'.repeat(assetIdChangeFormat.padding)}.`
    : assets.some((asset) => asset.id !== assetIdChange.asset.id && asset.assetId.toLowerCase() === requestedAssetIdChange.toLowerCase()) ? 'This Asset ID already exists. Enter an unused ID.'
    : ''
  const registeredForSelected = selectedReceipt && selectedReceiptLine ? assets.filter((asset) => asset.receiptId === selectedReceipt.id && (asset.receiptLineId ?? 'legacy') === selectedReceiptLine.id).length : 0
  const remainingForSelected = selectedReceiptLine ? Math.max(0, selectedReceiptLine.quantity - registeredForSelected) : 0
  const receiptMatches = useMemo(() => { const term=receiptSearch.trim().toLowerCase(); return term ? receipts.filter((receipt) => { const vendor=vendors.find(item=>item.id===receipt.vendorId)?.name??''; const group=assetGroups.find(item=>item.id===(receipt.groupId??types.find(type=>type.id===receipt.typeId)?.groupId))?.name??''; const items=receiptLinesFor(receipt).map(line=>`${types.find(type=>type.id===line.typeId)?.name??''} ${models.find(model=>model.id===line.modelId)?.brand??''} ${models.find(model=>model.id===line.modelId)?.name??''}`).join(' '); return `${receipt.grn} ${receipt.invoiceNumber} ${receipt.purchaseOrder} ${vendor} ${group} ${items} ${receipt.outcome} ${receipt.inspectionNote}`.toLowerCase().includes(term) }) : [] },[assetGroups,models,receiptSearch,receipts,types,vendors])
  const assetStatuses = [...new Set(assets.map((asset) => asset.stockStatus))].sort()
  const removedStatuses = ['Scrap', 'Scrapped', 'Archived']
  const activeAssets = assets.filter((asset) => !removedStatuses.includes(asset.stockStatus))
  const missingSpecificationAssets = activeAssets.filter(asset => specificationsFor(types.find(type=>type.id===asset.typeId), customSpecifications).some(field=>field.required && !asset.specifications?.[field.key]?.trim()))
  const removedAssets = assets.filter((asset) => removedStatuses.includes(asset.stockStatus))
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase()
    return assets.filter((asset) => {
      const model = models.find((item) => item.id === asset.modelId)
      const profile=profiles.find((item)=>item.id===asset.configId);const specification=`${profile?.code??''} ${profile?.name??''} ${profile?.cpu??''} ${profile?.ram??''} ${profile?.storage??''} ${profile?.operatingSystem??''} ${profile?.display??''} ${profile?.connectivity??''} ${profile?.identifier??''} ${profile?.specification??''} ${Object.values(asset.specifications??{}).join(' ')}`.toLowerCase()
      return (registerView==='Removed'?removedStatuses.includes(asset.stockStatus):!removedStatuses.includes(asset.stockStatus))&&(categoryFilter==='all'||asset.typeId===categoryFilter)&&(statusFilter==='all'||asset.stockStatus===statusFilter)&&(brandFilter==='all'||model?.brand===brandFilter)&&(profileFilter==='all'||asset.configId===profileFilter)&&(!cpuFilter.trim()||`${profile?.cpu??''} ${profile?.specification??''}`.toLowerCase().includes(cpuFilter.trim().toLowerCase()))&&(!ramFilter.trim()||`${profile?.ram??''} ${profile?.specification??''}`.toLowerCase().includes(ramFilter.trim().toLowerCase()))&&(!storageFilter.trim()||`${profile?.storage??''} ${profile?.specification??''}`.toLowerCase().includes(storageFilter.trim().toLowerCase()))&&(!query||`${asset.assetId} ${asset.serialNumber} ${model?.brand??''} ${model?.name??''} ${specification}`.toLowerCase().includes(query))
    })
  }, [assetSearch,assets,brandFilter,categoryFilter,cpuFilter,models,profileFilter,profiles,ramFilter,statusFilter,storageFilter,registerView])
  const selectedAssetRecord = assets.find((asset) => asset.id === selectedAssetId)
  useEffect(() => { if (mode !== 'Asset register' || !initialAssetCode || initialAssetOpened.current) return; const asset = assets.find((item) => item.assetId.toLowerCase() === initialAssetCode.toLowerCase()); if (asset) { initialAssetOpened.current = true; setAssetSearch(asset.assetId); setSelectedAssetId(asset.id) } }, [assets, initialAssetCode, mode])
  const sortedAssets = useMemo(() => [...filteredAssets].sort((left, right) => {
    const modelFor = (asset: Asset) => models.find((item) => item.id === asset.modelId)
    const valueFor = (asset: Asset): string | number => {
      if (assetSort.key === 'category') return types.find((item) => item.id === asset.typeId)?.name ?? ''
      if (assetSort.key === 'model') return `${modelFor(asset)?.brand ?? ''} ${modelFor(asset)?.name ?? ''}`
      if (assetSort.key === 'location') return locations.find((item) => item.id === asset.locationId)?.name ?? ''
      if (assetSort.key === 'cost') return asset.cost
      if (assetSort.key === 'purchase') return asset.purchaseDate
      if (assetSort.key === 'status') return asset.stockStatus
      return asset.assetId
    }
    const first = valueFor(left); const second = valueFor(right)
    const result = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })
    return assetSort.direction === 'asc' ? result : -result
  }), [filteredAssets, assetSort, locations, models, types])
  const categoryCounts = types.map((type) => ({ ...type, count: (registerView === 'Removed' ? removedAssets : activeAssets).filter((asset) => asset.typeId === type.id).length })).filter((item) => item.count > 0)

  function userLabel(id: string) { const user = users.find((item) => item.id === id); return user ? `${user.employeeCode} · ${user.name}` : 'User unavailable' }
  function assetHistory(asset: Asset) {
    const receipt = receipts.find((item) => item.id === asset.receiptId)
    const events: { id: string; at: string; title: string; detail: string }[] = [{ id: `registered-${asset.id}`, at: asset.createdAt, title: 'Asset registered', detail: `Created as ${asset.stockStatus} · purchase date ${asset.purchaseDate}` }]
    if (receipt) events.push({ id: `receipt-${receipt.id}`, at: receipt.createdAt, title: `Purchased / received · ${receipt.grn}`, detail: `Invoice ${receipt.invoiceNumber} · ${vendors.find((item) => item.id === receipt.vendorId)?.name ?? 'Vendor unavailable'} · outcome ${receipt.outcome}` })
    allocations.filter((item) => item.assetIds.includes(asset.id) || item.replacementAssetId === asset.id).forEach((item) => events.push({ id: `allocation-${item.id}`, at: item.itHeadApprovedAt || item.requestedAt, title: `${item.code} · ${item.replacementAssetId === asset.id ? 'Replaced / released' : item.allocationKind ?? 'Allocation'}`, detail: `${userLabel(item.userId)} · ${item.state}` }))
    movements.filter((item) => item.assetId === asset.id).forEach((item) => events.push({ id: `movement-${item.id}`, at: item.itHeadApprovedAt || item.requestedAt, title: `${item.code} · ${item.kind}`, detail: item.kind === 'Transfer' ? `${userLabel(item.fromUserId)} → ${userLabel(item.toUserId)} · ${item.state}` : `${userLabel(item.fromUserId)} → ${item.disposition ?? 'Return processing'} · ${item.state}` }))
    lifecycle.filter((item) => item.assetIds.includes(asset.id)).forEach((item) => events.push({ id: `lifecycle-${item.id}`, at: item.createdAt, title: `${item.code} · Employee ${item.kind}`, detail: `${userLabel(item.userId)} · ${item.state}${item.disposition ? ` · ${item.disposition}` : ''}` }))
    maintenance.filter((item) => item.assetId === asset.id).forEach((item) => events.push({ id: `maintenance-${item.id}`, at: item.completedAt || item.createdAt, title: `${item.code} · ${item.activity}`, detail: item.state === 'Completed' ? `${item.outcome} · ${item.findings} · ₹${item.cost.toLocaleString('en-IN')}${item.nextDueDate ? ` · next due ${item.nextDueDate}` : ''}` : `${item.state} · due ${item.dueDate} · ${item.responsible}` }))
    verifications.filter((item) => item.assetId === asset.id).forEach((item) => events.push({ id: `verification-${item.id}`, at: item.createdAt, title: `${item.code} · Physical verification`, detail: `${item.result} · ${item.observedLocation} · ${item.notes}` }))
    disposals.filter((item) => item.assetId === asset.id).forEach((item) => events.push({ id: `disposal-${item.id}`, at: item.headAt || item.managerAt || item.requestedAt, title: `${item.code} · Disposal / write-off`, detail: `${item.state} · ${item.method} · ${item.reason}` }))
    retirements.filter((item) => (item.assetIds?.length ? item.assetIds : item.assetId ? [item.assetId] : []).includes(asset.id)).forEach((item) => events.push({ id: `retirement-${item.id}`, at: item.completedAt || item.headAt || item.managerAt || item.requestedAt, title: `${item.code} · ${item.route}`, detail: `${item.state} · ${item.partyName} · ${item.reason}` }))
    warrantyClaims.filter((item) => item.assetId === asset.id || item.replacementAssetId === asset.id).forEach((item) => events.push({ id: `warranty-${item.id}`, at: item.updatedAt || item.reportedDate, title: `${item.code} · Warranty / RMA ${item.claimStatus}`, detail: `${item.rmaReference || 'No RMA reference'} · ${item.resolutionType || 'Outcome pending'} · ${item.replacementOutcome || 'No progress note'}${item.replacementAssetId ? ` · replacement ${assets.find((value) => value.id === item.replacementAssetId)?.assetId ?? item.replacementAssetId}` : ''}` }))
    return events.sort((a, b) => b.at.localeCompare(a.at))
  }

  function nextCode(prefix: string, count: number) { return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}` }
  function closeForm() { setFormOpen(false);setReceiptEdit(null);setFormHint('');setReceiptForm(newReceipt);setReceiptLines([blankReceiptLine()]);setAssetForm(newAsset);setRegistrationQuantity('1');setSerialNumbers('');setBillFile(null);setRegistrationGroupId('');setRegistrationGrnId('');setRegistrationLineKeys([]);window.localStorage.removeItem('itms.asset-registration-draft.v1') }

  async function saveReceipt(event: FormEvent) {
    event.preventDefault()
    if (!receiptForm.groupId) { setMessage('Select an Asset Group from Asset Group Master before recording the GRN.'); return }
    const validLines = receiptLines.filter((line) => line.typeId && line.modelId && Number(line.quantity) > 0)
    if (!validLines.length || validLines.length !== receiptLines.length) { setMessage('Complete every receipt line with an asset type, model and positive quantity.'); return }
    const billProblem = validateInventoryBill(billFile)
    if (billProblem) { setMessage(billProblem); return }
    const lines = validLines.map((line) => ({ ...line, quantity: Number(line.quantity) }))
    const firstLine = lines[0]
    const now = new Date().toISOString()
    const receipt: Receipt = { id: receiptEdit?.id ?? `receipt-${crypto.randomUUID()}`, grn: receiptEdit?.grn ?? nextCode('GRN', receipts.length), ...receiptForm, typeId: firstLine.typeId, modelId: firstLine.modelId, quantity: lines.reduce((sum, line) => sum + line.quantity, 0), lines, invoiceNumber: receiptForm.invoiceNumber.trim(), purchaseOrder: receiptForm.purchaseOrder.trim(), inspectionNote: receiptForm.inspectionNote.trim(), bill: receiptEdit?.bill, createdAt: receiptEdit?.createdAt ?? now, updatedAt: receiptEdit ? now : undefined }
    setReceipts((current) => receiptEdit ? current.map((item) => item.id === receipt.id ? receipt : item) : [...current, receipt])
    if (receiptEdit) audit.record({ module: 'Goods receipt', recordId: receipt.id, recordCode: receipt.grn, action: 'Updated', changedFields: changedFields(receiptEdit as unknown as Record<string, unknown>, receipt as unknown as Record<string, unknown>) })
    if (billFile) {
      try {
        const session = await beginInventoryAttachmentUpload()
        const bill = await queueInventoryBill(receipt.id, receipt.grn, billFile, firebaseAuth?.currentUser?.email || receiptForm.receivedBy, session)
        setReceipts((current) => current.map((item) => item.id === receipt.id ? { ...item, bill } : item))
        setMessage(`${receipt.grn} ${receiptEdit ? 'updated' : 'recorded'}. Bill is copying to the controlled Glassco Drive archive.`)
      } catch (error) {
        setMessage(`${receipt.grn} recorded, but its bill could not be queued: ${error instanceof Error ? error.message : 'retry from the receipt record.'}`)
      }
    } else setMessage(`${receipt.grn} ${receiptEdit ? 'updated' : 'recorded'} with outcome ${receipt.outcome}.`)
    closeForm()
  }

  function saveAsset(event: FormEvent) {
    event.preventDefault()
    if (!selectedReceipt || !selectedReceiptLine || selectedReceipt.outcome !== 'Accepted' || registeredForSelected >= selectedReceiptLine.quantity) return
    const quantity = Math.min(Number(registrationQuantity), remainingForSelected)
    const serials = serialNumbers.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!Number.isInteger(quantity) || quantity < 1) { setMessage('Enter a valid number of units to register.'); return }
    if (selectedType?.trackingMode !== 'Consumable' && serials.length !== quantity) { setMessage(`Enter exactly ${quantity} serial number${quantity === 1 ? '' : 's'}, one per line.`); return }
    if (new Set(serials.map((item) => item.toLowerCase())).size !== serials.length || serials.some((serial) => assets.some((asset) => asset.serialNumber.toLowerCase() === serial.toLowerCase()))) { setMessage('Serial numbers must be unique and must not already exist in the asset register.'); return }
    if (enteredInventoryCode && !canOverrideInventoryCode) { setMessage('Only an Asset Manager, IT Head or Administrator can override the generated Asset ID.'); return }
    if (enteredInventoryCode && inventoryCodeError) { setMessage(inventoryCodeError); return }
    const requestedCode = assetForm.inventoryCode.trim().toUpperCase() || proposedInventoryCode
    const codeMatch = requestedCode.match(/^(.*)-(\d+)$/)
    const generatedCodes = Array.from({ length: quantity }, (_, index) => codeMatch ? `${codeMatch[1]}-${String(Number(codeMatch[2]) + index).padStart(codeMatch[2].length, '0')}` : index === 0 ? requestedCode : `${requestedCode}-${index + 1}`)
    if (!requestedCode || new Set(generatedCodes).size !== generatedCodes.length || generatedCodes.some((code) => assets.some((asset) => asset.assetId.toLowerCase() === code.toLowerCase()))) { setMessage('Inventory code must be unique. Review the proposed code or enter a valid unused legacy code.'); return }
    const createdAt = new Date().toISOString()
    const missingSpecification=selectedSpecifications.find(field=>field.required&&!assetForm.specifications[field.key]?.trim());if(missingSpecification){setMessage(`${missingSpecification.name} is required for ${selectedType?.name??'this item type'}.`);return}
    const created: Asset[] = Array.from({ length: quantity }, (_, index) => ({ id: `asset-${crypto.randomUUID()}`, assetId: generatedCodes[index], receiptId: selectedReceipt.id, receiptLineId: selectedReceiptLine.id, typeId: selectedReceiptLine.typeId, modelId: selectedReceiptLine.modelId, serialNumber: serials[index] ?? assetForm.serialNumber.trim(), locationId: assetForm.locationId, configId: assetForm.configId, specifications:assetForm.specifications,iconName:assetForm.iconName, purchaseDate: assetForm.purchaseDate, cost: Number(assetForm.cost), condition: assetForm.condition, stockStatus: assetForm.stockStatus, createdAt }))
    setSpecificationHistory(current=>[...current,...created.flatMap(asset=>Object.entries(asset.specifications??{}).filter(([,value])=>value).map(([key,nextValue])=>({id:crypto.randomUUID(),assetId:asset.id,key,previousValue:'',nextValue,changedAt:createdAt,changedBy:'Current ITMS user',source:'Registration' as const})))])
    setAssets((current) => [...current, ...created])
    if (selectedCodeRule && codeMatch) { const issued = Number(codeMatch[2]) + quantity; setCodeRules((current) => current.map((rule) => rule.id === selectedCodeRule.id ? { ...rule, nextNumber: Math.max(rule.nextNumber, issued), updatedAt: createdAt } : rule)) }
    if (assetForm.inventoryCode.trim() && assetForm.inventoryCode.trim().toUpperCase() !== proposedInventoryCode) audit.record({ module: 'Asset register', recordId: created[0].id, recordCode: created[0].assetId, action: 'Updated', changedFields: `Inventory code override · Proposed: ${proposedInventoryCode} → Issued: ${created[0].assetId}` })
    setMessage(`${created.length} asset${created.length === 1 ? '' : 's'} created: ${created[0].assetId}${created.length > 1 ? ` to ${created.at(-1)?.assetId}` : ''}.`)
    const activeKey = `${selectedReceipt.id}|${selectedReceiptLine.id}`
    const nextKey = quantity < remainingForSelected ? activeKey : registrationLineKeys.find((key) => key !== activeKey)
    if (quantity >= remainingForSelected) setRegistrationLineKeys((current) => current.filter((key) => key !== activeKey))
    if (nextKey) { const [receiptId, receiptLineId] = nextKey.split('|'); chooseRegistrationLine(receiptId, receiptLineId) } else { setAssetForm({ ...assetForm, receiptId: '', receiptLineId: '', inventoryCode: '', specifications: {} }); setRegistrationQuantity('1'); setSerialNumbers('') }
  }

  function editReceipt(receipt: Receipt) {
    setReceiptEdit(receipt)
    setReceiptForm({ groupId: receipt.groupId ?? types.find((type) => type.id === receipt.typeId)?.groupId ?? '', vendorId: receipt.vendorId, invoiceNumber: receipt.invoiceNumber, purchaseOrder: receipt.purchaseOrder, receivedDate: receipt.receivedDate, receivedBy: receipt.receivedBy, typeId: receipt.typeId, modelId: receipt.modelId, quantity: String(receipt.quantity), outcome: receipt.outcome === 'Voided' ? 'Rejected' : receipt.outcome, inspectionNote: receipt.inspectionNote })
    setReceiptLines(receiptLinesFor(receipt).map((line) => ({ ...line, quantity: String(line.quantity) })))
    setBillFile(null); setFormOpen(true); setMessage('Manager correction mode: update the receipt header or inspection record. Item lines are protected after registration.')
  }

  function removeOrVoidReceipt(receipt: Receipt) {
    const linkedAssets = assets.some((asset) => asset.receiptId === receipt.id)
    if (linkedAssets) { setVoidingReceipt(receipt); setVoidReason(''); return }
    setReceipts((current) => current.filter((item) => item.id !== receipt.id))
    audit.record({ module: 'Goods receipt', recordId: receipt.id, recordCode: receipt.grn, action: 'Status changed', changedFields: 'Manager removed an unregistered GRN.' })
    setMessage(`${receipt.grn} was removed. No assets had been registered from it.`)
  }

  function confirmVoidReceipt(event: FormEvent) {
    event.preventDefault()
    if (!voidingReceipt || !voidReason.trim()) return
    const now = new Date().toISOString()
    setReceipts((current) => current.map((item) => item.id === voidingReceipt.id ? { ...item, outcome: 'Voided', voidReason: voidReason.trim(), voidedAt: now, updatedAt: now } : item))
    audit.record({ module: 'Goods receipt', recordId: voidingReceipt.id, recordCode: voidingReceipt.grn, action: 'Status changed', changedFields: `GRN voided · Manager reason: ${voidReason.trim()}` })
    setVoidingReceipt(null); setVoidReason(''); setMessage(`${voidingReceipt.grn} was voided. Its linked assets and audit trail remain intact.`)
  }

  function saveAssetEdit(event: FormEvent) {
    event.preventDefault()
    if (!assetEdit) return
    if (assetEdit.assetId !== (assets.find((item) => item.id === assetEdit.id)?.assetId ?? assetEdit.assetId) && !canOverrideInventoryCode) { setMessage('Only an Asset Manager, IT Head or Administrator can change the Asset ID.'); return }
    if (editInventoryCodeError) { setMessage(editInventoryCodeError); return }
    const normalizedAssetEdit = { ...assetEdit, assetId: editInventoryCode }
    if (normalizedAssetEdit.serialNumber && assets.some((item) => item.id !== normalizedAssetEdit.id && item.serialNumber.toLowerCase() === normalizedAssetEdit.serialNumber.toLowerCase())) { setMessage('Serial number already belongs to another asset.'); return }
    const before = assets.find((item) => item.id === normalizedAssetEdit.id)
    setAssets((current) => current.map((item) => item.id === normalizedAssetEdit.id ? normalizedAssetEdit : item))
    if(before){const keys=new Set([...Object.keys(before.specifications??{}),...Object.keys(normalizedAssetEdit.specifications??{})]);const now=new Date().toISOString();setSpecificationHistory(current=>[...current,...[...keys].flatMap(key=>{const previousValue=before.specifications?.[key]??'';const nextValue=normalizedAssetEdit.specifications?.[key]??'';return previousValue===nextValue?[]:[{id:crypto.randomUUID(),assetId:normalizedAssetEdit.id,key,previousValue,nextValue,changedAt:now,changedBy:'Current ITMS user',source:'Edit' as const}]})])}
    if (before) audit.record({ module: 'Asset register', recordId: normalizedAssetEdit.id, recordCode: normalizedAssetEdit.assetId, action: 'Updated', changedFields: changedFields(before as unknown as Record<string, unknown>, normalizedAssetEdit as unknown as Record<string, unknown>) })
    const assetIdChanged = before?.assetId !== normalizedAssetEdit.assetId
    setAssetSearch(normalizedAssetEdit.assetId)
    setSelectedAssetId(normalizedAssetEdit.id)
    setMessage(assetIdChanged ? `Asset ID updated: ${before?.assetId} → ${normalizedAssetEdit.assetId}. The revised live record is now open.` : `${normalizedAssetEdit.assetId} updated. The revised live record is now open.`)
    setAssetEdit(null)
  }

  function saveAssetIdChange(event: FormEvent) {
    event.preventDefault()
    if (!assetIdChange || assetIdChangeError) { setMessage(assetIdChangeError || 'Enter a valid Asset ID.'); return }
    const before = assets.find((item) => item.id === assetIdChange.asset.id)
    if (!before) { setMessage('This asset is no longer available. Refresh the register and try again.'); return }
    const updated = { ...before, assetId: requestedAssetIdChange }
    setAssets((current) => current.map((item) => item.id === updated.id ? updated : item))
    audit.record({ module: 'Asset register', recordId: updated.id, recordCode: updated.assetId, action: 'Updated', changedFields: `Asset ID changed · ${before.assetId} → ${updated.assetId}` })
    setAssetSearch(updated.assetId)
    setSelectedAssetId(updated.id)
    setAssetIdChange(null)
    setMessage(`Asset ID updated: ${before.assetId} → ${updated.assetId}. The revised live record is now open.`)
  }

  function cloneSimilarAsset(asset:Asset){
    const line=acceptedReceiptLines.find(entry=>entry.line.typeId===asset.typeId&&entry.line.modelId===asset.modelId)
    setAssetForm({...newAsset,receiptId:line?.receipt.id??'',receiptLineId:line?.line.id??'',locationId:asset.locationId,configId:asset.configId,specifications:{...(asset.specifications??{})},iconName:asset.iconName??'package',purchaseDate:asset.purchaseDate,cost:String(asset.cost),condition:asset.condition,stockStatus:'In stock'})
    setRegistrationQuantity('1');setSerialNumbers('');setFormOpen(true);setMessage(line?`${asset.assetId} copied as a registration template. Enter the new serial number and verify the GRN line.`:`${asset.assetId} copied as a template. Select an accepted GRN line before saving.`)
  }

  function chooseRegistrationLine(receiptId: string, receiptLineId: string) {
    const entry = acceptedReceiptLines.find((item) => item.receipt.id === receiptId && item.line.id === receiptLineId)
    if (!entry) { setMessage('That GRN line is no longer available for registration. Refresh the batch list and select another line.'); return }
    const defaults = modelSpecificationDefaults.find((item) => item.modelId === entry.line.modelId)?.values ?? {}
    setAssetForm({ ...assetForm, receiptId, receiptLineId, inventoryCode: '', configId: '', specifications: defaults, iconName: suggestedIcon(types.find((item) => item.id === entry.line.typeId)) })
    setRegistrationQuantity('1'); setSerialNumbers('')
  }

  function toggleAssetRemoval(asset: Asset) {
    const allocated = allocations.some((item) => item.assetIds.includes(asset.id) && item.state === 'Approved')
    if (!['Scrap','Scrapped','Archived'].includes(asset.stockStatus) && allocated) { setMessage(`${asset.assetId} is allocated and cannot be removed until custody is revoked.`); return }
    const nextStatus = ['Scrap','Scrapped','Archived'].includes(asset.stockStatus) ? 'In stock' : 'Archived'
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, stockStatus: nextStatus } : item))
    audit.record({ module: 'Asset register', recordId: asset.id, recordCode: asset.assetId, action: 'Status changed', changedFields: `stockStatus: ${asset.stockStatus} → ${nextStatus}` })
    setMessage(`${asset.assetId} ${nextStatus === 'Archived' ? 'removed from active inventory' : 'restored to stock'}. History was retained.`)
  }

  return <section className="master-panel inventory-operations">
    <div className={`operation-heading ${mode==='Asset register'?'asset-register-heading':''}`}><div><span className="eyebrow">{mode === 'Goods receipt' ? 'INCOMING GOODS CONTROL' : 'INDIVIDUAL ASSET CONTROL'}</span><h2>{mode === 'Goods receipt' ? 'Goods receipt & inspection' : 'Asset register'}</h2>{mode==='Asset register'?<label className="asset-quick-search"><Icon name="inventory" size={18}/><input type="search" value={assetSearch} onChange={(event)=>setAssetSearch(event.target.value)} placeholder="Search asset ID, serial number, model or configuration"/>{assetSearch&&<button type="button" onClick={()=>setAssetSearch('')}>Clear</button>}</label>:<p>Record delivery references, quantity verification and inspection disposition.</p>}</div><button type="button" className="primary-action" onClick={() => { if (formOpen) closeForm(); else setFormOpen(true) }}><Icon name="plus" size={18}/> {mode === 'Goods receipt' ? 'Record receipt' : 'Register asset'}</button></div>

    {formOpen && mode === 'Goods receipt' && <form className="master-form operation-form grn-receipt-form" onSubmit={saveReceipt}>
      {receiptEdit && <div className="legacy-configuration-note wide-field"><strong>Manager correction mode · {receiptEdit.grn}</strong><span>{receiptEditHasAssets ? 'Header details and inspection remarks can be corrected. Invoice lines are locked because assets have already been registered from this GRN.' : 'Correct any receipt header, invoice line or inspection detail before this GRN is used for registration.'}</span></div>}
      <label className="grn-group-selector"><span>Asset Group Master</span><select required disabled={receiptEditHasAssets} value={receiptForm.groupId} onChange={(event) => { setFormHint(''); setReceiptForm({ ...receiptForm, groupId: event.target.value }); setReceiptLines([blankReceiptLine()]) }}><option value="">Select asset group first</option>{assetGroups.filter((group) => group.status === 'Active').map((group) => <option value={group.id} key={group.id}>{group.code} · {group.name}</option>)}</select><small>Controls the categories available on this GRN.</small></label>
      <label>Vendor<select required value={receiptForm.vendorId} onChange={(event) => setReceiptForm({ ...receiptForm, vendorId: event.target.value })}><option value="">Select vendor</option>{vendors.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Invoice number<input required value={receiptForm.invoiceNumber} onChange={(event) => setReceiptForm({ ...receiptForm, invoiceNumber: event.target.value })} /></label>
      <label>Purchase order reference<input value={receiptForm.purchaseOrder} onChange={(event) => setReceiptForm({ ...receiptForm, purchaseOrder: event.target.value })} /></label>
      <label>Received date<input required type="date" value={receiptForm.receivedDate} onChange={(event) => setReceiptForm({ ...receiptForm, receivedDate: event.target.value })} /></label>
      <label className="grn-received-by">Received by<input readOnly value={receiptForm.receivedBy} /></label>
      <fieldset className="receipt-lines wide-field"><legend>Invoice line items <span>one GRN is organised under one Asset Group Master</span></legend>{formHint && <div className="form-inline-error" role="alert">{formHint}</div>}{receiptLines.map((line, index) => <div className="receipt-line" key={line.id}><b>{index + 1}</b><label>Asset type<select disabled={receiptEditHasAssets} required value={line.typeId} onPointerDown={() => { if (!receiptForm.groupId) setFormHint('Select an Asset Group Master first. It controls which asset categories can be added to this GRN.') }} onChange={(event) => { if (!receiptForm.groupId) { setFormHint('Select an Asset Group Master first.'); return }; setFormHint(''); setReceiptLines((current) => current.map((item) => item.id === line.id ? { ...item, typeId: event.target.value, modelId: '' } : item)) }}><option value="">{receiptForm.groupId ? 'Select type' : 'Select Asset Group first'}</option>{types.filter((item) => item.status === 'Active' && item.groupId === receiptForm.groupId).map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Model<select disabled={receiptEditHasAssets} required value={line.modelId} onPointerDown={() => { if (!line.typeId) setFormHint('Select an Asset Type first, then choose its available model.') }} onChange={(event) => { if (!line.typeId) { setFormHint('Select an Asset Type first, then choose its available model.'); return }; setFormHint(''); setReceiptLines((current) => current.map((item) => item.id === line.id ? { ...item, modelId: event.target.value } : item)) }}><option value="">{line.typeId ? 'Select model' : 'Select Asset Type first'}</option>{models.filter((item) => item.status === 'Active' && item.typeId === line.typeId).map((item) => <option value={item.id} key={item.id}>{item.brand} · {item.name}</option>)}</select></label><label>Quantity<input disabled={receiptEditHasAssets} required type="number" min="1" max="1000" value={line.quantity} onChange={(event) => setReceiptLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} /></label><button type="button" onClick={() => { if (receiptEditHasAssets) { setFormHint('Invoice lines are locked because assets are already registered from this GRN.'); return }; if (receiptLines.length === 1) { setFormHint('A GRN must contain at least one invoice line. Add another line before removing this one.'); return }; setReceiptLines((current) => current.filter((item) => item.id !== line.id)) }}>Remove</button></div>)}<button type="button" className="add-receipt-line" onClick={() => { if (receiptEditHasAssets) { setFormHint('Invoice lines are locked because assets are already registered from this GRN.'); return }; if (!receiptForm.groupId) { setFormHint('Select an Asset Group Master before adding an invoice line.'); return }; setFormHint(''); setReceiptLines((current) => [...current, blankReceiptLine()]) }}>＋ Add invoice line</button></fieldset>
      <label>Inspection outcome<select value={receiptForm.outcome} onChange={(event) => setReceiptForm({ ...receiptForm, outcome: event.target.value as ReceiptOutcome })}><option>Accepted</option><option>Quarantined</option><option>Rejected</option></select></label>
      <label className="wide-field">Inspection note<textarea required value={receiptForm.inspectionNote} onChange={(event) => setReceiptForm({ ...receiptForm, inspectionNote: event.target.value })} placeholder="Condition, quantity verification and exceptions" /></label>
      <label className="wide-field grn-bill">Invoice / bill evidence<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={(event)=>setBillFile(event.target.files?.[0]??null)}/><small>{billFile?`${billFile.name} · ${(billFile.size/1024).toFixed(0)} KB`:'Optional · PDF, Office, CSV, text or image · maximum 15 MB · retained in Glassco Drive'}</small></label>
      <div className="form-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit" className="primary-action">{receiptEdit ? 'Save GRN changes' : 'Save receipt'}</button></div>
    </form>}
    {mode === 'Goods receipt' && <section className="grn-search-panel"><label><Icon name="inventory" size={17}/><input type="search" value={receiptSearch} onChange={(event)=>setReceiptSearch(event.target.value)} placeholder="Search GRN, invoice, PO, vendor, item, group or inspection result"/>{receiptSearch&&<button type="button" onClick={()=>setReceiptSearch('')}>Clear</button>}</label>{receiptSearch&&<div className="grn-search-results">{receiptMatches.slice(0,6).map((receipt)=><button type="button" key={receipt.id} onClick={()=>editReceipt(receipt)}><strong>{receipt.grn}</strong><span>{receipt.invoiceNumber||'No invoice'} · {receipt.receivedDate} · {receipt.outcome}</span></button>)}{!receiptMatches.length&&<span>No GRN records match this search.</span>}</div>}</section>}

    {formOpen && mode === 'Asset register' && <form className="master-form operation-form asset-registration-form" onSubmit={saveAsset}>
      <div className="batch-register-heading wide-field"><strong>Register GRN items</strong><span>Filter by Asset Group and GRN, select the receipt lines to prepare, then open each line for its category-specific serials and specifications.</span></div>
      <label>Asset Group Master<select required value={registrationGroupId} onChange={(event) => { setRegistrationGroupId(event.target.value); setRegistrationGrnId(''); setRegistrationLineKeys([]); setAssetForm({ ...assetForm, receiptId: '', receiptLineId: '', specifications: {} }) }}><option value="">Select asset group</option>{assetGroups.filter((group) => group.status === 'Active').map((group) => <option value={group.id} key={group.id}>{group.code} · {group.name}</option>)}</select></label>
      <label>Goods receipt / GRN<select required disabled={!registrationGroupId} value={registrationGrnId} onChange={(event) => { setRegistrationGrnId(event.target.value); setRegistrationLineKeys([]); setAssetForm({ ...assetForm, receiptId: '', receiptLineId: '', specifications: {} }) }}><option value="">Select GRN</option>{registrationReceipts.map((receipt) => <option value={receipt.id} key={receipt.id}>{receipt.grn} · {receipt.invoiceNumber || 'No invoice'} · {receipt.receivedDate}</option>)}</select><small>{registrationGroupId ? `${registrationReceipts.length} GRN${registrationReceipts.length === 1 ? '' : 's'} with pending lines` : 'Select Asset Group first'}</small></label>
      <section className="batch-registration-table wide-field"><header><div><strong>Pending GRN lines</strong><small>{registrationLines.length} line{registrationLines.length === 1 ? '' : 's'} available · {registrationLineKeys.length} selected</small></div><button type="button" className="secondary-action" onClick={() => { const first = registrationLines.find((entry) => registrationLineKeys.includes(`${entry.receipt.id}|${entry.line.id}`)); if (!first) { setMessage('Select at least one pending GRN line before opening it for registration.'); return }; chooseRegistrationLine(first.receipt.id, first.line.id) }}>Open selected line</button></header><DataTable tableId="itms-grn-registration-batch" configurable rows={registrationLines} rowKey={(entry) => `${entry.receipt.id}|${entry.line.id}`} columns={[{ key: 'select', label: 'Select', sticky: true, width: '92px', render: (entry) => { const key = `${entry.receipt.id}|${entry.line.id}`; return <input aria-label={`Select ${entry.receipt.grn} line`} type="checkbox" checked={registrationLineKeys.includes(key)} onChange={(event) => setRegistrationLineKeys((current) => event.target.checked ? [...new Set([...current, key])] : current.filter((item) => item !== key))} /> } }, { key: 'grn', label: 'GRN', width: '145px', render: (entry) => <strong>{entry.receipt.grn}</strong> }, { key: 'item', label: 'Item / model', width: '300px', render: (entry) => <div className="receipt-summary"><strong>{types.find((type) => type.id === entry.line.typeId)?.name ?? 'Item'}</strong><span>{models.find((model) => model.id === entry.line.modelId)?.brand ?? ''} {models.find((model) => model.id === entry.line.modelId)?.name ?? 'Model'}</span></div> }, { key: 'received', label: 'Received', width: '100px', render: (entry) => entry.line.quantity }, { key: 'registered', label: 'Registered', width: '110px', render: (entry) => assets.filter((asset) => asset.receiptId === entry.receipt.id && (asset.receiptLineId ?? 'legacy') === entry.line.id).length }, { key: 'remaining', label: 'Remaining', width: '110px', render: (entry) => Math.max(0, entry.line.quantity - assets.filter((asset) => asset.receiptId === entry.receipt.id && (asset.receiptLineId ?? 'legacy') === entry.line.id).length) }, { key: 'open', label: 'Register', width: '130px', render: (entry) => <button type="button" className="table-action" onClick={() => chooseRegistrationLine(entry.receipt.id, entry.line.id)}>Open line</button> }]} empty={<div className="empty-state"><strong>{registrationGroupId ? registrationGrnId ? 'No pending lines on this GRN' : 'Select a GRN to view its pending items' : 'Select an Asset Group to begin'}</strong></div>} /></section>
      {selectedReceiptLine ? <aside className="registration-drawer" aria-label="Active line registration"><section className="active-registration-line"><div><span>ACTIVE LINE REGISTRATION</span><strong>{selectedReceipt?.grn} · {selectedType?.name} · {models.find((model) => model.id === selectedReceiptLine.modelId)?.brand ?? ''} {models.find((model) => model.id === selectedReceiptLine.modelId)?.name}</strong><small>{remainingForSelected} unit{remainingForSelected === 1 ? '' : 's'} remaining · line-specific serials, specifications and inventory-code sequence</small></div><button type="button" className="secondary-action" onClick={() => { setAssetForm({ ...assetForm, receiptId: '', receiptLineId: '', inventoryCode: '', specifications: {} }); setRegistrationQuantity('1'); setSerialNumbers('') }}>Close</button></section>
      <label>Units to register<input required type="number" min="1" max={remainingForSelected || 1} value={registrationQuantity} onChange={(event) => setRegistrationQuantity(event.target.value)} /><small>{selectedReceiptLine ? `${remainingForSelected} unit${remainingForSelected === 1 ? '' : 's'} remaining on this GRN line` : 'Select a GRN line first'}</small></label>
      <label className="inventory-code-field">Asset ID<input value={assetForm.inventoryCode || proposedInventoryCode} disabled={!canEditInventoryCode} onChange={(event)=>setAssetForm({...assetForm,inventoryCode:event.target.value.toUpperCase()})} placeholder="Select a receipt line first" aria-invalid={Boolean(inventoryCodeError)} aria-describedby="asset-id-help"/><small id="asset-id-help">{Number(registrationQuantity)>1?'Multiple units use the protected next sequential IDs automatically.':!selectedReceiptLine?'Select a receipt line first.':!canOverrideInventoryCode?'Generated Asset ID is protected. Manager-level access is required to override it.':`Generated from ${selectedCodeRule?'the active governance rule':'the default category standard'}. A manager may replace it only with an unused ${selectedCodeFormat.prefix}-${'0'.repeat(selectedCodeFormat.padding)} ID.`}</small>{inventoryCodeError?<small className="field-error" role="alert">{inventoryCodeError}</small>:null}</label>
      <label className="wide-field">Serial numbers<textarea required={selectedType?.trackingMode !== 'Consumable'} value={serialNumbers} onChange={(event) => setSerialNumbers(event.target.value)} placeholder={selectedType?.trackingMode === 'Consumable' ? 'Optional for consumables' : 'Enter one manufacturer serial number per line'} /></label>
      <label>Stock location<select required value={assetForm.locationId} onChange={(event) => setAssetForm({ ...assetForm, locationId: event.target.value })}><option value="">Select location</option>{locations.filter((item) => item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <div className="legacy-configuration-note"><strong>Specifications Master is the single configuration source.</strong><span>Legacy configuration profiles are retained only for historical asset records and cannot be selected for new registration.</span></div>
      {visibleSelectedSpecifications.map(field=><label key={field.id}> {field.name}{field.required?' *':''}{field.fieldType==='Select'||field.fieldType==='Yes / no'?<select required={field.required} value={assetForm.specifications[field.key]??''} onChange={event=>setAssetForm({...assetForm,specifications:{...assetForm.specifications,[field.key]:event.target.value}})}><option value="">Select {field.name}</option>{(field.fieldType==='Yes / no'?['Yes','No']:field.options).map(option=><option key={option}>{option}</option>)}</select>:<input required={field.required} type={field.fieldType==='Number'?'number':'text'} value={assetForm.specifications[field.key]??''} onChange={event=>setAssetForm({...assetForm,specifications:{...assetForm.specifications,[field.key]:event.target.value}})} placeholder={field.unit?`Value in ${field.unit}`:field.name}/>}</label>)}
      <label>Purchase date<input required type="date" value={assetForm.purchaseDate} onChange={(event) => setAssetForm({ ...assetForm, purchaseDate: event.target.value })} /></label>
      <label>Unit cost<input required type="number" min="0" step="0.01" value={assetForm.cost} onChange={(event) => setAssetForm({ ...assetForm, cost: event.target.value })} /></label>
      <label className="compact-choice">Condition<select value={assetForm.condition} onChange={(event) => setAssetForm({ ...assetForm, condition: event.target.value })}><option>New</option><option>Good</option><option>Fair</option><option>Needs attention</option></select></label>
      <label className="compact-choice">Initial status<select value={assetForm.stockStatus} onChange={(event) => setAssetForm({ ...assetForm, stockStatus: event.target.value })}><option>In stock</option><option>Reserved</option><option>Quarantined</option></select></label>
      <fieldset className="asset-icon-picker wide-field"><legend>Asset icon <span>used throughout inventory and allocation</span></legend>{assetIcons.map((item)=><button type="button" className={assetForm.iconName===item.name?'selected':''} onClick={()=>setAssetForm({...assetForm,iconName:item.name})} key={item.name}><Icon name={item.name} size={21}/><span>{item.label}</span></button>)}</fieldset>
      <div className="form-actions"><button type="button" onClick={closeForm}>Cancel batch</button><button type="button" onClick={() => { const activeKey = `${assetForm.receiptId}|${assetForm.receiptLineId}`; const nextKey = registrationLineKeys.find((key) => key !== activeKey); if (!nextKey) { setMessage('No other selected line is waiting. Complete this line or select another queue row.'); return }; const [receiptId, receiptLineId] = nextKey.split('|'); chooseRegistrationLine(receiptId, receiptLineId) }}>Register next</button><button type="submit" className="primary-action">Create Asset ID{Number(registrationQuantity) > 1 ? 's' : ''}</button></div></aside> : <div className="batch-editor-placeholder wide-field"><strong>Choose a pending GRN line to start registration</strong><span>Select a row and choose “Open selected line”, or use “Open line” directly from the registration queue. Each line keeps its own quantity, serials, specifications and code sequence.</span></div>}
    </form>}

    {message && <div className="success-message" role="status">✓ {message}</div>}
    {mode === 'Asset register' && <div className="toolbar-actions"><button type="button" className="secondary-action" onClick={()=>setShowAssetHistory((value)=>!value)}>{showAssetHistory?'Hide edit history':'Edit history'}</button></div>}
    {mode === 'Asset register' && showAssetHistory && <DataTable rows={[...audit.events].filter((event)=>event.module==='Asset register').reverse()} rowKey={(event)=>event.id} columns={[{key:'time',label:'Timestamp',sticky:true,width:'190px',render:(event)=>new Date(event.timestamp).toLocaleString('en-IN')},{key:'record',label:'Asset',width:'170px',render:(event)=><strong>{event.recordCode}</strong>},{key:'action',label:'Action',width:'140px',render:(event)=>event.action},{key:'fields',label:'Changed fields',width:'420px',render:(event)=>event.changedFields},{key:'actor',label:'Changed by',width:'230px',render:(event)=>event.actor}]} empty={<div className="empty-state"><strong>No asset edits recorded</strong><p>Future edits and removals will appear here.</p></div>}/>} 
    {mode === 'Asset register' && assetIdChange && <form className="master-form operation-form asset-id-change-form" onSubmit={saveAssetIdChange}><div className="legacy-configuration-note wide-field"><strong>Change Asset ID</strong><span>Use this focused manager action to correct an Asset ID. The new value must follow the approved format and be unique.</span></div><label>Current Asset ID<input readOnly value={assetIdChange.asset.assetId}/></label><label className="inventory-code-field">New Asset ID<input autoFocus value={assetIdChange.nextId} disabled={!canOverrideInventoryCode} onChange={(event)=>setAssetIdChange({...assetIdChange,nextId:event.target.value.toUpperCase()})} aria-invalid={Boolean(assetIdChangeError)} aria-describedby="new-asset-id-help"/><small id="new-asset-id-help">Approved format: {assetIdChangeFormat.prefix}-{ '0'.repeat(assetIdChangeFormat.padding) }</small>{assetIdChangeError?<small className="field-error" role="alert">{assetIdChangeError}</small>:null}</label><div className="form-actions"><button type="button" onClick={()=>setAssetIdChange(null)}>Cancel</button><button type="submit" className="primary-action">Save Asset ID</button></div></form>}
    {mode === 'Asset register' && assetEdit && <form className="master-form operation-form" onSubmit={saveAssetEdit}>
      <label className="inventory-code-field">Asset ID<input value={assetEdit.assetId} disabled={!canOverrideInventoryCode} onChange={(event)=>setAssetEdit({...assetEdit,assetId:event.target.value.toUpperCase()})} aria-invalid={Boolean(editInventoryCodeError)} aria-describedby="edit-asset-id-help"/><small id="edit-asset-id-help">{canOverrideInventoryCode?`Manager override permitted. Use an unused ${editCodeFormat.prefix}-${'0'.repeat(editCodeFormat.padding)} ID.`:'Manager-level access is required to edit Asset ID.'}</small>{editInventoryCodeError?<small className="field-error" role="alert">{editInventoryCodeError}</small>:null}</label><label>Serial number<input value={assetEdit.serialNumber} onChange={(event)=>setAssetEdit({...assetEdit,serialNumber:event.target.value})}/></label><label>Location<select required value={assetEdit.locationId} onChange={(event)=>setAssetEdit({...assetEdit,locationId:event.target.value})}>{locations.map((item)=><option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><div className="legacy-configuration-note"><strong>Technical configuration is governed below.</strong><span>{assetEdit.configId?'This historical record retains a legacy profile reference, but all new changes use Specifications Master.':'No legacy profile is attached.'}</span></div>{visibleSpecifications(specificationsFor(types.find(type=>type.id===assetEdit.typeId),customSpecifications),assetEdit.specifications??{}).map(field=><label key={field.id}>{field.name}{field.required?' *':''}<input required={field.required} value={assetEdit.specifications?.[field.key]??''} onChange={event=>setAssetEdit({...assetEdit,specifications:{...(assetEdit.specifications??{}),[field.key]:event.target.value}})}/></label>)}<label>Purchase date<input type="date" required value={assetEdit.purchaseDate} onChange={(event)=>setAssetEdit({...assetEdit,purchaseDate:event.target.value})}/></label><label>Cost<input type="number" min="0" step="0.01" required value={assetEdit.cost} onChange={(event)=>setAssetEdit({...assetEdit,cost:Number(event.target.value)})}/></label><label>Condition<select value={assetEdit.condition} onChange={(event)=>setAssetEdit({...assetEdit,condition:event.target.value})}><option>New</option><option>Good</option><option>Fair</option><option>Needs attention</option></select></label><label>Lifecycle status<select value={assetEdit.stockStatus} onChange={(event)=>setAssetEdit({...assetEdit,stockStatus:event.target.value})}><option>In stock</option><option>Reserved</option><option>Quarantined</option><option>Under repair</option><option>Scrap</option><option>Archived</option></select></label><div className="form-actions"><button type="button" onClick={()=>setAssetEdit(null)}>Cancel</button><button type="submit" className="primary-action">Save changes</button></div>
    </form>}
    {mode === 'Goods receipt' ? <><div className="master-summary"><div><span>Total receipts</span><strong>{receipts.length}</strong></div><div><span>Accepted</span><strong>{receipts.filter((item) => item.outcome === 'Accepted').length}</strong></div><div><span>Exceptions / voided</span><strong>{receipts.filter((item) => item.outcome !== 'Accepted').length}</strong></div></div><DataTable tableId="itms-goods-receipts" configurable rows={receipts} rowKey={(item) => item.id} columns={[
      { key: 'grn', label: 'GRN', sticky: true, width: '170px', render: (item) => <strong>{item.grn}</strong> }, { key: 'group', label: 'Asset group', width: '210px', render: (item) => { const groupId = item.groupId ?? types.find((type) => type.id === item.typeId)?.groupId; const group = assetGroups.find((value) => value.id === groupId); return group ? `${group.code} · ${group.name}` : 'Legacy receipt · group not recorded' } }, { key: 'model', label: 'Invoice items', width: '330px', render: (item) => <div className="receipt-summary">{receiptLinesFor(item).map((line) => <span key={line.id}>{models.find((model) => model.id === line.modelId)?.brand ?? ''} {models.find((model) => model.id === line.modelId)?.name ?? 'Unavailable'} × {line.quantity}</span>)}</div> }, { key: 'vendor', label: 'Vendor', width: '220px', render: (item) => vendors.find((vendor) => vendor.id === item.vendorId)?.name ?? 'Unavailable' }, { key: 'po', label: 'Purchase order', width: '160px', render: (item) => item.purchaseOrder || 'Not recorded' }, { key: 'invoice', label: 'Invoice', width: '160px', render: (item) => item.invoiceNumber }, { key: 'inspection', label: 'Inspection / remarks', width: '310px', render: (item) => <div className="receipt-summary"><strong>{item.outcome}</strong><span>{item.voidReason ? `Void reason: ${item.voidReason}` : item.inspectionNote || 'No inspection remarks recorded'}</span></div> }, { key:'bill', label:'Bill / evidence', width:'210px', render:(item) => { const bill = item.bill; if (!bill) return 'Not attached'; const cloudBill = 'provider' in bill && bill.provider === 'Google Drive'; return <button type="button" className="document-link" onClick={() => { try { cloudBill ? openInventoryAttachment(bill as InventoryAttachment) : void openAttachment(bill as LocalAttachment).catch(() => setMessage('This legacy bill is not available on this browser.')) } catch (error) { setMessage(error instanceof Error ? error.message : 'This bill is not available.') } }}>{bill.name}{cloudBill ? ' · Drive' : ''}</button> } }, { key: 'quantity', label: 'Total units', width: '110px', render: (item) => receiptLinesFor(item).reduce((sum, line) => sum + line.quantity, 0) }, { key: 'received', label: 'Received date', width: '140px', render: (item) => item.receivedDate }, { key: 'outcome', label: 'Outcome', width: '130px', render: (item) => <span className={`status ${item.outcome === 'Accepted' ? 'active' : 'inactive'}`}>{item.outcome}</span> }, { key: 'actions', label: 'Manager action', width: '230px', render: (item) => <div className="table-actions"><button type="button" className="table-action" onClick={() => editReceipt(item)} disabled={item.outcome === 'Voided'}>Edit</button><button type="button" className="table-action" onClick={() => removeOrVoidReceipt(item)} disabled={item.outcome === 'Voided'}>{assets.some((asset) => asset.receiptId === item.id) ? 'Void' : 'Remove'}</button></div> },
    ]} empty={<EmptyState text="No goods receipts recorded" />} />{voidingReceipt && <form className="master-form operation-form" onSubmit={confirmVoidReceipt}><div className="legacy-configuration-note wide-field"><strong>Void {voidingReceipt.grn}</strong><span>This GRN has registered assets, so it cannot be deleted. Voiding retains both the assets and the audit trail.</span></div><label className="wide-field">Mandatory void reason<textarea required value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="State why this receipt must be voided" /></label><div className="form-actions"><button type="button" onClick={() => setVoidingReceipt(null)}>Cancel</button><button type="submit" className="primary-action">Void GRN</button></div></form>}</> : <><div className="asset-register-views"><button type="button" className={registerView==='Active'?'selected':''} onClick={()=>{setRegisterView('Active');setStatusFilter('all')}}>Active register <b>{activeAssets.length}</b></button><button type="button" className={registerView==='Removed'?'selected':''} onClick={()=>{setRegisterView('Removed');setStatusFilter('all')}}>Scrapped &amp; archived <b>{removedAssets.length}</b></button></div><div className="master-summary"><div><span>{registerView==='Active'?'Active assets':'Removed assets'}</span><strong>{registerView==='Active'?activeAssets.length:removedAssets.length}</strong></div><div><span>{registerView==='Active'?'In stock':'Scrapped'}</span><strong>{registerView==='Active'?activeAssets.filter((item) => item.stockStatus === 'In stock').length:removedAssets.filter((item)=>item.stockStatus==='Scrap'||item.stockStatus==='Scrapped').length}</strong></div><div><span>{registerView==='Active'?'Active inventory value':'Historical acquisition value'}</span><strong>₹{(registerView==='Active'?activeAssets:removedAssets).reduce((sum, item) => sum + item.cost, 0).toLocaleString('en-IN')}</strong></div></div>
    <div className="category-overview"><button type="button" className={categoryFilter === 'all' ? 'selected' : ''} onClick={() => setCategoryFilter('all')}><Icon name="inventory" size={18}/><span>All categories</span><strong>{registerView==='Active'?activeAssets.length:removedAssets.length}</strong></button>{categoryCounts.map((item) => <button type="button" className={categoryFilter === item.id ? 'selected' : ''} onClick={() => setCategoryFilter(item.id)} key={item.id}><Icon name={suggestedIcon(item)} size={18}/><span>{item.name}</span><strong>{item.count}</strong></button>)}</div>
    <div className="asset-filter-bar"><button type="button" className="secondary-action" onClick={()=>setAdvancedFiltersOpen((value)=>!value)}>{advancedFiltersOpen?'Hide advanced filters':'Advanced filters'} <span>{advancedFiltersOpen?'▴':'▾'}</span></button><span>{[categoryFilter,statusFilter,brandFilter].filter((value)=>value!=='all').length+[cpuFilter,ramFilter,storageFilter].filter(Boolean).length} active filters</span><button type="button" onClick={()=>{setAssetSearch('');setCategoryFilter('all');setStatusFilter('all');setBrandFilter('all');setProfileFilter('all');setCpuFilter('');setRamFilter('');setStorageFilter('')}}>Reset</button></div>
    {advancedFiltersOpen&&<div className="asset-register-filters advanced"><label>Item group / category<select value={categoryFilter} onChange={(event)=>{setCategoryFilter(event.target.value);setProfileFilter('all');setCpuFilter('');setRamFilter('');setStorageFilter('')}}><option value="all">All item groups</option>{types.map((item)=><option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Brand<select value={brandFilter} onChange={(event)=>setBrandFilter(event.target.value)}><option value="all">All brands</option>{[...new Set(models.map((item)=>item.brand))].sort().map((item)=><option key={item}>{item}</option>)}</select></label><label>Lifecycle status<select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option value="all">All statuses</option>{assetStatuses.map((item)=><option key={item}>{item}</option>)}</select></label><label>Processor / CPU<input disabled={categoryFilter!=='all'&&!selectedFilterFields.includes('cpu')} value={cpuFilter} onChange={(event)=>setCpuFilter(event.target.value)} placeholder={categoryFilter!=='all'&&!selectedFilterFields.includes('cpu')?'Not applicable':'e.g. i5, Ryzen 7'}/></label><label>RAM<input disabled={categoryFilter!=='all'&&!selectedFilterFields.includes('ram')} value={ramFilter} onChange={(event)=>setRamFilter(event.target.value)} placeholder={categoryFilter!=='all'&&!selectedFilterFields.includes('ram')?'Not applicable':'e.g. 16 GB'}/></label><label>HDD / SSD<input disabled={categoryFilter!=='all'&&!selectedFilterFields.includes('storage')} value={storageFilter} onChange={(event)=>setStorageFilter(event.target.value)} placeholder={categoryFilter!=='all'&&!selectedFilterFields.includes('storage')?'Not applicable':'e.g. 512 GB SSD'}/></label></div>}
    {registerView==='Active'&&<section className="asset-missing-specs"><div><strong>Specification completeness queue</strong><span>{missingSpecificationAssets.length} asset{missingSpecificationAssets.length===1?'':'s'} need required technical data.</span></div>{missingSpecificationAssets.length>0&&<button type="button" onClick={()=>setAssetEdit({...missingSpecificationAssets[0]})}>Review next asset</button>}</section>}
    <div className="filter-result">Showing <strong>{sortedAssets.length}</strong> of {registerView==='Active'?activeAssets.length:removedAssets.length} {registerView==='Active'?'active':'removed'} assets</div><DataTable rows={sortedAssets} rowKey={(item) => item.id} sortKey={assetSort.key} sortDirection={assetSort.direction} onSort={(key)=>setAssetSort((current)=>({key,direction:current.key===key&&current.direction==='asc'?'desc':'asc'}))} columns={[
      {key:'assetId',label:'Asset ID',sticky:true,width:'210px',sortValue:(item)=>item.assetId,render:(item)=><span className="asset-identity"><Icon name={item.iconName??suggestedIcon(types.find((type)=>type.id===item.typeId))} size={20}/><button type="button" className="asset-link" onClick={()=>setSelectedAssetId(item.id)}>{item.assetId}</button></span>},{key:'category',label:'Category',width:'200px',sortValue:(item)=>types.find((type)=>type.id===item.typeId)?.name??'',render:(item)=>types.find((type)=>type.id===item.typeId)?.name??'Unavailable'},{key:'model',label:'Brand / model',width:'240px',sortValue:(item)=>`${models.find((model)=>model.id===item.modelId)?.brand??''} ${models.find((model)=>model.id===item.modelId)?.name??''}`,render:(item)=>`${models.find((model)=>model.id===item.modelId)?.brand??''} ${models.find((model)=>model.id===item.modelId)?.name??'Unavailable'}`},{key:'configuration',label:'Specifications',width:'360px',render:(item)=>{const values=Object.entries(item.specifications??{}).filter(([,value])=>value);return values.length?<><strong>{values.map(([key,value])=>`${key}: ${value}`).join(' · ')}</strong></>: 'Not specified'}},{key:'serial',label:'Serial number',width:'170px',render:(item)=>item.serialNumber||'Not applicable'},{key:'location',label:'Location',width:'190px',sortValue:(item)=>locations.find((location)=>location.id===item.locationId)?.name??'',render:(item)=>locations.find((location)=>location.id===item.locationId)?.name??'Unavailable'},{key:'purchase',label:'Purchase date',width:'130px',sortValue:(item)=>item.purchaseDate,render:(item)=>item.purchaseDate},{key:'cost',label:'Cost',width:'130px',sortValue:(item)=>item.cost,render:(item)=>`₹${item.cost.toLocaleString('en-IN')}`},{key:'condition',label:'Condition',width:'130px',render:(item)=>item.condition},{key:'status',label:'Lifecycle status',width:'190px',sortValue:(item)=>item.stockStatus,render:(item)=><span className={`status ${item.stockStatus==='In stock'||item.stockStatus==='Allocated'?'active':'inactive'}`}>{item.stockStatus}</span>},{key:'actions',label:'Actions',width:'350px',render:(item)=><div className="table-actions"><button className="table-action" type="button" onClick={()=>cloneSimilarAsset(item)}>Clone similar</button><button className="table-action" type="button" onClick={()=>setAssetIdChange({asset:item,nextId:item.assetId})}>Change Asset ID</button><button className="table-action" type="button" onClick={()=>setAssetEdit({...item})}>Edit</button><button className="table-action" type="button" onClick={()=>toggleAssetRemoval(item)}>{['Scrap','Scrapped','Archived'].includes(item.stockStatus)?'Restore':'Remove'}</button></div>},
    ]} empty={<EmptyState text="No assets match these filters" />} />
    {selectedAssetRecord && <section className="asset-history-panel"><header><div><span className="eyebrow">COMPLETE ASSET LIFECYCLE</span><h3>{selectedAssetRecord.assetId} · {models.find((item) => item.id === selectedAssetRecord.modelId)?.brand} {models.find((item) => item.id === selectedAssetRecord.modelId)?.name}</h3><p>{types.find((item) => item.id === selectedAssetRecord.typeId)?.name} · Serial {selectedAssetRecord.serialNumber || 'Not applicable'} · Current status {selectedAssetRecord.stockStatus}</p></div><button type="button" onClick={() => setSelectedAssetId('')}>Close</button></header><div className="asset-history-meta"><span>Purchase: <b>{selectedAssetRecord.purchaseDate}</b></span><span>Cost: <b>₹{selectedAssetRecord.cost.toLocaleString('en-IN')}</b></span><span>Condition: <b>{selectedAssetRecord.condition}</b></span><span>Location: <b>{locations.find((item) => item.id === selectedAssetRecord.locationId)?.name ?? 'Unavailable'}</b></span>{Object.entries(selectedAssetRecord.specifications??{}).filter(([,value])=>value).map(([key,value])=><span key={key}>{key}: <b>{value}</b></span>)}</div><div className="asset-timeline">{assetHistory(selectedAssetRecord).map((event) => <article key={event.id}><i></i><div><strong>{event.title}</strong><span>{event.detail}</span><small>{event.at ? new Date(event.at).toLocaleString('en-IN') : 'Date unavailable'}</small></div></article>)}</div></section>}
    </>}
  </section>
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span><Icon name="package" size={32}/></span><strong>{text}</strong><p>Use the action above to create the first governed record.</p></div> }
