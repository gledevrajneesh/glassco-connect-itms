import { useEffect, useMemo, useState } from 'react'
import Icon, { type IconName } from '../../components/Icon'
import DataTable from '../../components/DataTable'
import type { ModuleName } from '../../lib/accessControl'
import { useLocalStore } from '../../lib/localStore'
import SupportGovernance, { addBusinessMinutes, defaultSlaPolicy, recordSupportDelivery, type SlaPolicy, type SupportDelivery } from './SupportGovernance'
import KnowledgeBase from './KnowledgeBase'
import ServiceCatalog from './ServiceCatalog'
import SupportAnalytics from './SupportAnalytics'
import SupportAdministration, { defaultSupportOperations, type SupportOperations } from './SupportAdministration'
import EmailTicketing, { type RatingInvite } from './EmailTicketing'
import { queueSupportEmail } from '../../lib/supportEmailCloud'
import { useSupportStore } from '../../lib/supportStore'
import { beginSupportAttachmentUpload, normalizeSupportAttachment, openSupportAttachment, queueSupportAttachments, validateSupportAttachments, type SupportAttachment } from '../../lib/supportAttachmentStore'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import './SupportDesk.css'
import '../../sidebarStandard.css'

type TicketKind = 'Incident' | 'Service request' | 'Access request'
type TicketStatus = 'Open' | 'In progress' | 'Awaiting approval' | 'Awaiting employee' | 'Resolved' | 'Closed'
type Ticket = {
  id: string
  code: string
  kind: TicketKind
  category: string
  subcategory: string
  title: string
  description: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  impact: 'Individual' | 'Department' | 'Multiple departments' | 'Company-wide'
  urgency: 'Normal' | 'High' | 'Immediate'
  status: TicketStatus
  requesterEmail: string
  requesterName: string
  assignee?: string
  firstResponseDueAt: string
  resolutionDueAt: string
  waitingReason?: string
  resolutionSummary?: string
  resolvedAt?: string
  resolutionConfirmedAt?: string
  closedAt?: string
  activeViewers?: { email: string; name?: string; at: string }[]
  reopenReason?: string
  reopenCount?: number
  routingReason?: string
  messages: { id: string; at: string; author: string; visibility: 'employee' | 'internal'; body: string }[]
  itmsLinks?: { kind: 'Repair' | 'Incident' | 'Replacement'; reference: string; recordId: string; createdAt: string }[]
  assetId?: string
  attachments: Array<SupportAttachment | string>
  createdAt: string
  updatedAt: string
  history: { at: string; event: string; actor: string }[]
  source?: 'Portal' | 'Email'
}
type EmailTrailRow = { id: string; direction: 'Inbound' | 'Outbound'; subject: string; participant: string; body?: string; status: string; at: string; event?: string }

type User = { id: string; code?: string; name: string; email: string; departmentId?: string; active?: boolean }
type Asset = { id: string; assetId?: string; assetCode?: string; typeId?: string; modelId?: string; serial?: string; serialNumber?: string; status?: string; stockStatus?: string; assignedUserId?: string }
type Model = { id: string; name: string; typeId?: string; brandId?: string }
type AssetType = { id: string; code?: string; name: string }
type Allocation = { id: string; code?: string; departmentId?: string; userId?: string; employeeId?: string; assetIds?: string[]; assetId?: string; replacementAssetId?: string; allocationKind?: string; allocationDate?: string; expectedReturnDate?: string; purpose?: string; state?: string; status?: string; requestedBy?: string; requestedAt?: string; assetManagerApprovedAt?: string; itHeadApprovedAt?: string }
type CustodyMovement = { id: string; code?: string; kind?: 'Transfer' | 'Return'; assetId: string; fromUserId?: string; toUserId?: string; disposition?: string; state?: string; requestedAt?: string; effectiveDate?: string; itHeadApprovedAt?: string; reason?: string }
type Vendor = { id: string; code?: string; name: string; status?: string }
type Maintenance = { id: string; code: string; assetId: string; activity: string; kind: 'Repair'; frequency: string; dueDate: string; responsible: string; vendorId: string; notes: string; serviceMode: 'Internal' | 'External vendor'; quotationReference?: string; approvalReference?: string; gatePass?: { number: string; dispatchedDate: string; expectedReturnDate: string; carrier: string; authorisedBy: string; returnedAt: string }; state: 'Scheduled' | 'Completed' | 'Cancelled'; createdAt: string; completedAt: string; performedDate: string; technician: string; cost: number; findings: string; partsReplaced: string; downtimeHours: number; outcome: string; nextDueDate: string; disposition: string }
type AssetIncident = { id: string; code: string; userId: string; assetId: string; type: string; severity: string; eventDate: string; notes: string; status: string; reportedAt: string; reportedBy: string; closedAt: string }
type KnowledgeHint = { id: string; title: string; summary: string; content: string; keywords: string[]; status: string }

const categories: Record<string, string[]> = {
  'Device or hardware': ['Laptop / desktop', 'Printer', 'Mobile device', 'Monitor or accessory', 'Hardware damage'],
  'Access request': ['Application access', 'Shared folder', 'Email group', 'VPN access', 'New user access'],
  'Network & connectivity': ['Wi-Fi', 'Internet', 'VPN connection', 'LAN / network port', 'Slow connectivity'],
  'Email & applications': ['Outlook / email', 'Microsoft 365', 'Business application', 'Installation request', 'Application error'],
}

const categoryIcon: Record<string, IconName> = {
  'Device or hardware': 'laptop',
  'Access request': 'assurance',
  'Network & connectivity': 'network',
  'Email & applications': 'mail',
}


function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function ticketPrefix(kind: TicketKind) {
  return kind === 'Incident' ? 'INC' : kind === 'Access request' ? 'ACC' : 'REQ'
}

function nextTicketCode(_tickets: Ticket[], kind: TicketKind) {
  const year = new Date().getFullYear()
  const prefix = ticketPrefix(kind)
  return `${prefix}-${year}-P${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
}

const attachmentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov,image/*,audio/*,video/*'
const attachmentSize = (bytes: number) => bytes ? `${bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB'}` : 'Legacy record'

function AttachmentList({ attachments, onOpen, onPreview }: { attachments: Array<SupportAttachment | string>; onOpen: (attachment: SupportAttachment | string) => void; onPreview: (attachment: SupportAttachment) => void }) {
  if (!attachments?.length) return <div className="support-attachment-empty">No files attached to this ticket.</div>
  return <div className="support-attachment-list">{attachments.map((value, index) => {
    const attachment = normalizeSupportAttachment(value)
    const copying = attachment.availability === 'Pending import'
    const unavailable = attachment.unavailable || attachment.availability === 'Rejected'
    const availability = copying ? 'Copying securely to IT Support' : unavailable ? (attachment.reason || 'File record retained; original file unavailable') : attachment.availability === 'Available' ? 'Available in Support Desk' : ''
    const canPreview = !copying && !unavailable && /^(image\/|application\/pdf)/.test(attachment.contentType) && Boolean(attachment.driveUrl || attachment.driveFileId)
    return <div className={`support-attachment ${copying ? 'is-copying' : ''}`} key={`${attachment.id}-${index}`}>
      <button type="button" onClick={() => onOpen(value)} disabled={copying || unavailable} title={availability || `Open ${attachment.name}`}><Icon name="requests" size={17}/><span><strong>{attachment.name}</strong><small>{attachment.source} · {attachmentSize(attachment.size)}{availability ? ` · ${availability}` : ''}</small></span>{copying ? <em>Copying</em> : <Icon name="arrow" size={15}/>}</button>
      {canPreview && <button type="button" className="support-attachment-preview" onClick={() => onPreview(attachment)}>Preview</button>}
    </div>
  })}</div>
}

function TicketEmailTrail({ rows }: { rows: EmailTrailRow[] }) {
  return <section className="support-ticket-email-trail"><header><div><span>CONTROLLED EMAIL TRAIL</span><h3>Email activity on this ticket</h3><p>Inbound Gmail replies and outbound service notifications are retained against this ticket reference.</p></div><strong>{rows.length}</strong></header>{rows.length ? <div>{rows.map(row => <article key={row.id}><i className={row.direction.toLowerCase()}>{row.direction === 'Inbound' ? '↓' : '↑'}</i><div><strong>{row.subject || row.event || 'Support email update'}</strong><p>{row.body || 'No message preview recorded.'}</p><small>{row.direction === 'Inbound' ? `From ${row.participant}` : `To ${row.participant}`} · {formatDate(row.at)}</small></div><b className={row.status.toLowerCase().replaceAll(' ','-')}>{row.status}</b></article>)}</div> : <p className="support-email-trail-empty">No email activity is recorded for this ticket yet.</p>}</section>
}

export default function SupportDesk({ identityEmail, identityName, isServiceAgent, canViewManagementAnalytics, onOpenItms, onExit }: { identityEmail: string; identityName: string; isServiceAgent: boolean; canViewManagementAnalytics: boolean; onOpenItms: (target: ModuleName, focus?: string) => void; onExit: () => void }) {
  const ratingToken = new URLSearchParams(window.location.search).get('supportRating') || ''
  const initialRating = Math.min(5, Math.max(0, Number(new URLSearchParams(window.location.search).get('stars') || 0)))
  const [view, setView] = useState<'home' | 'tickets' | 'assets' | 'catalog' | 'knowledge' | 'service' | 'governance' | 'analytics' | 'admin' | 'email' | 'rating'>(ratingToken ? 'rating' : 'home')
  const [showForm, setShowForm] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('glassco.workspace.sidebar-collapsed.v1') === 'true')
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [tickets, setTickets, ticketCloud] = useSupportStore<Ticket>('supportTickets', identityEmail, isServiceAgent)
  const [slaPolicy] = useLocalStore<SlaPolicy>('connect.support-sla-policy.v1', defaultSlaPolicy)
  const [, setSupportDeliveries] = useLocalStore<SupportDelivery[]>('connect.support-deliveries.v1', [])
  const [ratingInvites,setRatingInvites, ratingCloud] = useSupportStore<RatingInvite>('supportRatings', identityEmail, isServiceAgent)
  const [users] = useLocalStore<User[]>('itms.users.v1', [])
  const [assets, setAssets] = useLocalStore<Asset[]>('itms.assets.v1', [])
  const [models] = useLocalStore<Model[]>('itms.asset-models.v1', [])
  const [assetTypes] = useLocalStore<AssetType[]>('itms.asset-types.v1', [])
  const [knowledgeHints] = useLocalStore<KnowledgeHint[]>('connect.support-knowledge.v1', [])
  const [supportOperations] = useLocalStore<SupportOperations>('connect.support-operations.v1', defaultSupportOperations)
  const [allocations, setAllocations] = useLocalStore<Allocation[]>('itms.allocations.v1', [])
  const [custodyMovements] = useLocalStore<CustodyMovement[]>('itms.custody-movements.v1', [])
  const [vendors] = useLocalStore<Vendor[]>('itms.vendors.v1', [])
  const [maintenance, setMaintenance] = useLocalStore<Maintenance[]>('itms.asset-maintenance.v1', [])
  const [incidents, setIncidents] = useLocalStore<AssetIncident[]>('itms.asset-incidents.v1', [])
  const [kind, setKind] = useState<TicketKind>('Incident')
  const [category, setCategory] = useState(Object.keys(categories)[0])
  const [subcategory, setSubcategory] = useState(categories[Object.keys(categories)[0]][0])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState<Ticket['impact']>('Individual')
  const [urgency, setUrgency] = useState<Ticket['urgency']>('Normal')
  const [assetId, setAssetId] = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [queueSearch, setQueueSearch] = useState('')
  const [queueStatus, setQueueStatus] = useState('All')
  const [queuePriority, setQueuePriority] = useState('All')
  const [queueView, setQueueView] = useState<'All' | 'My queue' | 'Unassigned' | 'Breached' | 'Awaiting employee' | 'Critical'>('All')
  const [myTicketSearch, setMyTicketSearch] = useState('')
  const [myTicketStatus, setMyTicketStatus] = useState<'All' | TicketStatus>('All')
  const [serviceMode, setServiceMode] = useState<'queue' | 'board'>('queue')
  const [replyText, setReplyText] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [waitingReason, setWaitingReason] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [integrationMode, setIntegrationMode] = useState<'Repair' | 'Incident' | 'Replacement' | ''>('')
  const [repairMode, setRepairMode] = useState<'Internal' | 'External vendor'>('Internal')
  const [repairVendorId, setRepairVendorId] = useState('')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [carrier, setCarrier] = useState('')
  const [integrationNotes, setIntegrationNotes] = useState('')
  const [incidentType, setIncidentType] = useState('Breakage')
  const [replacementAssetId, setReplacementAssetId] = useState('')
  const [ratingStars,setRatingStars]=useState(initialRating);const [ratingResolved,setRatingResolved]=useState(true);const [ratingComment,setRatingComment]=useState('')
  const [reopenReason,setReopenReason]=useState('');const [reopenTicketId,setReopenTicketId]=useState('');const [ticketConfirmation,setTicketConfirmation]=useState<{code:string;assignee:string;resolutionDueAt:string} | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null)
  const [savingTicket, setSavingTicket] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [transferringAttachments, setTransferringAttachments] = useState(false)
  const [pendingAttachmentsByTicket, setPendingAttachmentsByTicket] = useState<Record<string, SupportAttachment[]>>({})
  const [previewAttachment, setPreviewAttachment] = useState<SupportAttachment | null>(null)
  const [draftAssignee, setDraftAssignee] = useState('')
  const [draftStatus, setDraftStatus] = useState<TicketStatus>('Open')
  const [draftPriority, setDraftPriority] = useState<Ticket['priority']>('Low')
  const [bulkSelection, setBulkSelection] = useState<string[]>([])
  const [bulkAssignee, setBulkAssignee] = useState('')
  const [bulkStatus, setBulkStatus] = useState<'Keep current' | 'Open' | 'In progress' | 'Awaiting approval'>('Keep current')
  const [bulkPriority, setBulkPriority] = useState<'Keep current' | Ticket['priority']>('Keep current')
  const [emailTrail, setEmailTrail] = useState<EmailTrailRow[]>([])
  const navigateSupport = (next: typeof view) => {
    // The ticket composer is a temporary overlay. It must never remain mounted
    // above the destination screen after sidebar navigation.
    setShowForm(false)
    setSelectedTicketId('')
    setView(next)
  }

  const currentUser = users.find((user) => user.email.toLowerCase() === identityEmail.toLowerCase())
  const myTickets = useMemo(() => tickets.filter((ticket) => ticket.requesterEmail.toLowerCase() === identityEmail.toLowerCase()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [identityEmail, tickets])
  const visibleMyTickets = useMemo(() => {
    const query = myTicketSearch.trim().toLowerCase()
    return myTickets.filter((ticket) => (myTicketStatus === 'All' || ticket.status === myTicketStatus) && (!query || `${ticket.code} ${ticket.title} ${ticket.category} ${ticket.subcategory} ${ticket.priority} ${ticket.status}`.toLowerCase().includes(query)))
  }, [myTicketSearch, myTicketStatus, myTickets])
  const suggestedKnowledge = useMemo(() => { const terms=`${title} ${description} ${category}`.toLowerCase().split(/\s+/).filter(term=>term.length>3); if(!terms.length)return [];return knowledgeHints.filter(article=>article.status==='Published'&&terms.some(term=>`${article.title} ${article.summary} ${article.content} ${article.keywords.join(' ')}`.toLowerCase().includes(term))).slice(0,2) },[category,description,knowledgeHints,title])
  const myAssetIds = useMemo(() => {
    if (!currentUser) return []
    const ids = new Set<string>()
    allocations.filter((record) => (record.userId === currentUser.id || record.employeeId === currentUser.id) && (record.state === 'Active custody' || record.status === 'Active custody' || record.status === 'Allocated')).forEach((record) => {
      record.assetIds?.forEach((id) => ids.add(id))
      if (record.assetId) ids.add(record.assetId)
    })
    assets.filter((asset) => asset.assignedUserId === currentUser.id).forEach((asset) => ids.add(asset.id))
    return [...ids]
  }, [allocations, assets, currentUser])
  const myAssets = useMemo(() => assets.filter((asset) => myAssetIds.includes(asset.id)), [assets, myAssetIds])
  const myAssetHistory = useMemo(() => {
    if (!currentUser) return []
    const allocationHistory = allocations.filter((record) => record.userId === currentUser.id || record.employeeId === currentUser.id).map((record) => ({ id: `allocation-${record.id}`, at: record.itHeadApprovedAt || record.requestedAt || record.allocationDate || '', event: record.allocationKind || 'Asset allocation', reference: record.code || 'Allocation record', assetIds: record.assetIds || (record.assetId ? [record.assetId] : []), status: record.state || record.status || 'Recorded' }))
    const movementHistory = custodyMovements.filter((record) => record.fromUserId === currentUser.id || record.toUserId === currentUser.id).map((record) => ({ id: `movement-${record.id}`, at: record.itHeadApprovedAt || record.effectiveDate || record.requestedAt || '', event: record.kind === 'Return' ? 'Asset return / revoke' : record.toUserId === currentUser.id ? 'Asset transfer received' : 'Asset transfer released', reference: record.code || 'Custody movement', assetIds: [record.assetId], status: record.state || record.disposition || 'Recorded' }))
    return [...allocationHistory, ...movementHistory].sort((a, b) => b.at.localeCompare(a.at))
  }, [allocations, currentUser, custodyMovements])
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId)
  const visibleAttachments = (ticket: Ticket) => {
    const persisted = ticket.attachments || []
    const persistedIds = new Set(persisted.map((attachment) => normalizeSupportAttachment(attachment).id))
    const pending = pendingAttachmentsByTicket[ticket.id] || []
    return [...persisted, ...pending.filter((attachment) => !persistedIds.has(attachment.id))]
  }
  useEffect(() => { if (ticketCloud.error || ratingCloud.error) setNotice({ tone: 'error', message: ticketCloud.error || ratingCloud.error }) }, [ticketCloud.error, ratingCloud.error])
  useEffect(() => {
    if (!selectedTicket) return
    setDraftAssignee(selectedTicket.assignee || '')
    setDraftStatus(selectedTicket.status)
    setDraftPriority(selectedTicket.priority)
    setWaitingReason(selectedTicket.waitingReason || '')
    setResolutionSummary(selectedTicket.resolutionSummary || '')
  }, [selectedTicket?.id, selectedTicket?.updatedAt])
  useEffect(() => {
    if (!isServiceAgent || !selectedTicketId) return
    const updatePresence = () => {
      const at = new Date().toISOString()
      void setTickets(current => current.map(ticket => ticket.id !== selectedTicketId ? ticket : {
        ...ticket,
        activeViewers: [...(ticket.activeViewers || []).filter(viewer => viewer.email.toLowerCase() !== identityEmail.toLowerCase() && Date.parse(viewer.at) > Date.now() - 2 * 60 * 1000), { email: identityEmail, name: identityName, at }],
        updatedAt: ticket.updatedAt
      }))
    }
    updatePresence()
    const timer = window.setInterval(updatePresence, 45000)
    return () => window.clearInterval(timer)
  }, [identityEmail, identityName, isServiceAgent, selectedTicketId, setTickets])
  useEffect(() => {
    if (!firestore || !selectedTicketId) { setEmailTrail([]); return }
    let outbound: EmailTrailRow[] = [], inbound: EmailTrailRow[] = []
    const publish = () => setEmailTrail([...outbound, ...inbound].sort((left, right) => right.at.localeCompare(left.at)))
    const stopOutbound = onSnapshot(query(collection(firestore, 'supportMailQueue'), where('ticketId', '==', selectedTicketId)), snapshot => {
      outbound = snapshot.docs.map(entry => {
        const row = entry.data() as Record<string, unknown>
        let payload: Record<string, string> = {}
        try { payload = JSON.parse(String(row.payload || '{}')) as Record<string, string> } catch { /* retained queue row without a payload preview */ }
        return { id: `out-${entry.id}`, direction: 'Outbound', subject: payload.subject || String(row.event || 'Service notification'), participant: String(row.recipient || payload.to || ''), body: payload.body || '', status: String(row.status || 'Queued'), at: String(row.sentAt || row.lastAttemptAt || row.failedAt || row.createdAt || ''), event: String(row.event || '') }
      }); publish()
    }, () => { outbound = []; publish() })
    const stopInbound = onSnapshot(query(collection(firestore, 'supportInboundMessages'), where('ticketId', '==', selectedTicketId)), snapshot => {
      inbound = snapshot.docs.map(entry => {
        const row = entry.data() as Record<string, unknown>
        const message = selectedTicket?.messages?.find(item => item.id === String(row.messageId || entry.id))
        return { id: `in-${entry.id}`, direction: 'Inbound', subject: String(row.subject || 'Email reply'), participant: String(row.from || ''), body: message?.body || '', status: String(row.status || 'Processed'), at: String(row.processedAt || ''), event: 'Email reply' }
      }); publish()
    }, () => { inbound = []; publish() })
    return () => { stopOutbound(); stopInbound() }
  }, [selectedTicketId, selectedTicket?.messages])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'error' ? 7000 : 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const queueTickets = tickets.filter((ticket) => {
    const term = queueSearch.trim().toLowerCase()
    const searchMatch = !term || [ticket.code, ticket.title, ticket.requesterName, ticket.requesterEmail, ticket.category, ticket.assignee || 'Unassigned'].some((value) => value.toLowerCase().includes(term))
    const viewMatch = queueView==='All'||(queueView==='My queue'&&ticket.assignee==='IT Service Desk')||(queueView==='Unassigned'&&!ticket.assignee)||(queueView==='Breached'&&!['Resolved','Closed'].includes(ticket.status)&&new Date(ticket.resolutionDueAt).getTime()<=Date.now())||(queueView==='Awaiting employee'&&ticket.status==='Awaiting employee')||(queueView==='Critical'&&ticket.priority==='Critical')
    return searchMatch && viewMatch && (queueStatus === 'All' || ticket.status === queueStatus) && (queuePriority === 'All' || ticket.priority === queuePriority)
  }).sort((a, b) => a.resolutionDueAt.localeCompare(b.resolutionDueAt))
  const selectedQueueTickets = queueTickets.filter(ticket => bulkSelection.includes(ticket.id))
  const otherActiveViewers = (selectedTicket?.activeViewers || []).filter(viewer => viewer.email.toLowerCase() !== identityEmail.toLowerCase() && Date.parse(viewer.at) > Date.now() - 2 * 60 * 1000)
  const responseTemplates = useMemo(() => {
    const shared = ['We are reviewing this now.', 'Please share a screenshot or the exact error.', 'The request is complete — please confirm.']
    const byCategory: Record<string, string[]> = {
      'Device or hardware': ['Please confirm the device is available for remote diagnosis or collection.', 'We will check the asset configuration and update you shortly.'],
      'Access request': ['Your access request is under review. We will confirm once approval and provisioning are complete.', 'Please confirm the application, role, and business purpose required.'],
      'Network & connectivity': ['Please share your location, network name, and whether colleagues are affected.', 'We are checking connectivity and will update you shortly.'],
      'Email & applications': ['Please share the exact error message and a screenshot if possible.', 'We are checking the application service and your account configuration.']
    }
    return [...new Set([...(byCategory[selectedTicket?.category || ''] || []), ...shared])]
  }, [selectedTicket?.category])

  function autoRoute(categoryName: string) {
    const route=supportOperations.routes.find(item=>item.category===categoryName)
    const activeNames=supportOperations.agents.filter(agent=>agent.active).map(agent=>agent.name)
    const candidates=route?[route.primary,route.fallback].filter(name=>activeNames.includes(name)):['Rajneesh','Development Administrator']
    return candidates.slice().sort((left,right)=>tickets.filter(ticket=>ticket.assignee===left&&!['Resolved','Closed'].includes(ticket.status)).length-tickets.filter(ticket=>ticket.assignee===right&&!['Resolved','Closed'].includes(ticket.status)).length)[0]
  }

  function priorityForSelection(): Ticket['priority'] {
    if (urgency === 'Immediate' && (impact === 'Company-wide' || impact === 'Multiple departments')) return 'Critical'
    if (urgency === 'Immediate' || impact === 'Company-wide' || impact === 'Multiple departments') return 'High'
    if (urgency === 'High' || impact === 'Department') return 'Medium'
    return 'Low'
  }

  function openCategory(nextCategory: string) {
    setCategory(nextCategory)
    setSubcategory(categories[nextCategory][0])
    setKind(nextCategory === 'Access request' ? 'Access request' : 'Incident')
    setShowForm(true)
  }

  function resetForm() {
    setKind('Incident'); setCategory(Object.keys(categories)[0]); setSubcategory(categories[Object.keys(categories)[0]][0]); setTitle(''); setDescription(''); setImpact('Individual'); setUrgency('Normal'); setAssetId(''); setAttachmentFiles([])
  }

  function chooseAttachments(files: File[]) {
    const next = [...attachmentFiles, ...files]
    const issue = validateSupportAttachments(next)
    if (issue) { setNotice({ tone: 'warning', message: issue }); return }
    setAttachmentFiles(next)
  }

  function removeAttachmentFile(index: number) {
    setAttachmentFiles(current => current.filter((_, fileIndex) => fileIndex !== index))
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault()
    if (creatingTicket) return
    const attachmentIssue = validateSupportAttachments(attachmentFiles)
    if (attachmentIssue) { setNotice({ tone: 'warning', message: attachmentIssue }); return }
    setCreatingTicket(true)
    const selectedAttachments = [...attachmentFiles]
    const now = new Date().toISOString()
    const code = nextTicketCode(tickets, kind)
    const priority = priorityForSelection()
    const target = slaPolicy.targets[priority]
    const id = crypto.randomUUID()
    const assignee = autoRoute(category)
    let ticketCreated = false
    try {
      // The Google permission popup is opened while this submit event is still active.
      // Files themselves are only uploaded after the controlled ticket exists.
      const driveSession = selectedAttachments.length ? await beginSupportAttachmentUpload() : null
      const record: Ticket = {
        id, code, kind, category, subcategory, title: title.trim(), description: description.trim(), priority: priorityForSelection(), impact, urgency,
        status: kind === 'Access request' ? 'Awaiting approval' : 'Open', requesterEmail: identityEmail, requesterName: identityName, assetId: assetId || undefined,
        firstResponseDueAt: addBusinessMinutes(now, target.responseMinutes, slaPolicy), resolutionDueAt: addBusinessMinutes(now, target.resolutionMinutes, slaPolicy),
        assignee, routingReason:`Category and current queue workload: ${category}`, source:'Portal', messages: [], attachments: [], createdAt: now, updatedAt: now, history: [{ at: now, event: `Ticket created and automatically routed to ${assignee}${selectedAttachments.length ? ` · ${selectedAttachments.length} attachment${selectedAttachments.length === 1 ? '' : 's'} queued for secure Drive transfer` : ''}`, actor: identityEmail }],
      }
      await setTickets((current) => [...current, record])
      ticketCreated = true
      recordSupportDelivery(setSupportDeliveries, record, 'Ticket created')
      void queueSupportEmail({ticketId:record.id,ticketCode:record.code,to:record.requesterEmail,subject:`[${record.code}] IT support request received`,body:`Your IT support request has been recorded as ${record.code}. Track it in Glassco Connect ITMS.`,event:'Ticket created'}).catch(() => setNotice({ tone: 'warning', message: 'Ticket created, but the acknowledgement email is still pending.' }))
      setTicketConfirmation({code:record.code,assignee,resolutionDueAt:record.resolutionDueAt}); setSelectedTicketId(record.id); setShowForm(false); setView('tickets'); resetForm()
      if (selectedAttachments.length && driveSession) {
        setTransferringAttachments(true)
        const queued = await queueSupportAttachments(record.id, record.code, selectedAttachments, identityEmail, driveSession)
        setPendingAttachmentsByTicket((current) => ({ ...current, [record.id]: queued }))
        setNotice({ tone: 'success', message: `${record.code} created. ${queued.length} file${queued.length === 1 ? '' : 's'} are securely copying to IT Support.` })
      } else {
        setNotice({ tone: 'success', message: `${record.code} created.` })
      }
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : 'The ticket or its attachments could not be saved. Please retry.'
      setNotice(ticketCreated ? { tone: 'warning', message: `${code} was created, but its files were not queued. Use Add attachments to retry. ${detail}` } : { tone: 'error', message: detail })
    } finally { setCreatingTicket(false); setTransferringAttachments(false) }
  }

  async function addAttachmentsToTicket(ticket: Ticket, files: File[]) {
    if (!files.length) return
    const issue = validateSupportAttachments(files)
    if (issue) { setNotice({ tone: 'warning', message: issue }); return }
    setTransferringAttachments(true)
    try {
      const driveSession = await beginSupportAttachmentUpload()
      const queued = await queueSupportAttachments(ticket.id, ticket.code, files, identityEmail, driveSession)
      setPendingAttachmentsByTicket((current) => ({ ...current, [ticket.id]: [...(current[ticket.id] || []), ...queued] }))
      setNotice({ tone: 'success', message: `${queued.length} file${queued.length === 1 ? '' : 's'} are securely copying to IT Support.` })
    } catch (failure) {
      setNotice({ tone: 'warning', message: failure instanceof Error ? failure.message : 'The files could not be queued. Please retry.' })
    } finally { setTransferringAttachments(false) }
  }

  async function viewAttachment(value: SupportAttachment | string) {
    try { await openSupportAttachment(value) }
    catch (failure) { setNotice({ tone: 'warning', message: failure instanceof Error ? failure.message : 'Attachment could not be opened.' }) }
  }

  function assetLabel(asset: Asset) {
    const model = models.find((item) => item.id === asset.modelId)
    const product = assetTypes.find((item) => item.id === asset.typeId)?.name || 'IT asset'
    return `${asset.assetId || asset.assetCode || asset.id} · ${product} · ${model?.name || 'Model unavailable'}${asset.serialNumber || asset.serial ? ` · ${asset.serialNumber || asset.serial}` : ''}`
  }

  async function changeTicketStatus(ticket: Ticket, status: TicketStatus) {
    if (status === 'Awaiting employee' && !waitingReason.trim()) { setNotice({tone:'warning',message:'Enter a waiting reason before pausing the ticket.'}); return }
    if (status === 'Resolved' && !resolutionSummary.trim()) { setNotice({tone:'warning',message:'Enter a resolution summary before resolving the ticket.'}); return }
    const now = new Date().toISOString()
    const event = status === 'Resolved' ? `Resolved: ${resolutionSummary.trim()}` : status === 'Awaiting employee' ? `Waiting for employee: ${waitingReason.trim()}` : `Status changed to ${status}`
    try { await setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status, waitingReason: status === 'Awaiting employee' ? waitingReason.trim() : item.waitingReason, resolutionSummary: status === 'Resolved' ? resolutionSummary.trim() : item.resolutionSummary, resolvedAt: status === 'Resolved' ? now : item.resolvedAt, updatedAt: now, history: [...item.history, { at: now, event, actor: identityEmail }] } : item)) } catch { return }
    recordSupportDelivery(setSupportDeliveries, ticket, status === 'Resolved' ? 'Ticket resolved' : status === 'Awaiting employee' ? 'Waiting for employee' : event)
    if (status === 'Resolved') {
      await sendResolutionRating(ticket, resolutionSummary.trim())
    } else {
      const body = status === 'Awaiting employee' ? `IT Support requires more information for ${ticket.code}. ${waitingReason.trim()}` : `Your IT support request ${ticket.code} is now ${status}.`
      void queueSupportEmail({ticketId:ticket.id,ticketCode:ticket.code,to:ticket.requesterEmail,subject:`[${ticket.code}] ${status}`,body,event:`Status changed to ${status}`}).catch(()=>window.alert('Status saved, but notification could not be queued.'))
    }
    setWaitingReason(''); setResolutionSummary('')
  }

  async function saveTicketControls(ticket: Ticket) {
    if (savingTicket) return
    if (draftStatus === 'Awaiting employee' && !waitingReason.trim()) { setNotice({tone:'warning',message:'Add a waiting reason before saving.'}); return }
    if (draftStatus === 'Resolved' && !resolutionSummary.trim()) { setNotice({tone:'warning',message:'Add a resolution summary before saving.'}); return }
    setSavingTicket(true)
    try {
      const now = new Date().toISOString()
      const events = [draftAssignee !== (ticket.assignee || '') ? `Assigned to ${draftAssignee || 'unassigned queue'}` : '', draftPriority !== ticket.priority ? `Priority changed to ${draftPriority}` : '', draftStatus !== ticket.status ? (draftStatus === 'Resolved' ? `Resolved: ${resolutionSummary.trim()}` : draftStatus === 'Awaiting employee' ? `Waiting for employee: ${waitingReason.trim()}` : `Status changed to ${draftStatus}`) : ''].filter(Boolean)
      if (!events.length) { setNotice({tone:'warning',message:'No ticket changes to save.'}); return }
      await setTickets(current => current.map(item => item.id === ticket.id ? {...item, assignee:draftAssignee || undefined, priority:draftPriority, status:draftStatus, waitingReason:draftStatus === 'Awaiting employee' ? waitingReason.trim() : item.waitingReason, resolutionSummary:draftStatus === 'Resolved' ? resolutionSummary.trim() : item.resolutionSummary, resolvedAt:draftStatus === 'Resolved' && ticket.status !== 'Resolved' ? now : item.resolvedAt, updatedAt:now, history:[...item.history,...events.map(event=>({at:now,event,actor:identityEmail}))]} : item))
      recordSupportDelivery(setSupportDeliveries, ticket, draftStatus === 'Resolved' ? 'Ticket resolved' : events.join(' · '))
      const assignmentChanged = draftAssignee !== (ticket.assignee || '')
      if (draftStatus !== ticket.status) {
        if (draftStatus === 'Resolved') await sendResolutionRating({...ticket,assignee:draftAssignee||undefined,status:draftStatus,resolutionSummary:resolutionSummary.trim()},resolutionSummary.trim())
        else {
          const ownerNote = assignmentChanged ? ` ${draftAssignee ? `${draftAssignee} is now working on your request.` : 'The request has returned to the unassigned support queue.'}` : ''
          const body = draftStatus === 'Awaiting employee' ? `IT Support requires more information for ${ticket.code}. ${waitingReason.trim()}${ownerNote}` : `Your IT support request ${ticket.code} is now ${draftStatus}.${ownerNote}`
          void queueSupportEmail({ticketId:ticket.id,ticketCode:ticket.code,to:ticket.requesterEmail,subject:`[${ticket.code}] ${draftStatus}`,body,event:`Status changed to ${draftStatus}`}).catch(()=>setNotice({tone:'warning',message:'Ticket saved, but its email notification is still pending.'}))
        }
      } else if (assignmentChanged) {
        const owner = draftAssignee || 'the unassigned support queue'
        const body = draftAssignee ? `${draftAssignee} is now working on your IT support request ${ticket.code}. You can follow updates in Glassco Workspace.` : `Your IT support request ${ticket.code} has been returned to the unassigned support queue. It will be picked up by the next available IT team member.`
        recordSupportDelivery(setSupportDeliveries, ticket, 'Assignment notification')
        void queueSupportEmail({ticketId:ticket.id,ticketCode:ticket.code,to:ticket.requesterEmail,subject:`[${ticket.code}] Assigned to ${owner}`,body,event:'Assignment notification'}).catch(()=>setNotice({tone:'warning',message:'Ticket saved, but the assignment email is still pending.'}))
      }
      setNotice({tone:'success',message:`${ticket.code} updated successfully.`})
    } catch {
      setNotice({tone:'error',message:'This ticket changed while you were editing. The latest version is shown; review it and save again.'})
    } finally { setSavingTicket(false) }
  }

  function toggleBulkSelection(ticketId: string) {
    setBulkSelection(current => current.includes(ticketId) ? current.filter(id => id !== ticketId) : [...current, ticketId])
  }

  async function applyBulkUpdate() {
    if (!selectedQueueTickets.length) { setNotice({ tone: 'warning', message: 'Select one or more tickets first.' }); return }
    if (bulkAssignee === '' && bulkStatus === 'Keep current' && bulkPriority === 'Keep current') { setNotice({ tone: 'warning', message: 'Choose an assignment, status, or priority to apply.' }); return }
    const now = new Date().toISOString()
    const selectedIds = new Set(selectedQueueTickets.map(ticket => ticket.id))
    try {
      await setTickets(current => current.map(ticket => {
        if (!selectedIds.has(ticket.id)) return ticket
        const nextAssignee = bulkAssignee === '' ? ticket.assignee : bulkAssignee
        const nextStatus = bulkStatus === 'Keep current' ? ticket.status : bulkStatus
        const nextPriority = bulkPriority === 'Keep current' ? ticket.priority : bulkPriority
        const events = [
          nextAssignee !== ticket.assignee ? `Bulk assigned to ${nextAssignee}` : '',
          nextStatus !== ticket.status ? `Bulk status changed to ${nextStatus}` : '',
          nextPriority !== ticket.priority ? `Bulk priority changed to ${nextPriority}` : ''
        ].filter(Boolean)
        return events.length ? { ...ticket, assignee: nextAssignee, status: nextStatus, priority: nextPriority, updatedAt: now, history: [...ticket.history, ...events.map(event => ({ at: now, event, actor: identityEmail }))] } : ticket
      }))
      setNotice({ tone: 'success', message: `Updated ${selectedQueueTickets.length} ticket${selectedQueueTickets.length === 1 ? '' : 's'} with a controlled bulk action.` })
      setBulkSelection([]); setBulkAssignee(''); setBulkStatus('Keep current'); setBulkPriority('Keep current')
    } catch { setNotice({ tone: 'error', message: 'One or more selected tickets changed. Refresh the queue and retry the bulk update.' }) }
  }

  async function sendResolutionRating(ticket: Ticket, summary = ticket.resolutionSummary || '') {
    if (!ratingCloud.ready) { window.alert('Ratings are still loading. Please use Send rating invitation once connected.'); return }
    try {
      let invite = ratingInvites.find(row => row.ticketId === ticket.id && !row.submittedAt && Date.parse(row.expiresAt) > Date.now())
      if (!invite) {
        const token = crypto.randomUUID(), now = new Date().toISOString()
        invite = {id:token,token,ticketId:ticket.id,ticketCode:ticket.code,requesterEmail:ticket.requesterEmail,assignee:ticket.assignee || 'IT Service Desk',resolvedBy:identityEmail,createdAt:now,expiresAt:new Date(Date.now()+30*86400000).toISOString(),expiresAtMs:Date.now()+30*86400000}
        const savedInvite = invite
        await setRatingInvites(rows => [...rows, savedInvite])
      }
      const ratingUrl = `https://glassco-connect-itms-dev.web.app/?supportRating=${invite.token}`
      await queueSupportEmail({ticketId:ticket.id,ticketCode:ticket.code,to:ticket.requesterEmail,subject:`[${ticket.code}] Resolved — please rate your support`,body:`Your IT support request ${ticket.code} has been resolved.\n\nResolution: ${summary}\n\nHow was our service?\n★ ★ ★ ★ ★\n\nRate your support (1–5 stars):\n${ratingUrl}\n\nSign in using ${ticket.requesterEmail}. The link expires in 30 days. Your feedback helps improve IT support.`,event:'Resolution and rating invitation'})
    } catch { window.alert('The resolution was saved, but its rating email could not be queued. Use Send rating invitation to retry.') }
  }

  function addMessage(ticketId: string, visibility: 'employee' | 'internal', body: string) {
    if (!body.trim()) return
    const now = new Date().toISOString()
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, updatedAt: now, messages: [...(ticket.messages || []), { id: crypto.randomUUID(), at: now, author: identityEmail, visibility, body: body.trim() }], history: [...ticket.history, { at: now, event: visibility === 'internal' ? 'Private IT note added' : 'Conversation reply added', actor: identityEmail }] } : ticket))
    const ticket = tickets.find((item) => item.id === ticketId); if (ticket && visibility === 'employee') recordSupportDelivery(setSupportDeliveries, ticket, isServiceAgent ? 'Agent reply' : 'Employee reply')
    if (visibility === 'internal') setInternalNote(''); else setReplyText('')
  }

  function reopenTicket(ticket: Ticket) {
    if (!reopenReason.trim()) { setNotice({tone:'warning',message:'Please record why the ticket needs to be reopened.'}); return }
    const now = new Date().toISOString()
    setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status: 'Open', resolutionSummary: undefined, resolvedAt: undefined, resolutionConfirmedAt: undefined, closedAt: undefined, reopenReason:reopenReason.trim(), reopenCount:(item.reopenCount||0)+1, updatedAt: now, history: [...item.history, { at: now, event: `Ticket reopened by employee: ${reopenReason.trim()}`, actor: identityEmail }] } : item))
    setReopenReason('');setReopenTicketId('')
  }

  async function confirmResolution(ticket: Ticket) {
    if (ticket.status !== 'Resolved') return
    const now = new Date().toISOString()
    try {
      await setTickets(current => current.map(item => item.id === ticket.id ? {
        ...item, status: 'Closed', resolutionConfirmedAt: now, closedAt: now, updatedAt: now,
        history: [...item.history, { at: now, event: 'Resolution confirmed by employee; ticket closed', actor: identityEmail }]
      } : item))
      recordSupportDelivery(setSupportDeliveries, ticket, 'Resolution confirmed and ticket closed')
      void queueSupportEmail({ticketId:ticket.id,ticketCode:ticket.code,to:ticket.requesterEmail,subject:`[${ticket.code}] Closed`,body:`Your IT support request ${ticket.code} was confirmed and closed. Reply or reopen from the Support Desk if the issue returns.`,event:'Ticket closed'}).catch(()=>undefined)
      setNotice({tone:'success',message:`${ticket.code} has been closed. You can reopen it if the issue returns.`})
    } catch { setNotice({tone:'error',message:'The ticket could not be closed. Please retry.'}) }
  }

  function linkItmsRecord(ticketId: string, link: NonNullable<Ticket['itmsLinks']>[number], event: string) {
    const now = new Date().toISOString()
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, itmsLinks: [...(ticket.itmsLinks || []), link], updatedAt: now, history: [...ticket.history, { at: now, event, actor: identityEmail }] } : ticket))
  }

  function startRepair(ticket: Ticket) {
    if (!ticket.assetId || !integrationNotes.trim()) return
    if (maintenance.some((record) => record.assetId === ticket.assetId && record.kind === 'Repair' && record.state === 'Scheduled')) { window.alert('This asset already has an active repair record. Open ITMS Maintenance to continue it.'); return }
    if (repairMode === 'External vendor' && (!repairVendorId || !expectedReturnDate || !carrier.trim())) { window.alert('External repair requires vendor, expected return date and carrier.'); return }
    const now = new Date().toISOString(); const today = now.slice(0,10)
    const code = `MNT-${new Date().getFullYear()}-${String(maintenance.length + 1).padStart(4,'0')}`
    const gatePass = repairMode === 'External vendor' ? { number: `GP-OUT-${new Date().getFullYear()}-${String(maintenance.filter(item=>item.gatePass).length + 1).padStart(4,'0')}`, dispatchedDate: today, expectedReturnDate, carrier: carrier.trim(), authorisedBy: identityEmail, returnedAt: '' } : undefined
    const record: Maintenance = { id: crypto.randomUUID(), code, assetId: ticket.assetId, activity: ticket.title, kind: 'Repair', frequency: 'One time', dueDate: today, responsible: identityEmail, vendorId: repairVendorId, notes: `${integrationNotes.trim()}\nOriginating support ticket: ${ticket.code}`, serviceMode: repairMode, gatePass, state: 'Scheduled', createdAt: now, completedAt: '', performedDate: '', technician: '', cost: 0, findings: '', partsReplaced: '', downtimeHours: 0, outcome: '', nextDueDate: '', disposition: '' }
    setMaintenance((current)=>[...current,record]); setAssets((current)=>current.map(asset=>asset.id===ticket.assetId?{...asset,stockStatus:'Under repair'}:asset)); linkItmsRecord(ticket.id,{kind:'Repair',reference:gatePass?`${code} · ${gatePass.number}`:code,recordId:record.id,createdAt:now},`ITMS repair ${code} started${gatePass?` with gate pass ${gatePass.number}`:''}`); setIntegrationMode('');setIntegrationNotes('');setRepairVendorId('');setExpectedReturnDate('');setCarrier('')
  }

  function logAssetIncident(ticket: Ticket) {
    if (!ticket.assetId || !currentUser || !integrationNotes.trim()) return
    if (incidents.some(record=>record.assetId===ticket.assetId&&record.status==='Open')) { window.alert('This asset already has an open incident or escalation record.'); return }
    const now=new Date().toISOString(); const code=`ASE-${new Date().getFullYear()}-${String(incidents.length+1).padStart(4,'0')}`
    const record:AssetIncident={id:crypto.randomUUID(),code,userId:currentUser.id,assetId:ticket.assetId,type:incidentType,severity:ticket.priority,eventDate:now.slice(0,10),notes:`${integrationNotes.trim()}\nOriginating support ticket: ${ticket.code}`,status:'Open',reportedAt:now,reportedBy:identityEmail,closedAt:''}
    setIncidents(current=>[...current,record]); setAssets(current=>current.map(asset=>asset.id===ticket.assetId?{...asset,stockStatus:['Lost','Stolen'].includes(incidentType)?'Missing - investigation':'Under repair'}:asset));linkItmsRecord(ticket.id,{kind:'Incident',reference:code,recordId:record.id,createdAt:now},`ITMS asset incident ${code} logged`);setIntegrationMode('');setIntegrationNotes('')
  }

  function requestReplacement(ticket: Ticket) {
    if (!ticket.assetId || !replacementAssetId || !currentUser || !integrationNotes.trim()) return
    if (allocations.some((record) => record.replacementAssetId === ticket.assetId && record.state?.startsWith('Pending'))) { window.alert('A replacement request is already pending for this asset.'); return }
    const now = new Date().toISOString(); const code = `ALLOC-${new Date().getFullYear()}-${String(allocations.length + 1).padStart(4, '0')}`
    const record: Allocation = { id: crypto.randomUUID(), code, departmentId: currentUser.departmentId || '', userId: currentUser.id, assetIds: [replacementAssetId], replacementAssetId: ticket.assetId, allocationKind: 'Replacement', allocationDate: now.slice(0, 10), expectedReturnDate: '', purpose: `${integrationNotes.trim()} · Originating support ticket ${ticket.code}`, state: 'Pending Asset Manager', requestedBy: identityEmail, requestedAt: now, assetManagerApprovedAt: '', itHeadApprovedAt: '' }
    setAllocations((current) => [...current, record]); linkItmsRecord(ticket.id, { kind: 'Replacement', reference: code, recordId: record.id, createdAt: now }, `ITMS replacement request ${code} submitted`); setIntegrationMode(''); setIntegrationNotes(''); setReplacementAssetId('')
  }

  function slaLabel(ticket: Ticket) {
    if (ticket.status === 'Resolved') return 'Completed'
    const remaining = new Date(ticket.resolutionDueAt).getTime() - Date.now()
    if (remaining <= 0) return 'Breached'
    const hours = Math.ceil(remaining / 3600000)
    return `${hours}h remaining`
  }

  if (!ticketCloud.ready) return <main className="support-panel"><h1>Connecting to Support Desk</h1><p>{ticketCloud.error || 'Loading your authorised tickets…'}</p><button onClick={onExit}>Back to applications</button></main>
  return <div className="support-app">
    {notice&&<div className={`support-toast ${notice.tone}`} role="status"><Icon name={notice.tone==='success'?'assurance':'bell'} size={19}/><span>{notice.message}</span><button type="button" aria-label="Dismiss notification" onClick={()=>setNotice(null)}>×</button></div>}
    <header className="support-topbar">
      <div className="support-brand"><img src="/brand/glassco-logo-transparent.png" alt="Glassco — A Glass Apart"/><span>CONNECT · IT SUPPORT DESK</span></div>
      <div className="support-top-actions"><button type="button" onClick={onExit}>All applications</button><span>{identityEmail}</span></div>
    </header>
    <div className={`support-layout ${sidebarCollapsed?'sidebar-collapsed':''}`}>
      <aside className={`support-sidebar ${sidebarCollapsed?'collapsed':''}`}><div className="support-sidebar-heading"><span className="support-nav-label">Employee portal</span><button type="button" className="support-sidebar-collapse" onClick={()=>setSidebarCollapsed(current=>{const next=!current;localStorage.setItem('glassco.workspace.sidebar-collapsed.v1',String(next));return next})} aria-label={sidebarCollapsed?'Expand navigation':'Collapse navigation'} title={sidebarCollapsed?'Expand navigation':'Collapse navigation'}><Icon name="chevron" size={17}/></button></div><nav>
        {([['home','dashboard','Home'],['tickets','support','My tickets'],['assets','laptop','My IT assets'],['catalog','requests','Service catalogue'],['knowledge','requests','Help articles'],...(isServiceAgent ? [['service','service','Service workspace'],['governance','assurance','SLA & notifications'],...(canViewManagementAnalytics ? [['analytics','reports','Reports & analytics']] : []),['email','mail','Email channel'],['admin','masters','Administration']] : [])] as [typeof view, IconName, string][]).map(([id, icon, label]) => <button type="button" className={view === id ? 'active' : ''} key={id} onClick={() => navigateSupport(id)} title={sidebarCollapsed?label:undefined}><Icon name={icon} size={19}/><span className="support-nav-text">{label}</span></button>)}
      </nav><div className="support-sidebar-foot"><strong>Employee self-service</strong><span>Integrated with ITMS identity and custody</span></div></aside>
      <main className="support-main">
        {showForm ? <section className="support-ticket-form-page"><div className="support-page-heading"><div><span>NEW SUPPORT CASE</span><h1>Raise a support ticket</h1><p>Tell IT what you need. A controlled ticket number will be generated automatically.</p></div><button type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
          <form className="support-ticket-form" onSubmit={createTicket}>
            <label>Ticket type<select value={kind} onChange={(event) => setKind(event.target.value as TicketKind)}><option>Incident</option><option>Service request</option><option>Access request</option></select></label>
            <label>Category<select value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory(categories[event.target.value][0]) }}>{Object.keys(categories).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Subcategory<select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>{categories[category].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Related asset<select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">No asset / not applicable</option>{myAssets.map((asset) => <option value={asset.id} key={asset.id}>{assetLabel(asset)}</option>)}</select></label>
            <label className="span-two">Short summary<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Briefly describe the issue or request"/>{suggestedKnowledge.length>0&&<div className="support-knowledge-suggestions"><strong>Suggested help articles</strong>{suggestedKnowledge.map(article=><button type="button" key={article.id} onClick={()=>navigateSupport('knowledge')}>{article.title}</button>)}</div>}</label>
            <label>Impact<select value={impact} onChange={(event) => setImpact(event.target.value as Ticket['impact'])}><option>Individual</option><option>Department</option><option>Multiple departments</option><option>Company-wide</option></select></label>
            <label>Urgency<select value={urgency} onChange={(event) => setUrgency(event.target.value as Ticket['urgency'])}><option>Normal</option><option>High</option><option>Immediate</option></select></label>
            <label className="span-four">Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Include the error, when it started, and what you have already tried."/></label>
            <label className="span-four support-file-field">Attachments <small>Optional PDF, Office files, screenshots, spreadsheets, text, audio or video · up to 10 files, 15 MB each.</small><input type="file" accept={attachmentAccept} multiple onChange={(event) => { chooseAttachments(Array.from(event.target.files || [])); event.currentTarget.value = '' }}/>{attachmentFiles.length > 0 && <div className="support-file-selection">{attachmentFiles.map((file, index) => <span key={`${file.name}-${index}`}><Icon name="requests" size={15}/>{file.name} · {attachmentSize(file.size)}<button type="button" onClick={() => removeAttachmentFile(index)} aria-label={`Remove ${file.name}`}>×</button></span>)}</div>}</label>
            <div className="support-form-summary"><span>Calculated priority</span><strong>{priorityForSelection()}</strong><small>Based on the selected impact and urgency.</small></div>
            <div className="support-form-actions"><button type="button" disabled={creatingTicket} onClick={() => setShowForm(false)}>Cancel</button><button className="support-primary" disabled={creatingTicket} type="submit">{creatingTicket ? (attachmentFiles.length ? 'Creating & preparing files…' : 'Creating ticket…') : 'Create ticket'}</button></div>
          </form>
        </section> : view === 'home' ? <>
          <div className="support-welcome"><div><span>EMPLOYEE SELF-SERVICE</span><h1>How can we help today?</h1><p>Report an issue, request access, or follow your existing support cases.</p></div><div><button className="support-primary" type="button" onClick={() => setShowForm(true)}><Icon name="plus" size={18}/>Raise a ticket</button><button type="button" onClick={() => setView('tickets')}>Track a ticket</button></div></div>
          <div className="support-health"><Icon name="check" size={20}/><span>All core IT services are operating normally.</span></div>
          <div className="support-home-grid"><div><section className="support-panel"><header><h2>What do you need help with?</h2></header><div className="support-service-grid">{Object.keys(categories).map((item) => <button type="button" key={item} onClick={() => openCategory(item)}><span><Icon name={categoryIcon[item]} size={22}/></span><div><strong>{item}</strong><small>{item === 'Device or hardware' ? 'Laptop, printer, mobile or accessory' : item === 'Access request' ? 'Application, folder, group or VPN' : item === 'Network & connectivity' ? 'Wi-Fi, internet, VPN or LAN' : 'Outlook, Microsoft 365 or software'}</small></div><Icon name="chevron" size={17}/></button>)}</div></section>
            <section className="support-panel support-ticket-list"><header><h2>My active tickets</h2><button type="button" onClick={() => setView('tickets')}>View all</button></header>{myTickets.filter((ticket) => ticket.status !== 'Resolved').slice(0,3).map((ticket) => <button type="button" className="support-ticket-row" key={ticket.id} onClick={() => { setSelectedTicketId(ticket.id); setView('tickets') }}><div><strong>{ticket.code} · {ticket.title}</strong><small>{ticket.category} · Updated {formatDate(ticket.updatedAt)}</small></div><span className={`support-status ${ticket.status.toLowerCase().replaceAll(' ','-')}`}>{ticket.status}</span></button>)}{!myTickets.some((ticket) => ticket.status !== 'Resolved') && <div className="support-empty">No active tickets. Use “Raise a ticket” whenever you need IT assistance.</div>}</section></div>
            <aside><section className="support-panel support-side-panel"><header><h2>My IT assets</h2></header>{myAssets.slice(0,2).map((asset) => <div className="support-asset" key={asset.id}><span><Icon name="laptop" size={22}/></span><div><strong>{models.find((item) => item.id === asset.modelId)?.name || 'IT asset'}</strong><small>{asset.assetCode || asset.id}</small></div></div>)}{myAssets.length === 0 && <div className="support-empty">No active asset custody found.</div>}<button type="button" onClick={() => setView('assets')}>View all assets</button></section>
              <section className="support-panel support-side-panel"><header><h2>Quick solutions</h2></header>{['Reset my password','Connect to VPN','Add a network printer'].map((item) => <button type="button" key={item} onClick={() => setView('knowledge')}>{item}<Icon name="arrow" size={17}/></button>)}</section></aside></div>
        </> : view === 'tickets' ? <section>
          <div className="support-page-heading"><div><span>PERSONAL SUPPORT HISTORY</span><h1>My tickets</h1><p>Track requests, communicate with IT and review every controlled update.</p></div><button className="support-primary" type="button" onClick={() => setShowForm(true)}>New ticket</button></div>
          {ticketConfirmation&&<section className="support-ticket-confirmation"><div><span>SUPPORT REQUEST CONFIRMED</span><strong>{ticketConfirmation.code}</strong><p>Routed to {ticketConfirmation.assignee} · Resolution target {formatDate(ticketConfirmation.resolutionDueAt)}</p></div><button type="button" onClick={()=>setTicketConfirmation(null)}>Dismiss</button></section>}
          <div className="support-record-layout">
            <section className="support-panel support-ticket-list"><header className="support-ticket-list-header"><div><h2>{visibleMyTickets.length} ticket{visibleMyTickets.length === 1 ? '' : 's'}</h2><p>{myTickets.length} total in your support history</p></div><div className="support-ticket-search"><input value={myTicketSearch} onChange={(event) => setMyTicketSearch(event.target.value)} placeholder="Search ticket number, subject or category" aria-label="Search my tickets"/><select value={myTicketStatus} onChange={(event) => setMyTicketStatus(event.target.value as typeof myTicketStatus)} aria-label="Filter tickets by status"><option>All</option><option>Open</option><option>In progress</option><option>Awaiting approval</option><option>Awaiting employee</option><option>Resolved</option></select></div></header>{visibleMyTickets.map((ticket) => <button type="button" className={`support-ticket-row ${selectedTicketId === ticket.id ? 'selected' : ''}`} key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}><div><strong>{ticket.code} · {ticket.title}</strong><small>{ticket.category} · {formatDate(ticket.updatedAt)}</small></div><span className={`support-status ${ticket.status.toLowerCase().replaceAll(' ','-')}`}>{ticket.status}</span></button>)}{visibleMyTickets.length === 0 && <div className="support-empty">{myTickets.length ? 'No tickets match this search or status filter.' : 'No tickets created yet.'}</div>}</section>
            {selectedTicket && <aside className="support-panel support-ticket-detail">
              <header><span>{selectedTicket.code}</span><h2>{selectedTicket.title}</h2><p>{selectedTicket.kind} · {selectedTicket.category} / {selectedTicket.subcategory}</p></header>
              <div className="support-progress" aria-label="Ticket progress">{(['Raised','Assigned','In progress','Resolved','Closed'] as const).map((step,index)=>{const complete=step==='Raised'||(step==='Assigned'&&Boolean(selectedTicket.assignee))||(step==='In progress'&&['In progress','Awaiting employee','Resolved','Closed'].includes(selectedTicket.status))||(step==='Resolved'&&['Resolved','Closed'].includes(selectedTicket.status))||(step==='Closed'&&selectedTicket.status==='Closed');return <span className={complete?'complete':''} key={step}><i>{complete?'✓':index+1}</i>{step}</span>})}</div><dl><div><dt>Status</dt><dd>{selectedTicket.status}</dd></div><div><dt>Priority</dt><dd>{selectedTicket.priority}</dd></div><div><dt>Created</dt><dd>{formatDate(selectedTicket.createdAt)}</dd></div><div><dt>Attachments</dt><dd>{visibleAttachments(selectedTicket).length || 'None'}</dd></div></dl>
              <p>{selectedTicket.description}</p>
              <h3>Attachments</h3>
              <div className="support-attachment-action">
                <div><strong>Add supporting files</strong><span>PDF, Office files, screenshots, spreadsheets, audio or video.</span></div>
                <label className={`support-attachment-add ${transferringAttachments ? 'is-busy' : ''}`}>
                  <Icon name="plus" size={15}/><span>{transferringAttachments ? 'Preparing files…' : 'Add files'}</span>
                  <input type="file" accept={attachmentAccept} multiple disabled={transferringAttachments} onChange={(event) => { const files = Array.from(event.target.files || []); event.currentTarget.value = ''; void addAttachmentsToTicket(selectedTicket, files) }}/>
                </label>
              </div>
              <AttachmentList attachments={visibleAttachments(selectedTicket)} onOpen={viewAttachment} onPreview={setPreviewAttachment}/>
              {selectedTicket.waitingReason&&<div className="support-ticket-callout"><strong>IT is waiting for you</strong><span>{selectedTicket.waitingReason}</span></div>}
              {selectedTicket.resolutionSummary&&<div className="support-ticket-callout resolved"><strong>Resolution</strong><span>{selectedTicket.resolutionSummary}</span></div>}
              <h3>Conversation</h3><div className="support-conversation">{(selectedTicket.messages||[]).filter(message=>message.visibility==='employee').map(message=><article className={message.author===identityEmail?'mine':''} key={message.id}><strong>{message.author}</strong><p>{message.body}</p><small>{formatDate(message.at)}</small></article>)}{!(selectedTicket.messages||[]).some(message=>message.visibility==='employee')&&<span>No replies yet.</span>}</div>
               {!['Resolved','Closed'].includes(selectedTicket.status)?<div className="support-reply"><textarea value={replyText} onChange={event=>setReplyText(event.target.value)} placeholder="Reply to the IT service team"/><button className="support-primary" type="button" onClick={()=>addMessage(selectedTicket.id,'employee',replyText)}>Send reply</button></div>:<>{selectedTicket.status==='Resolved'&&<div className="support-ticket-callout resolved"><strong>Is this resolved?</strong><span>Confirm to close the ticket now. If the issue remains, reopen it with a reason.</span><button className="support-primary" type="button" onClick={()=>confirmResolution(selectedTicket)}>Confirm & close ticket</button></div>}{reopenTicketId===selectedTicket.id?<div className="support-reopen-form"><label>Why does this ticket need reopening?<textarea value={reopenReason} onChange={event=>setReopenReason(event.target.value)} placeholder="Describe what remains unresolved or has recurred"/></label><div><button type="button" onClick={()=>{setReopenTicketId('');setReopenReason('')}}>Cancel</button><button className="support-primary" type="button" onClick={()=>reopenTicket(selectedTicket)}>Confirm reopen</button></div></div>:<button className="support-reopen" type="button" onClick={()=>setReopenTicketId(selectedTicket.id)}>Reopen ticket</button>}</>}
              <h3>History</h3>{selectedTicket.history.map((entry) => <div className="support-history" key={`${entry.at}-${entry.event}`}><i/><div><strong>{entry.event}</strong><small>{formatDate(entry.at)} · {entry.actor}</small></div></div>)}
            </aside>}
          </div>
        </section>
        : view === 'assets' ? <section><div className="support-page-heading"><div><span>ITMS CUSTODY VIEW</span><h1>My IT assets</h1><p>Current custody and the complete allocation transaction history from the controlled ITMS ledger.</p></div><button type="button" onClick={() => { setCategory('Device or hardware'); setSubcategory(categories['Device or hardware'][0]); setShowForm(true) }}>Report an asset issue</button></div><section className="support-panel support-asset-table"><header><div><h2>Currently allocated</h2><p>{myAssets.length} asset{myAssets.length === 1 ? '' : 's'} in custody</p></div></header><DataTable rows={myAssets} rowKey={(asset) => asset.id} columns={[{ key: 'asset', label: 'Asset ID', sticky: true, width: '180px', render: (asset) => <strong>{asset.assetId || asset.assetCode || asset.id}</strong> }, { key: 'product', label: 'Product', width: '180px', render: (asset) => assetTypes.find((type) => type.id === asset.typeId)?.name || 'IT asset' }, { key: 'model', label: 'Model', width: '240px', render: (asset) => models.find((model) => model.id === asset.modelId)?.name || 'Model unavailable' }, { key: 'serial', label: 'Serial number', width: '190px', render: (asset) => asset.serialNumber || asset.serial || 'Not applicable' }, { key: 'status', label: 'Status', width: '150px', render: (asset) => <span className="support-status open">{asset.stockStatus || asset.status || 'In custody'}</span> }, { key: 'action', label: 'Action', width: '180px', render: (asset) => <button type="button" className="support-link-button" onClick={() => { setAssetId(asset.id); setCategory('Device or hardware'); setSubcategory(categories['Device or hardware'][0]); setShowForm(true) }}>Report issue</button> }]} empty={<div className="support-empty">No active asset custody found for {identityEmail}.</div>} /></section><section className="support-panel support-asset-table"><header><div><h2>Allocation &amp; custody history</h2><p>Every allocation, transfer, return and revocation recorded for your assets.</p></div></header><DataTable rows={myAssetHistory} rowKey={(entry) => entry.id} columns={[{ key: 'date', label: 'Date', sticky: true, width: '190px', render: (entry) => entry.at ? formatDate(entry.at) : 'Date unavailable' }, { key: 'event', label: 'Transaction', width: '220px', render: (entry) => entry.event }, { key: 'reference', label: 'Reference', width: '190px', render: (entry) => entry.reference }, { key: 'assets', label: 'Assets', width: '420px', render: (entry) => entry.assetIds.map((id) => { const asset = assets.find((candidate) => candidate.id === id); return asset ? assetLabel(asset) : 'Asset record unavailable' }).join(' | ') }, { key: 'status', label: 'Status', width: '180px', render: (entry) => entry.status }]} empty={<div className="support-empty">No custody transactions have been recorded yet.</div>} /></section></section>
        : view === 'catalog' ? <ServiceCatalog identityEmail={identityEmail} identityName={identityName} isServiceAgent={isServiceAgent}/>
        : view === 'knowledge' ? <KnowledgeBase identityEmail={identityEmail} isServiceAgent={isServiceAgent} resolvedTickets={tickets.filter(ticket=>ticket.status==='Resolved')} onRaiseTicket={()=>setShowForm(true)}/>
        : view === 'governance' ? <SupportGovernance tickets={tickets} identityEmail={identityEmail} onOpenTicket={(id)=>{setSelectedTicketId(id);setView('service')}}/>
        : view === 'analytics' && canViewManagementAnalytics ? <SupportAnalytics identityEmail={identityEmail} ratings={ratingInvites} tickets={tickets} onOpenTicket={(id)=>{setSelectedTicketId(id);setView('service')}}/>
        : view === 'admin' ? <SupportAdministration identityEmail={identityEmail}/>
        : view === 'email' ? <EmailTicketing identityEmail={identityEmail} onOpenTicket={(id)=>{setSelectedTicketId(id);setView('service')}}/>
        : view === 'rating' ? <section className="support-panel support-rating">{(()=>{const invite=ratingInvites.find(row=>row.token===ratingToken);if(!ratingCloud.ready)return <div>Loading your rating invitation…</div>;if(!invite||invite.requesterEmail.toLowerCase()!==identityEmail.toLowerCase()||(!invite.submittedAt&&Date.parse(invite.expiresAt)<=Date.now()))return <div><h1>Rating link is invalid or expired</h1><p>Ask IT Support to issue a new invitation.</p></div>;if(invite.submittedAt)return <div><h1>Thank you</h1><p>Your {invite.stars}-star rating for {invite.ticketCode} is recorded.</p></div>;return <div><span>SUPPORT SATISFACTION</span><h1>Rate your IT support</h1><p>{invite.ticketCode} · Was your request handled effectively?</p><div className="support-stars">{[1,2,3,4,5].map(star=><button type="button" aria-label={`Rate ${star} out of 5 stars`} aria-pressed={ratingStars===star} className={ratingStars>=star?'selected':''} onClick={()=>setRatingStars(star)} key={star}>★</button>)}</div><label><input type="checkbox" checked={ratingResolved} onChange={e=>setRatingResolved(e.target.checked)}/> My issue was resolved</label><textarea value={ratingComment} onChange={e=>setRatingComment(e.target.value)} placeholder="Optional comments"/><button className="support-primary" disabled={!ratingStars} onClick={()=>setRatingInvites(rows=>rows.map(row=>row.id===invite.id?{...row,stars:ratingStars,resolved:ratingResolved,comment:ratingComment.trim(),submittedAt:new Date().toISOString()}:row))}>Submit rating</button></div>})()}</section>
        : <section className="support-service-workspace"><div className="support-page-heading"><div><span>IT SERVICE OPERATIONS</span><h1>Service workspace</h1><p>Assign, prioritise and progress employee support cases from one controlled queue.</p></div><div className="support-view-switch"><button className={serviceMode==='queue'?'selected':''} type="button" onClick={()=>setServiceMode('queue')}>Queue</button><button className={serviceMode==='board'?'selected':''} type="button" onClick={()=>setServiceMode('board')}>Kanban board</button></div></div>
          <div className="support-queue-kpis"><article><span>Unassigned</span><strong>{tickets.filter(ticket=>!ticket.assignee&&!['Resolved','Closed'].includes(ticket.status)).length}</strong></article><article><span>Open workload</span><strong>{tickets.filter(ticket=>!['Resolved','Closed'].includes(ticket.status)).length}</strong></article><article><span>SLA breached</span><strong>{tickets.filter(ticket=>!['Resolved','Closed'].includes(ticket.status)&&new Date(ticket.resolutionDueAt).getTime()<=Date.now()).length}</strong></article><article><span>Resolved / closed</span><strong>{tickets.filter(ticket=>['Resolved','Closed'].includes(ticket.status)).length}</strong></article></div>
          <div className="support-saved-views"><span>Saved views</span>{(['All','My queue','Unassigned','Breached','Awaiting employee','Critical'] as const).map(item=><button type="button" className={queueView===item?'active':''} key={item} onClick={()=>setQueueView(item)}>{item}</button>)}</div><div className="support-queue-filters"><label>Search<input value={queueSearch} onChange={event=>setQueueSearch(event.target.value)} placeholder="Code, employee, category or assignee"/></label><label>Status<select value={queueStatus} onChange={event=>setQueueStatus(event.target.value)}>{['All','Open','In progress','Awaiting approval','Awaiting employee','Resolved','Closed'].map(value=><option key={value}>{value}</option>)}</select></label><label>Priority<select value={queuePriority} onChange={event=>setQueuePriority(event.target.value)}>{['All','Critical','High','Medium','Low'].map(value=><option key={value}>{value}</option>)}</select></label></div>
          <section className="support-bulk-toolbar" aria-label="Bulk ticket updates"><div><strong>{selectedQueueTickets.length} selected</strong><button type="button" onClick={()=>setBulkSelection(bulkSelection.length===queueTickets.length?[]:queueTickets.map(ticket=>ticket.id))}>{bulkSelection.length===queueTickets.length&&queueTickets.length?'Clear visible':'Select visible'}</button></div><label>Assign<select value={bulkAssignee} onChange={event=>setBulkAssignee(event.target.value)}><option value="">Keep current</option><option>IT Service Desk</option><option>IT Asset Manager</option><option>IT Head</option></select></label><label>Status<select value={bulkStatus} onChange={event=>setBulkStatus(event.target.value as typeof bulkStatus)}><option>Keep current</option><option>Open</option><option>In progress</option><option>Awaiting approval</option></select></label><label>Priority<select value={bulkPriority} onChange={event=>setBulkPriority(event.target.value as typeof bulkPriority)}><option>Keep current</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><button className="support-primary" type="button" onClick={()=>void applyBulkUpdate()}>Apply update</button></section>
          {selectedTicket&&<section className="support-agent-productivity"><div><strong>{selectedTicket.code} · Agent tools</strong><small>Category-aware replies are inserted into the employee response box below.</small></div>{otherActiveViewers.length>0&&<p className="support-collaboration-alert"><strong>Also viewing:</strong> {otherActiveViewers.map(viewer=>viewer.name||viewer.email).join(', ')}. Coordinate before making overlapping changes.</p>}<div className="support-response-templates"><span>Suggested replies</span>{responseTemplates.map(template=><button type="button" key={template} onClick={()=>setReplyText(template)}>{template}</button>)}</div></section>}
          {selectedTicket&&<TicketEmailTrail rows={emailTrail}/>} 
          {selectedTicket?.assetId&&<section className="support-replacement-strip"><div><strong>Asset replacement</strong><span>Create a controlled replacement request against {assetLabel(assets.find(asset=>asset.id===selectedTicket.assetId) as Asset)}.</span></div><button type="button" onClick={()=>setIntegrationMode(integrationMode==='Replacement'?'':'Replacement')}>Request replacement</button></section>}
          {integrationMode==='Replacement'&&selectedTicket?.assetId&&<div className="support-integration-form support-replacement-form"><label>Replacement asset<select value={replacementAssetId} onChange={event=>setReplacementAssetId(event.target.value)}><option value="">Select available asset</option>{assets.filter(asset=>asset.id!==selectedTicket.assetId&&['In stock','Available'].includes(asset.stockStatus||asset.status||'')&&(!assets.find(item=>item.id===selectedTicket.assetId)?.typeId||asset.typeId===assets.find(item=>item.id===selectedTicket.assetId)?.typeId)).map(asset=><option value={asset.id} key={asset.id}>{assetLabel(asset)}</option>)}</select></label><label className="full">Replacement reason<textarea value={integrationNotes} onChange={event=>setIntegrationNotes(event.target.value)} placeholder="Diagnosis, business impact and reason replacement is required"/></label><button className="support-primary" type="button" onClick={()=>requestReplacement(selectedTicket)}>Submit for dual approval</button></div>}
          {serviceMode==='board'&&<div className="support-kanban">{(['Open','In progress','Awaiting approval','Awaiting employee','Resolved','Closed'] as TicketStatus[]).map(status=><section key={status} onDragOver={event=>event.preventDefault()} onDrop={event=>{const ticket=tickets.find(item=>item.id===event.dataTransfer.getData('text/ticket'));if(ticket&&status!=='Closed')changeTicketStatus(ticket,status)}}><header><strong>{status}</strong><span>{queueTickets.filter(ticket=>ticket.status===status).length}</span></header>{queueTickets.filter(ticket=>ticket.status===status).map(ticket=><button type="button" draggable={ticket.status!=='Closed'} key={ticket.id} onDragStart={event=>event.dataTransfer.setData('text/ticket',ticket.id)} onClick={()=>setSelectedTicketId(ticket.id)}><strong>{ticket.code}</strong><span>{ticket.title}</span><small>{ticket.priority} · {ticket.assignee||'Unassigned'}</small></button>)}</section>)}</div>}
          <div className={`support-agent-layout ${serviceMode==='board'?'board-detail':''}`}><div className="support-panel support-queue-table"><div className="support-queue-head"><span>Select</span><span>Ticket</span><span>Requester</span><span>Owner</span><span>Priority / SLA</span><span>Status</span></div>{queueTickets.map(ticket=>{const sla=slaLabel(ticket);const selected=selectedTicketId===ticket.id;return <div className={`support-queue-row ${selected?'selected':''}`} key={ticket.id}><label className="support-ticket-select"><input type="checkbox" checked={bulkSelection.includes(ticket.id)} onChange={()=>toggleBulkSelection(ticket.id)} aria-label={`Select ${ticket.code}`}/></label><button type="button" onClick={()=>setSelectedTicketId(ticket.id)}><span><strong>{ticket.code}</strong><small>{ticket.title}</small></span><span><strong>{ticket.requesterName}</strong><small>{ticket.requesterEmail}</small></span><span>{ticket.assignee||'Unassigned'}</span><span><strong>{ticket.priority}</strong><small className={`sla-chip ${sla==='Breached'?'breached':sla==='Completed'?'complete':new Date(ticket.resolutionDueAt).getTime()-Date.now()<4*3600000?'risk':''}`}>{sla}</small></span><span className={`support-status ${ticket.status.toLowerCase().replaceAll(' ','-')}`}>{ticket.status}</span></button></div>})}{queueTickets.length===0&&<div className="support-empty">No tickets match the current filters.</div>}</div>
            {selectedTicket&&<aside className="support-panel support-agent-detail"><header><span>{selectedTicket.code}</span><h2>{selectedTicket.title}</h2><p>{selectedTicket.requesterName} · {selectedTicket.requesterEmail}</p></header>{selectedTicket.status==='Closed'?<div className="support-ticket-callout resolved"><strong>Closed ticket</strong><span>{selectedTicket.closedAt?`Closed ${formatDate(selectedTicket.closedAt)}.`:'This ticket is closed.'} Reopen is available to the requester if the issue returns.</span></div>:<div className="support-agent-controls"><div className="support-control-row"><label>Assignee<select disabled={savingTicket} value={draftAssignee} onChange={event=>setDraftAssignee(event.target.value)}><option value="">Unassigned</option><option>IT Service Desk</option><option>IT Asset Manager</option><option>IT Head</option></select></label><label>Status<select disabled={savingTicket} value={draftStatus} onChange={event=>setDraftStatus(event.target.value as TicketStatus)}>{['Open','In progress','Awaiting approval','Awaiting employee','Resolved'].map(value=><option key={value}>{value}</option>)}</select></label><label>Priority<select disabled={savingTicket} value={draftPriority} onChange={event=>setDraftPriority(event.target.value as Ticket['priority'])}>{['Critical','High','Medium','Low'].map(value=><option key={value}>{value}</option>)}</select></label></div>{draftStatus==='Awaiting employee'&&<label>Waiting reason<textarea value={waitingReason} onChange={event=>setWaitingReason(event.target.value)} placeholder="What information is required?"/></label>}{draftStatus==='Resolved'&&<label>Resolution summary<textarea value={resolutionSummary} onChange={event=>setResolutionSummary(event.target.value)} placeholder="Briefly record the resolution"/></label>}<button className="support-primary support-save-ticket" disabled={savingTicket} type="button" onClick={()=>saveTicketControls(selectedTicket)}>{savingTicket?'Saving…':'Save ticket update'}</button></div>}<div className="support-agent-description"><strong>{selectedTicket.category} / {selectedTicket.subcategory}</strong><p>{selectedTicket.description}</p><small>Resolution SLA: {formatDate(selectedTicket.resolutionDueAt)}</small></div><h3>Attachments</h3><AttachmentList attachments={selectedTicket.attachments || []} onOpen={viewAttachment} onPreview={setPreviewAttachment}/>{selectedTicket.status==='Resolved'&&<button type="button" onClick={()=>sendResolutionRating(selectedTicket)}>Send rating invitation</button>}<h3>Employee conversation</h3><div className="support-conversation">{(selectedTicket.messages||[]).filter(message=>message.visibility==='employee').map(message=><article key={message.id}><strong>{message.author}</strong><p>{message.body}</p><small>{formatDate(message.at)}</small></article>)}</div>{selectedTicket.status!=='Closed'&&<div className="support-reply"><div className="support-response-templates"><span>Quick reply</span>{['We are reviewing this now.','Please share a screenshot or the exact error.','The request is complete — please confirm.'].map(template=><button type="button" key={template} onClick={()=>setReplyText(template)}>{template}</button>)}</div><textarea value={replyText} onChange={event=>setReplyText(event.target.value)} placeholder="Reply visible to employee"/><button className="support-primary" type="button" onClick={()=>addMessage(selectedTicket.id,'employee',replyText)}>Send reply</button></div>}<h3>Private IT notes</h3><div className="support-conversation internal">{(selectedTicket.messages||[]).filter(message=>message.visibility==='internal').map(message=><article key={message.id}><strong>{message.author}</strong><p>{message.body}</p><small>{formatDate(message.at)}</small></article>)}</div>{selectedTicket.status!=='Closed'&&<div className="support-reply"><textarea value={internalNote} onChange={event=>setInternalNote(event.target.value)} placeholder="Internal note — not visible to employee"/><button type="button" onClick={()=>addMessage(selectedTicket.id,'internal',internalNote)}>Add private note</button></div>}<h3>Controlled activity</h3>{selectedTicket.history.slice().reverse().map(entry=><div className="support-history" key={`${entry.at}-${entry.event}`}><i/><div><strong>{entry.event}</strong><small>{formatDate(entry.at)} · {entry.actor}</small></div></div>)}</aside>}
          </div>{selectedTicket&&<section className="support-panel support-itms-link"><header><div><strong>Linked ITMS lifecycle</strong><small>{selectedTicket.assetId?assetLabel(assets.find(asset=>asset.id===selectedTicket.assetId) as Asset):'No asset linked to this ticket'}</small></div>{selectedTicket.assetId&&<button type="button" onClick={()=>onOpenItms('Maintenance & Inspection',selectedTicket.assetId)}>Open ITMS maintenance</button>}</header>{selectedTicket.assetId&&<div className="support-itms-actions"><button type="button" onClick={()=>setIntegrationMode(integrationMode==='Repair'?'':'Repair')}>Start repair</button><button type="button" onClick={()=>setIntegrationMode(integrationMode==='Incident'?'':'Incident')}>Log loss / damage</button></div>}{integrationMode==='Repair'&&<div className="support-integration-form"><label>Repair mode<select value={repairMode} onChange={event=>setRepairMode(event.target.value as typeof repairMode)}><option>Internal</option><option>External vendor</option></select></label>{repairMode==='External vendor'&&<><label>Vendor<select value={repairVendorId} onChange={event=>setRepairVendorId(event.target.value)}><option value="">Select vendor</option>{vendors.filter(vendor=>vendor.status!=='Inactive').map(vendor=><option value={vendor.id} key={vendor.id}>{vendor.code} · {vendor.name}</option>)}</select></label><label>Expected return<input type="date" value={expectedReturnDate} onChange={event=>setExpectedReturnDate(event.target.value)}/></label><label>Carrier / person<input value={carrier} onChange={event=>setCarrier(event.target.value)}/></label></>}<label className="full">Diagnosis / fault<textarea value={integrationNotes} onChange={event=>setIntegrationNotes(event.target.value)}/></label><button className="support-primary" type="button" onClick={()=>startRepair(selectedTicket)}>Create ITMS repair{repairMode==='External vendor'?' & gate pass':''}</button></div>}{integrationMode==='Incident'&&<div className="support-integration-form"><label>Incident type<select value={incidentType} onChange={event=>setIncidentType(event.target.value)}><option>Breakage</option><option>Damaged</option><option>Lost</option><option>Stolen</option><option>Escalation</option></select></label><label className="full">Incident details<textarea value={integrationNotes} onChange={event=>setIntegrationNotes(event.target.value)}/></label><button className="support-primary" type="button" onClick={()=>logAssetIncident(selectedTicket)}>Create ITMS incident</button></div>}<div className="support-itms-links">{(selectedTicket.itmsLinks||[]).map(link=><button type="button" key={link.recordId} onClick={()=>onOpenItms(link.kind==='Repair'?'Maintenance & Inspection':'Shared Masters',link.recordId)}><strong>{link.kind}</strong><span>{link.reference}</span><Icon name="arrow" size={16}/></button>)}</div></section>}</section>}
      </main>
      {previewAttachment && <div className="support-preview-backdrop" role="dialog" aria-modal="true" aria-label={`Preview ${previewAttachment.name}`} onClick={() => setPreviewAttachment(null)}><section className="support-preview" onClick={event => event.stopPropagation()}><header><div><strong>{previewAttachment.name}</strong><small>Secure Drive preview · access is controlled by Google Workspace</small></div><button type="button" onClick={() => setPreviewAttachment(null)}>×</button></header>{previewAttachment.contentType.startsWith('image/') ? <img src={previewAttachment.driveUrl || `https://drive.google.com/uc?export=view&id=${encodeURIComponent(previewAttachment.driveFileId || '')}`} alt={previewAttachment.name}/> : <iframe title={previewAttachment.name} src={previewAttachment.driveUrl || `https://drive.google.com/file/d/${encodeURIComponent(previewAttachment.driveFileId || '')}/preview`}/>}<footer><button type="button" onClick={() => viewAttachment(previewAttachment)}>Open in Google Drive</button></footer></section></div>}
    </div>
  </div>
}
