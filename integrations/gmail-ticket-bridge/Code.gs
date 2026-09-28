const CONFIG = {
  projectId: 'glassco-connect-itms-dev',
  alias: 'itsupport@glasscolabs.com',
  mailbox: 'dev@glasscolabs.com',
  authorisedDomain: 'glasscolabs.com',
  processedLabel: 'ITMS-Processed',
  inboxQuery: 'to:itsupport@glasscolabs.com -label:ITMS-Processed newer_than:30d',
  appUrl: 'https://glassco-connect-itms-dev.web.app/',
  supportAttachmentFolderName: 'Glassco CONNECT - Support Desk Attachments',
  supportViewerProperty: 'SUPPORT_ATTACHMENT_VIEWERS',
  inventoryEvidenceFolderName: 'Glassco CONNECT - ITMS Evidence Archive',
  inventoryViewerProperty: 'ITMS_EVIDENCE_VIEWERS'
};

const ATTACHMENT_POLICY = { maxFiles: 10, maxBytes: 15 * 1024 * 1024 };
const ATTACHMENT_EXTENSIONS = ['pdf','doc','docx','xls','xlsx','csv','txt','rtf','jpg','jpeg','png','gif','webp','heic','mp3','wav','m4a','ogg','webm','mp4','mov'];

function installMailboxBridge() {
  GmailApp.createLabel(CONFIG.processedLabel);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runMailboxBridge').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runMailboxBridge').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty('INSTALLED_AT', new Date().toISOString());
  runMailboxBridge();
}

function runMailboxBridge() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    migrateEmailTickets_();
    processPortalAttachmentIntakes_();
    processInventoryAttachmentIntakes_();
    processInboundMessages_();
    processOutboundQueue_();
    const completedAt = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty('LAST_SUCCESS_AT', completedAt);
    firestorePut_('supportBridgeHealth', 'gmail', { status: 'Healthy', lastSuccessAt: completedAt, mailbox: CONFIG.alias, triggerCount: ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runMailboxBridge').length });
  } catch (error) {
    const failedAt = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty('LAST_FAILURE_AT', failedAt);
    PropertiesService.getScriptProperties().setProperty('LAST_FAILURE', String(error));
    try { firestorePut_('supportBridgeHealth', 'gmail', { status: 'Failed', lastFailureAt: failedAt, error: String(error).slice(0, 1000), mailbox: CONFIG.alias }); } catch (_) {}
    throw error;
  } finally { lock.releaseLock(); }
}

function migrateEmailTickets_() {
  if (PropertiesService.getScriptProperties().getProperty('SHARED_TICKETS_MIGRATED')) return;
  firestoreList_('supportEmailTickets').forEach(row => {
    const ticket = JSON.parse(readField_(row.fields.payload));
    if (!firestoreGet_('supportTickets', ticket.id)) firestorePut_('supportTickets', ticket.id, ticket);
  });
  PropertiesService.getScriptProperties().setProperty('SHARED_TICKETS_MIGRATED', new Date().toISOString());
}

function processInboundMessages_() {
  const label = GmailApp.getUserLabelByName(CONFIG.processedLabel) || GmailApp.createLabel(CONFIG.processedLabel);
  GmailApp.search(CONFIG.inboxQuery, 0, 50).forEach(thread => {
    thread.getMessages().forEach(message => {
      const messageId = message.getId();
      if (firestoreGet_('supportInboundMessages', messageId)) return;
      const from = extractEmail_(message.getFrom());
      if (!from.endsWith('@' + CONFIG.authorisedDomain)) {
        firestorePut_('supportInboundMessages', messageId, { messageId, from, status: 'Rejected domain', processedAt: new Date().toISOString() });
        return;
      }
      const ticketCode = nextTicketCode_();
      const now = new Date();
      const ticketId = Utilities.getUuid();
      const attachments = copyEmailAttachments_(message, ticketId, ticketCode, messageId, from, now.toISOString());
      const availableAttachments = attachments.filter(a => !a.unavailable && a.availability !== 'Rejected').length;
      const mailboxOnlyAttachments = attachments.length - availableAttachments;
      const attachmentEvent = attachments.length ? ` · ${availableAttachments} attachment${availableAttachments === 1 ? '' : 's'} shared to Support Desk${mailboxOnlyAttachments ? ` · ${mailboxOnlyAttachments} retained in the IT Support mailbox` : ''}` : '';
      const ticket = { id: ticketId, code: ticketCode, kind: 'Incident', category: 'Email & applications', subcategory: 'Email-raised request', title: message.getSubject() || 'Email support request', description: message.getPlainBody(), priority: 'Low', impact: 'Individual', urgency: 'Normal', status: 'Open', requesterEmail: from, requesterName: from.split('@')[0], assignee: 'IT Service Desk', firstResponseDueAt: new Date(now.getTime() + 4 * 3600000).toISOString(), resolutionDueAt: new Date(now.getTime() + 24 * 3600000).toISOString(), messages: [], attachments: attachments, createdAt: now.toISOString(), updatedAt: now.toISOString(), source: 'Email', history: [{ at: now.toISOString(), event: 'Created from Gmail and automatically routed to IT Service Desk' + attachmentEvent, actor: CONFIG.alias }] };
      firestorePut_('supportEmailTickets', ticketId, { payload: JSON.stringify(ticket), messageId, createdAt: now.toISOString() });
      firestorePut_('supportTickets', ticketId, ticket);
      firestorePut_('supportInboundMessages', messageId, { messageId, ticketId, ticketCode, from, subject: message.getSubject(), attachmentMetadata: JSON.stringify(attachments), status: 'Processed', processedAt: now.toISOString() });
      const acknowledgement = 'Your IT support request has been recorded as ' + ticketCode + '.\n\nOur service desk will review it and keep you informed by email. Please retain the ticket number in future correspondence.';
      GmailApp.sendEmail(from, '[' + ticketCode + '] IT support request received', acknowledgement, { from: CONFIG.alias, name: 'Glassco IT Support', replyTo: CONFIG.alias, htmlBody: ticketEmailHtml_({ ticketCode: ticketCode, heading: 'Request received', status: 'OPEN', intro: 'Your IT support request has been recorded and routed to the IT Service Desk.', details: [['Ticket reference', ticketCode], ['Subject', ticket.title], ['Priority', ticket.priority], ['Assigned team', ticket.assignee]], actionLabel: 'View your support request', actionUrl: CONFIG.appUrl, footer: 'Please retain this ticket reference in future correspondence.' }) });
    });
    thread.addLabel(label);
  });
}

function copyEmailAttachments_(message, ticketId, ticketCode, messageId, sender, uploadedAt) {
  const blobs = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  return blobs.map((blob, index) => copyEmailAttachment_(blob, ticketId, ticketCode, messageId, sender, uploadedAt, index));
}

function copyEmailAttachment_(blob, ticketId, ticketCode, messageId, sender, uploadedAt, index) {
  const name = blob.getName() || `email-attachment-${index + 1}`;
  const contentType = blob.getContentType() || 'application/octet-stream';
  const bytes = blob.getBytes();
  const base = { id: Utilities.getUuid(), name: name, contentType: contentType, size: bytes.length, source: 'Email', uploadedAt: uploadedAt, uploadedBy: sender, messageId: messageId };
  if (index >= ATTACHMENT_POLICY.maxFiles) return Object.assign(base, { unavailable: true, reason: 'More than 10 email attachments' });
  if (bytes.length > ATTACHMENT_POLICY.maxBytes) return Object.assign(base, { unavailable: true, reason: 'Larger than 15 MB' });
  if (!allowedAttachment_(name)) return Object.assign(base, { unavailable: true, reason: 'Unsupported attachment type' });
  try {
    return Object.assign(base, storeCentralDriveAttachment_(blob, ticketId, ticketCode, sender, 'Email', base.id, uploadedAt));
  } catch (error) {
    return Object.assign(base, { unavailable: true, reason: `Mailbox copy unavailable: ${String(error).slice(0, 120)}` });
  }
}

function allowedAttachment_(name) {
  const parts = String(name).toLowerCase().split('.');
  return ATTACHMENT_EXTENSIONS.indexOf(parts[parts.length - 1]) >= 0;
}

function safeAttachmentName_(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'attachment';
}

function supportAttachmentRoot_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('SUPPORT_ATTACHMENT_ROOT_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (error) { properties.deleteProperty('SUPPORT_ATTACHMENT_ROOT_ID'); }
  }
  const root = DriveApp.createFolder(CONFIG.supportAttachmentFolderName);
  root.setDescription('Private, centrally owned Glassco CONNECT IT Support attachment record.');
  properties.setProperty('SUPPORT_ATTACHMENT_ROOT_ID', root.getId());
  return root;
}

function childFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function ticketAttachmentFolder_(ticketCode, occurredAt) {
  const year = String(occurredAt || new Date().toISOString()).slice(0, 4) || String(new Date().getFullYear());
  return childFolder_(childFolder_(supportAttachmentRoot_(), year), safeAttachmentName_(ticketCode));
}

function centralAttachmentDescription_(ticketId, attachmentId, source) {
  return 'Glassco CONNECT Support Desk attachment\nTicket: ' + ticketId + '\nAttachment: ' + attachmentId + '\nSource: ' + source;
}

function configuredSupportViewers_() {
  return String(PropertiesService.getScriptProperties().getProperty(CONFIG.supportViewerProperty) || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

function shareCentralAttachment_(file, requesterEmail) {
  const requester = String(requesterEmail || '').trim().toLowerCase();
  if (requester && requester !== CONFIG.mailbox) file.addViewer(requester);
  configuredSupportViewers_().forEach(viewer => {
    if (viewer && viewer !== CONFIG.mailbox && viewer !== requester) file.addViewer(viewer);
  });
}

function storeCentralDriveAttachment_(blob, ticketId, ticketCode, requesterEmail, source, attachmentId, uploadedAt) {
  const copy = blob.copyBlob().setName(safeAttachmentName_(blob.getName() || 'attachment'));
  const file = ticketAttachmentFolder_(ticketCode, uploadedAt).createFile(copy);
  file.setDescription(centralAttachmentDescription_(ticketId, attachmentId, source));
  shareCentralAttachment_(file, requesterEmail);
  return { provider: 'Google Drive', driveFileId: file.getId(), driveUrl: file.getUrl(), availability: 'Available', importedAt: new Date().toISOString() };
}

function activeSupportRequester_(requesterEmail) {
  const email = String(requesterEmail || '').trim().toLowerCase();
  if (!email || !email.endsWith('@' + CONFIG.authorisedDomain)) return false;
  const record = firestoreGet_('accessAssignments', email);
  if (!record) return false;
  const access = decodeFields_(record.fields || {});
  const applications = Array.isArray(access.appIds) ? access.appIds : [];
  return String(access.email || email).toLowerCase() === email
    && access.status === 'Active'
    && access.employeeStatus !== 'Inactive'
    && (!applications.length || applications.indexOf('support') >= 0);
}

function appendTicketAttachment_(ticket, attachment) {
  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments.slice() : [];
  if (attachments.some(item => item && item.id === attachment.id)) return false;
  attachments.push(attachment);
  const now = new Date().toISOString();
  const history = Array.isArray(ticket.history) ? ticket.history.slice() : [];
  history.push({ at: now, event: attachment.source + ' attachment copied to the controlled IT Support Drive record: ' + attachment.name, actor: CONFIG.alias });
  firestorePatch_('supportTickets', ticket.id, { attachments: attachments, history: history, updatedAt: now });
  return true;
}

function recordAttachmentIntakeFailure_(intakeId, intake, error) {
  const attempts = Number(intake.attempts || 0) + 1;
  firestorePatch_('supportAttachmentIntakes', intakeId, {
    status: attempts < 5 ? 'Retry' : 'Failed',
    attempts: attempts,
    lastAttemptAt: new Date().toISOString(),
    error: String(error || 'Attachment import failed').slice(0, 180),
    failedAt: attempts < 5 ? '' : new Date().toISOString()
  });
}

function importPortalAttachment_(intakeId, intake) {
  const requester = String(intake.requesterEmail || '').trim().toLowerCase();
  if (!activeSupportRequester_(requester)) throw new Error('The requester no longer has active Support Desk access');
  if (intake.source !== 'Portal') throw new Error('Unsupported intake source');
  if (!intake.ticketId || !intake.ticketCode || !intake.sourceDriveFileId || !intake.sourceMarker) throw new Error('Incomplete attachment intake');
  if (!allowedAttachment_(intake.name)) throw new Error('Unsupported attachment type');
  if (!Number(intake.size) || Number(intake.size) > ATTACHMENT_POLICY.maxBytes) throw new Error('Attachment exceeds the 15 MB limit');

  const ticketRecord = firestoreGet_('supportTickets', intake.ticketId);
  if (!ticketRecord) throw new Error('The related ticket was not found');
  const ticket = decodeFields_(ticketRecord.fields || {});
  if (String(ticket.requesterEmail || '').toLowerCase() !== requester) throw new Error('The requester does not own the related ticket');
  if (Array.isArray(ticket.attachments) && ticket.attachments.length >= ATTACHMENT_POLICY.maxFiles) throw new Error('This ticket already has 10 attachments');

  const source = DriveApp.getFileById(String(intake.sourceDriveFileId));
  const expectedMarker = 'glassco-connect-support:' + ticket.id + ':' + intakeId + ':' + requester;
  if (String(source.getDescription() || '') !== expectedMarker || String(intake.sourceMarker) !== expectedMarker) throw new Error('The source file could not be verified');
  if (Number(source.getSize()) !== Number(intake.size)) throw new Error('The source file size did not match the intake');

  const folder = ticketAttachmentFolder_(ticket.code || intake.ticketCode, ticket.createdAt || intake.createdAt);
  const finalFile = source.makeCopy(safeAttachmentName_(intake.name), folder);
  finalFile.setDescription(centralAttachmentDescription_(ticket.id, intakeId, 'Portal'));
  shareCentralAttachment_(finalFile, requester);

  const importedAt = new Date().toISOString();
  const attachment = {
    id: intakeId,
    name: safeAttachmentName_(intake.name),
    contentType: intake.contentType || source.getMimeType() || 'application/octet-stream',
    size: Number(intake.size),
    source: 'Portal',
    uploadedAt: intake.uploadedAt || intake.createdAt || importedAt,
    uploadedBy: requester,
    provider: 'Google Drive',
    driveFileId: finalFile.getId(),
    driveUrl: finalFile.getUrl(),
    availability: 'Available',
    importedAt: importedAt
  };
  appendTicketAttachment_(ticket, attachment);
  firestorePatch_('supportAttachmentIntakes', intakeId, {
    status: 'Copied',
    importedAt: importedAt,
    driveFileId: finalFile.getId()
  });
}

function processPortalAttachmentIntakes_() {
  firestoreList_('supportAttachmentIntakes').forEach(record => {
    const intakeId = record.name.split('/').pop();
    const intake = decodeFields_(record.fields || {});
    if (intake.status !== 'Queued' && intake.status !== 'Retry') return;
    try { importPortalAttachment_(intakeId, intake); }
    catch (error) { recordAttachmentIntakeFailure_(intakeId, intake, error); }
  });
}

function inventoryEvidenceRoot_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('INVENTORY_EVIDENCE_ROOT_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (error) { properties.deleteProperty('INVENTORY_EVIDENCE_ROOT_ID'); }
  }
  const root = DriveApp.createFolder(CONFIG.inventoryEvidenceFolderName);
  root.setDescription('Private, centrally owned Glassco CONNECT ITMS invoice and GRN evidence archive.');
  properties.setProperty('INVENTORY_EVIDENCE_ROOT_ID', root.getId());
  return root;
}

function grnEvidenceFolder_(grn, occurredAt) {
  const year = String(occurredAt || new Date().toISOString()).slice(0, 4) || String(new Date().getFullYear());
  return childFolder_(childFolder_(inventoryEvidenceRoot_(), year), safeAttachmentName_(grn));
}

function configuredInventoryViewers_() {
  return String(PropertiesService.getScriptProperties().getProperty(CONFIG.inventoryViewerProperty) || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

function activeITMSOperator_(uploaderEmail) {
  const userEmail = String(uploaderEmail || '').trim().toLowerCase();
  if (!userEmail || !userEmail.endsWith('@' + CONFIG.authorisedDomain)) return false;
  const record = firestoreGet_('accessAssignments', userEmail);
  if (!record) return false;
  const access = decodeFields_(record.fields || {});
  const applications = Array.isArray(access.appIds) ? access.appIds : [];
  const roles = Array.isArray(access.roleIds) ? access.roleIds : [access.roleId];
  return access.status === 'Active' && access.employeeStatus !== 'Inactive'
    && (!applications.length || applications.indexOf('itms') >= 0)
    && roles.some(role => ['administrator', 'asset-manager', 'it-head'].indexOf(role) >= 0);
}

function recordInventoryIntakeFailure_(intakeId, intake, error) {
  const attempts = Number(intake.attempts || 0) + 1;
  firestorePatch_('inventoryAttachmentIntakes', intakeId, {
    status: attempts < 5 ? 'Retry' : 'Failed', attempts: attempts,
    lastAttemptAt: new Date().toISOString(), error: String(error || 'Evidence import failed').slice(0, 180),
    failedAt: attempts < 5 ? '' : new Date().toISOString()
  });
}

function importInventoryAttachment_(intakeId, intake) {
  const uploader = String(intake.uploaderEmail || '').trim().toLowerCase();
  if (!activeITMSOperator_(uploader)) throw new Error('The uploader no longer has active ITMS evidence permission');
  if (!intake.receiptId || !intake.grn || !intake.sourceDriveFileId || !intake.sourceMarker) throw new Error('Incomplete GRN evidence intake');
  if (intake.source !== 'GRN / portal') throw new Error('Unsupported evidence intake source');
  if (!allowedAttachment_(intake.name) || !Number(intake.size) || Number(intake.size) > ATTACHMENT_POLICY.maxBytes) throw new Error('Evidence type or size is not allowed');
  const receiptRecord = firestoreGet_('operationalStores/receipts/records', intake.receiptId);
  if (!receiptRecord) throw new Error('The related GRN receipt was not found');
  const receipt = decodeFields_(receiptRecord.fields || {});
  if (String(receipt.grn || '') !== String(intake.grn)) throw new Error('GRN reference did not match the receipt');
  const source = DriveApp.getFileById(String(intake.sourceDriveFileId));
  const expectedMarker = 'glassco-connect-grn:' + intake.receiptId + ':' + intakeId + ':' + uploader;
  if (String(source.getDescription() || '') !== expectedMarker || String(intake.sourceMarker) !== expectedMarker) throw new Error('The source evidence could not be verified');
  if (Number(source.getSize()) !== Number(intake.size)) throw new Error('The source evidence size did not match the intake');
  const finalFile = source.makeCopy(safeAttachmentName_(intake.name), grnEvidenceFolder_(intake.grn, intake.createdAt));
  finalFile.setDescription('Glassco CONNECT ITMS evidence\nGRN: ' + intake.grn + '\nReceipt: ' + intake.receiptId + '\nEvidence: ' + intakeId);
  if (uploader && uploader !== CONFIG.mailbox) finalFile.addViewer(uploader);
  configuredInventoryViewers_().forEach(viewer => { if (viewer && viewer !== CONFIG.mailbox && viewer !== uploader) finalFile.addViewer(viewer); });
  const importedAt = new Date().toISOString();
  const bill = { id: intakeId, name: safeAttachmentName_(intake.name), contentType: intake.contentType || source.getMimeType() || 'application/octet-stream', size: Number(intake.size), source: 'GRN / portal', uploadedAt: intake.uploadedAt || intake.createdAt || importedAt, uploadedBy: uploader, provider: 'Google Drive', driveFileId: finalFile.getId(), driveUrl: finalFile.getUrl(), availability: 'Available', importedAt: importedAt };
  firestorePatch_('operationalStores/receipts/records', intake.receiptId, { bill: bill, updatedAt: importedAt });
  firestorePatch_('inventoryAttachmentIntakes', intakeId, { status: 'Copied', importedAt: importedAt, driveFileId: finalFile.getId() });
}

function processInventoryAttachmentIntakes_() {
  firestoreList_('inventoryAttachmentIntakes').forEach(record => {
    const intakeId = record.name.split('/').pop();
    const intake = decodeFields_(record.fields || {});
    if (intake.status !== 'Queued' && intake.status !== 'Retry') return;
    try { importInventoryAttachment_(intakeId, intake); }
    catch (error) { recordInventoryIntakeFailure_(intakeId, intake, error); }
  });
}

function processOutboundQueue_() {
  firestoreList_('supportMailQueue').forEach(doc => {
    const row = doc.fields || {};
    const status = readField_(row.status);
    const attempts = Number(readField_(row.attempts) || 0);
    if ((status !== 'Queued' && status !== 'Retry') || attempts >= 5) return;
    const payload = JSON.parse(readField_(row.payload) || '{}');
    try {
      firestorePatch_('supportMailQueue', doc.name.split('/').pop(), { status: 'Processing', attempts: attempts + 1, lastAttemptAt: new Date().toISOString(), error: '' });
      if (payload.to !== readField_(row.recipient)) throw new Error('Recipient mismatch');
      GmailApp.sendEmail(payload.to, payload.subject, payload.body, { from: CONFIG.alias, name: 'Glassco IT Support', replyTo: CONFIG.alias, htmlBody: outboundEmailHtml_(payload) });
      firestorePatch_('supportMailQueue', doc.name.split('/').pop(), { status: 'Sent', sentAt: new Date().toISOString(), error: '' });
    } catch (error) {
      const retry = attempts + 1 < 5;
      firestorePatch_('supportMailQueue', doc.name.split('/').pop(), { status: retry ? 'Retry' : 'Failed', error: String(error), failedAt: new Date().toISOString(), nextRetryAt: retry ? new Date(Date.now() + 60000).toISOString() : '' });
    }
  });
}

function outboundEmailHtml_(payload) {
  const body = String(payload.body || '');
  const isAccess = payload.event === 'Access notification';
  const ratingUrlMatch = body.match(/https:\/\/[^\s]+\?supportRating=[^\s]+/);
  const resolutionMatch = body.match(/Resolution:\s*([^\n]+)/i);
  const isRating = payload.event === 'Resolution and rating invitation' || Boolean(ratingUrlMatch);
  const isResolved = isRating || /resolved/i.test(String(payload.subject || ''));
  const intro = isResolved ? 'Your IT support request has been resolved.' : cleanEmailText_(body);
  const details = isAccess ? [['Notification', 'Application access'], ['Account', payload.to || '']] : [['Ticket reference', payload.ticketCode || 'Support request']];
  if (resolutionMatch) details.push(['Resolution', resolutionMatch[1].trim()]);
  return ticketEmailHtml_({
    ticketCode: payload.ticketCode,
    heading: isAccess ? 'Workspace access updated' : (isResolved ? 'Request resolved' : 'Support request update'),
    status: isAccess ? 'ACCESS' : (isResolved ? 'RESOLVED' : 'UPDATED'),
    intro: intro,
    details: details,
    actionLabel: isAccess ? 'Open Glassco Workspace' : (isRating ? 'Rate your support' : 'Open Support Desk'),
    actionUrl: ratingUrlMatch ? ratingUrlMatch[0] : CONFIG.appUrl,
    ratingUrl: isRating && ratingUrlMatch ? ratingUrlMatch[0] : '',
    footer: isAccess ? 'This access change was recorded in the controlled audit trail. Contact your administrator if it was unexpected.' : (isRating ? 'The feedback link expires in 30 days and is available only to the ticket requester.' : 'This is an automated service notification from Glassco IT Support.')
  });
}

function cleanEmailText_(body) {
  return String(body || '').replace(/https:\/\/\S+/g, '').replace(/★/g, '').replace(/\s+/g, ' ').trim().slice(0, 500) || 'There is an update on your IT support request.';
}

function ticketEmailHtml_(data) {
  const blue = '#1769e0', navy = '#13233a', muted = '#5d6b82', line = '#d9e2ef', pale = '#f3f7fc';
  const rows = (data.details || []).map(function(row) { return '<tr><td style="padding:8px 0;color:' + muted + ';font-size:13px;width:145px;vertical-align:top">' + escapeHtml_(row[0]) + '</td><td style="padding:8px 0;color:' + navy + ';font-size:13px;font-weight:600;vertical-align:top">' + escapeHtml_(row[1]) + '</td></tr>'; }).join('');
  let stars = '';
  if (data.ratingUrl) {
    stars = '<div style="margin:25px 0 5px;text-align:center"><div style="font-size:13px;color:' + muted + ';margin-bottom:10px">How was your support experience?</div>' + [1,2,3,4,5].map(function(star) { return '<a href="' + escapeHtml_(data.ratingUrl) + '&amp;stars=' + star + '" style="display:inline-block;color:#f2a900;text-decoration:none;font-size:34px;line-height:38px;padding:0 3px" aria-label="Rate ' + star + ' out of 5">★</a>'; }).join('') + '<div style="font-size:11px;color:' + muted + ';margin-top:6px">Select a star to open the secure feedback form</div></div>';
  }
  return '<!doctype html><html><body style="margin:0;padding:0;background:#eef3f9;font-family:Arial,Helvetica,sans-serif;color:' + navy + '"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f9"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid ' + line + ';border-radius:12px;overflow:hidden"><tr><td style="height:5px;background:linear-gradient(90deg,#1769e0 0 25%,#ef5b2a 25% 50%,#f2a900 50% 75%,#198754 75% 100%)"></td></tr><tr><td style="padding:22px 28px;border-bottom:1px solid ' + line + '"><table role="presentation" width="100%"><tr><td><span style="font-size:20px;font-weight:700;letter-spacing:.3px">GLASSCO</span> <span style="font-size:15px;color:' + muted + '">CONNECT · IT SUPPORT</span></td><td align="right"><span style="display:inline-block;padding:6px 10px;background:#eaf7ef;color:#087a3f;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.5px">' + escapeHtml_(data.status) + '</span></td></tr></table></td></tr><tr><td style="padding:30px 28px 12px"><div style="color:' + blue + ';font-size:12px;font-weight:700;letter-spacing:1px">' + escapeHtml_(data.ticketCode || 'IT SUPPORT') + '</div><h1 style="margin:8px 0 10px;font-size:27px;line-height:34px;color:' + navy + '">' + escapeHtml_(data.heading) + '</h1><p style="margin:0;color:' + muted + ';font-size:15px;line-height:23px">' + escapeHtml_(data.intro) + '</p></td></tr><tr><td style="padding:12px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:' + pale + ';border-radius:8px;padding:12px 18px">' + rows + '</table>' + stars + '</td></tr><tr><td align="center" style="padding:15px 28px 30px"><a href="' + escapeHtml_(data.actionUrl) + '" style="display:inline-block;background:' + blue + ';color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 22px;border-radius:7px">' + escapeHtml_(data.actionLabel) + '</a></td></tr><tr><td style="padding:17px 28px;background:#f8fafc;border-top:1px solid ' + line + ';color:' + muted + ';font-size:11px;line-height:17px">' + escapeHtml_(data.footer) + '<br>Glassco IT Support · ' + escapeHtml_(CONFIG.alias) + '</td></tr></table></td></tr></table></body></html>';
}

function escapeHtml_(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function nextTicketCode_() {
  const props = PropertiesService.getScriptProperties(); const year = new Date().getFullYear(); const key = 'COUNTER_' + year; const next = Number(props.getProperty(key) || 0) + 1; props.setProperty(key, String(next)); return 'INC-' + year + '-' + String(next).padStart(4, '0');
}
function extractEmail_(value) { const match = String(value).match(/<([^>]+)>/); return (match ? match[1] : value).trim().toLowerCase(); }
function endpoint_(collection, id) { return 'https://firestore.googleapis.com/v1/projects/' + CONFIG.projectId + '/databases/(default)/documents/' + collection + (id ? '/' + encodeURIComponent(id) : ''); }
function headers_() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Type': 'application/json' }; }
function encodeValue_(value) {
  if (value == null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue_) } };
  if (typeof value === 'object') return { mapValue: encodeFields_(value) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
}
function encodeFields_(data) { const fields = {}; Object.keys(data).forEach(k => { fields[k] = encodeValue_(data[k]); }); return { fields }; }
function decodeFirestoreValue_(field) {
  if (!field || typeof field !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(field, 'nullValue')) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.bytesValue !== undefined) return field.bytesValue;
  if (field.referenceValue !== undefined) return field.referenceValue;
  if (field.arrayValue !== undefined) return (field.arrayValue.values || []).map(decodeFirestoreValue_);
  if (field.mapValue !== undefined) return decodeFields_(field.mapValue.fields || {});
  return undefined;
}
function decodeFields_(fields) {
  const decoded = {};
  Object.keys(fields || {}).forEach(key => { decoded[key] = decodeFirestoreValue_(fields[key]); });
  return decoded;
}
function readField_(field) { return decodeFirestoreValue_(field); }
function firestoreGet_(collection, id) { const response = UrlFetchApp.fetch(endpoint_(collection, id), { method: 'get', headers: headers_(), muteHttpExceptions: true }); if (response.getResponseCode() === 404) return null; if (response.getResponseCode() !== 200) throw new Error('Firestore read failed: ' + response.getResponseCode()); return JSON.parse(response.getContentText()); }
function firestorePut_(collection, id, data) { return UrlFetchApp.fetch(endpoint_(collection, id), { method: 'patch', headers: headers_(), payload: JSON.stringify(encodeFields_(data)), muteHttpExceptions: false }); }
function firestorePatch_(collection, id, data) { const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&'); return UrlFetchApp.fetch(endpoint_(collection, id) + '?' + mask, { method: 'patch', headers: headers_(), payload: JSON.stringify(encodeFields_(data)), muteHttpExceptions: false }); }
function firestoreList_(collection) { let documents = [], token = ''; do { const response = UrlFetchApp.fetch(endpoint_(collection, '') + '?pageSize=100' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { method: 'get', headers: headers_(), muteHttpExceptions: true }); if (response.getResponseCode() !== 200) throw new Error('Firestore list failed: ' + response.getResponseCode()); const page = JSON.parse(response.getContentText()); documents = documents.concat(page.documents || []); token = page.nextPageToken || ''; } while (token); return documents; }
