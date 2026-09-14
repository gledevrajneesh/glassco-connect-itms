import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from './firebase'

export type SupportAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  source: 'Portal' | 'Email'
  uploadedAt: string
  uploadedBy: string
  provider?: 'Google Drive'
  driveFileId?: string
  driveUrl?: string
  availability?: 'Pending import' | 'Available' | 'Rejected'
  importedAt?: string
  unavailable?: boolean
  reason?: string
}

export type DriveUploadSession = { accessToken: string }

const supportMailbox = 'dev@glasscolabs.com'
const driveFileScope = 'https://www.googleapis.com/auth/drive.file'

export const attachmentPolicy = {
  maxFiles: 10,
  maxBytesPerFile: 15 * 1024 * 1024,
  maxBytesTotal: 50 * 1024 * 1024,
}

const permittedExtensions = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic',
  'mp3', 'wav', 'm4a', 'ogg', 'webm', 'mp4', 'mov',
])

const fallbackContentTypes: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
  txt: 'text/plain', rtf: 'application/rtf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
  webm: 'video/webm', mp4: 'video/mp4', mov: 'video/quicktime',
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'attachment'
const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || ''
const contentTypeOf = (file: File) => file.type || fallbackContentTypes[extensionOf(file.name)] || 'application/octet-stream'
const attachmentMarker = (ticketId: string, intakeId: string, email: string) => `glassco-connect-support:${ticketId}:${intakeId}:${email.toLowerCase()}`

export function validateSupportAttachments(files: File[]) {
  if (files.length > attachmentPolicy.maxFiles) return `Add up to ${attachmentPolicy.maxFiles} files per ticket.`
  const oversized = files.find(file => file.size > attachmentPolicy.maxBytesPerFile)
  if (oversized) return `${oversized.name} is larger than 15 MB.`
  if (files.reduce((total, file) => total + file.size, 0) > attachmentPolicy.maxBytesTotal) return 'Combined attachment size must not exceed 50 MB.'
  const unsupported = files.find(file => !permittedExtensions.has(extensionOf(file.name)))
  if (unsupported) return `${unsupported.name} is not an allowed attachment type.`
  return ''
}

/** Request the least-privilege Drive token only when a user deliberately attaches a file. */
export async function beginSupportAttachmentUpload(): Promise<DriveUploadSession> {
  const user = firebaseAuth?.currentUser
  if (!user) throw new Error('Sign in again before attaching files.')
  if (!user.providerData.some(provider => provider.providerId === 'google.com')) {
    throw new Error('Sign in with Google Workspace before attaching files so they can be shared securely with IT Support.')
  }
  const provider = new GoogleAuthProvider()
  provider.addScope(driveFileScope)
  provider.setCustomParameters({ hd: 'glasscolabs.com', prompt: 'select_account consent' })
  try {
    const result = await reauthenticateWithPopup(user, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) throw new Error('Google Drive permission was not granted.')
    return { accessToken: credential.accessToken }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/popup-closed|cancelled|canceled/i.test(message)) throw new Error('Google Drive permission was not completed. No files were uploaded.')
    throw new Error('Google Drive permission could not be obtained. Please allow the requested Glassco Workspace file access and try again.')
  }
}

async function uploadSourceFile(file: File, session: DriveUploadSession, ticketId: string, ticketCode: string, intakeId: string, uploaderEmail: string) {
  const boundary = `glassco-${crypto.randomUUID()}`
  const contentType = contentTypeOf(file)
  const marker = attachmentMarker(ticketId, intakeId, uploaderEmail)
  const metadata = JSON.stringify({
    name: safeName(file.name),
    mimeType: contentType,
    description: marker,
    appProperties: { product: 'Glassco CONNECT', ticketId, ticketCode, intakeId, source: 'Support Desk portal' },
  })
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  const tail = `\r\n--${boundary}--`
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,resourceKey', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Blob([head, file, tail], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) throw new Error(`Google Drive could not accept ${file.name}.`)
  const created = await response.json() as { id?: string }
  if (!created.id) throw new Error(`Google Drive did not return a file reference for ${file.name}.`)
  const permission = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}/permissions?sendNotificationEmail=false`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: supportMailbox }),
  })
  if (!permission.ok) throw new Error(`${file.name} uploaded, but could not be shared with the IT Support mailbox.`)
  return { sourceDriveFileId: created.id, marker }
}

/**
 * The source file is placed in the requester's Drive and shared only with the
 * IT Support mailbox. The scheduled Glassco Apps Script then verifies and
 * copies it into the private, dev-owned Support Desk Drive folder.
 */
export async function queueSupportAttachments(ticketId: string, ticketCode: string, files: File[], uploaderEmail: string, session: DriveUploadSession): Promise<SupportAttachment[]> {
  if (!files.length) return []
  const issue = validateSupportAttachments(files)
  if (issue) throw new Error(issue)
  if (!firestore) throw new Error('Ticket data is not connected. Please retry in a moment.')
  const email = uploaderEmail.toLowerCase()
  const uploadedAt = new Date().toISOString()
  const queued: SupportAttachment[] = []
  for (const file of files) {
    const id = crypto.randomUUID()
    const uploaded = await uploadSourceFile(file, session, ticketId, ticketCode, id, email)
    await setDoc(doc(firestore, 'supportAttachmentIntakes', id), {
      id,
      ticketId,
      ticketCode,
      requesterEmail: email,
      sourceDriveFileId: uploaded.sourceDriveFileId,
      sourceMarker: uploaded.marker,
      name: file.name,
      contentType: contentTypeOf(file),
      size: file.size,
      source: 'Portal',
      status: 'Queued',
      createdAt: uploadedAt,
      uploadedAt,
      uploadedBy: email,
    })
    queued.push({ id, name: file.name, contentType: contentTypeOf(file), size: file.size, source: 'Portal', uploadedAt, uploadedBy: email, provider: 'Google Drive', availability: 'Pending import' })
  }
  return queued
}

export function normalizeSupportAttachment(value: SupportAttachment | string): SupportAttachment {
  return typeof value === 'string'
    ? { id: `legacy-${value}`, name: value, contentType: '', size: 0, source: 'Portal', uploadedAt: '', uploadedBy: '', unavailable: true, reason: 'Legacy file record' }
    : value
}

export async function openSupportAttachment(value: SupportAttachment | string) {
  const attachment = normalizeSupportAttachment(value)
  if (attachment.availability === 'Pending import') throw new Error('This file is still copying securely to IT Support. It will appear here shortly.')
  const url = attachment.driveUrl || (attachment.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(attachment.driveFileId)}` : '')
  if (!url) throw new Error(attachment.reason || 'This legacy attachment is retained as a record only; its original file is not available in Drive.')
  window.open(url, '_blank', 'noopener,noreferrer')
}
