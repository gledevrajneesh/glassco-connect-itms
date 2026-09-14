import { doc, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'
import { attachmentPolicy, beginSupportAttachmentUpload, type DriveUploadSession } from './supportAttachmentStore'

export type InventoryAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  source: 'GRN / portal'
  uploadedAt: string
  uploadedBy: string
  provider: 'Google Drive'
  availability: 'Pending import' | 'Available' | 'Rejected'
  driveFileId?: string
  driveUrl?: string
  importedAt?: string
  reason?: string
}

const supportMailbox = 'dev@glasscolabs.com'
const allowed = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'webp'])
const fallbackTypes: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}
const extension = (name: string) => name.split('.').pop()?.toLowerCase() || ''
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'invoice'
const contentType = (file: File) => file.type || fallbackTypes[extension(file.name)] || 'application/octet-stream'

export { beginSupportAttachmentUpload as beginInventoryAttachmentUpload }

export function validateInventoryBill(file: File | null) {
  if (!file) return ''
  if (file.size > attachmentPolicy.maxBytesPerFile) return `${file.name} is larger than 15 MB.`
  if (!allowed.has(extension(file.name))) return 'Attach a PDF, Office document, CSV, text file or image evidence.'
  return ''
}

async function uploadSource(file: File, session: DriveUploadSession, receiptId: string, grn: string, intakeId: string, email: string) {
  const boundary = `glassco-grn-${crypto.randomUUID()}`
  const marker = `glassco-connect-grn:${receiptId}:${intakeId}:${email}`
  const mime = contentType(file)
  const metadata = JSON.stringify({
    name: safeName(file.name), mimeType: mime, description: marker,
    appProperties: { product: 'Glassco CONNECT', receiptId, grn, intakeId, source: 'ITMS GRN' },
  })
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
  const tail = `\r\n--${boundary}--`
  const upload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Blob([head, file, tail], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!upload.ok) throw new Error(`Google Drive could not accept ${file.name}.`)
  const created = await upload.json() as { id?: string }
  if (!created.id) throw new Error('Google Drive did not return a file reference.')
  const sharing = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}/permissions?sendNotificationEmail=false`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: supportMailbox }),
  })
  if (!sharing.ok) throw new Error('The bill was uploaded but could not be shared with the controlled Glassco Drive.')
  return { sourceDriveFileId: created.id, marker }
}

/** Queue a receipt bill for a server-side copy into the private Glassco Drive evidence archive. */
export async function queueInventoryBill(receiptId: string, grn: string, file: File, uploaderEmail: string, session: DriveUploadSession): Promise<InventoryAttachment> {
  const problem = validateInventoryBill(file)
  if (problem) throw new Error(problem)
  if (!firestore) throw new Error('Inventory data is not connected. Please retry after cloud sync loads.')
  const id = crypto.randomUUID()
  const email = uploaderEmail.toLowerCase()
  const uploadedAt = new Date().toISOString()
  const source = await uploadSource(file, session, receiptId, grn, id, email)
  await setDoc(doc(firestore, 'inventoryAttachmentIntakes', id), {
    id, receiptId, grn, uploaderEmail: email, sourceDriveFileId: source.sourceDriveFileId, sourceMarker: source.marker,
    name: file.name, contentType: contentType(file), size: file.size, source: 'GRN / portal', status: 'Queued', createdAt: uploadedAt, uploadedAt,
  })
  return { id, name: file.name, contentType: contentType(file), size: file.size, source: 'GRN / portal', uploadedAt, uploadedBy: email, provider: 'Google Drive', availability: 'Pending import' }
}

export function normalizeInventoryAttachment(value: unknown): InventoryAttachment | null {
  if (!value || typeof value !== 'object') return null
  return value as InventoryAttachment
}

export function openInventoryAttachment(value: InventoryAttachment) {
  if (value.availability === 'Pending import') throw new Error('The bill is copying securely to the Glassco evidence archive. It will be available shortly.')
  const url = value.driveUrl || (value.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(value.driveFileId)}` : '')
  if (!url) throw new Error(value.reason || 'The receipt record exists but its legacy bill is not available in the central archive.')
  window.open(url, '_blank', 'noopener,noreferrer')
}
