import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { firebaseAuth, firestore, isFirebaseEnabled } from './firebase'

export const operationalStoreRegistry = {
  'itms.departments.v1': 'departments', 'itms.locations.v1': 'locations', 'itms.user-groups.v1': 'userGroups', 'itms.users.v1': 'users',
  'itms.vendors.v1': 'vendors', 'itms.asset-groups.v1': 'assetGroups', 'itms.asset-types.v1': 'assetTypes', 'itms.brands.v1': 'brands',
  'itms.asset-models.v1': 'assetModels', 'itms.config-profiles.v1': 'configurationProfiles', 'itms.receipts.v1': 'receipts', 'itms.assets.v1': 'assets',
  'itms.asset-specifications.v1': 'assetSpecifications', 'itms.asset-model-specifications.v1': 'assetModelSpecifications',
  'itms.asset-specification-history.v1': 'assetSpecificationHistory', 'itms.spare-compatibility.v1': 'spareCompatibility',
  'itms.allocations.v1': 'allocations', 'itms.custody-movements.v1': 'custodyMovements', 'itms.employee-lifecycle.v1': 'employeeLifecycle',
  'itms.asset-maintenance.v1': 'maintenanceRecords', 'itms.asset-verifications.v1': 'assetVerifications', 'itms.asset-disposals.v1': 'assetDisposals',
  'itms.asset-retirements.v1': 'assetRetirements', 'itms.warranty-claims.v1': 'warrantyClaims', 'itms.master-audit.v1': 'masterAuditEvents',
  'itms.asset-label-events.v1': 'labelPrintEvents', 'itms.asset-incidents.v1': 'assetIncidents', 'itms.bulk-import-events.v1': 'bulkImportEvents',
  'itms.notification-rules.v1': 'notificationRules', 'itms.notification-deliveries.v1': 'notificationDeliveries',
  'connect.support-categories.v1': 'supportCategories', 'connect.service-catalogue.v1': 'supportCatalogue',
  'connect.support-teams.v1': 'supportTeams', 'connect.support-routes.v1': 'supportRoutes', 'connect.support-codes.v1': 'supportCodes',
  'connect.support-admin-audit.v1': 'supportAdminAudit', 'connect.support-knowledge.v1': 'supportKnowledge',
  'connect.support-templates.v1': 'supportTemplates', 'connect.support-deliveries.v1': 'supportDeliveries',
  'connect.support-mail-events.v1': 'supportMailEvents',
  'connect.ncr-approval-mappings.v1': 'ncrApprovalMappings',
  'connect.backup-completions.v1': 'backupCompletions',
} as const

export const sharedValueStoreRegistry = {
  'connect.support-sla-policy.v1': 'supportSlaPolicy',
  'connect.support-email-config.v1': 'supportEmailConfiguration',
  'connect.backup-schedule.v1': 'backupSchedule',
  'connect.application-availability.v1': 'applicationAvailability',
  'connect.ncr-master-data.v1': 'ncrMasterData',
  'connect.facilities-master-data.v1': 'facilitiesMasterData',
  'connect.workspace-links.v1': 'workspaceLinks',
  'connect.workspace-events.v1': 'workspaceEvents',
  'connect.workspace-integration-health.v1': 'workspaceIntegrationHealth',
  'connect.workspace-audit.v1': 'workspaceAudit',
} as const

export type OperationalStoreKey = keyof typeof operationalStoreRegistry
export type CloudStoreStatus = { key: OperationalStoreKey; store: string; localCount: number; cloudCount: number; migrated: boolean; reconciled: boolean; updatedAt: string }
type RecordValue = Record<string, unknown>

export const isOperationalStoreKey = (key: string): key is OperationalStoreKey => key in operationalStoreRegistry
export type SharedValueStoreKey = keyof typeof sharedValueStoreRegistry
export const isSharedValueStoreKey = (key: string): key is SharedValueStoreKey => key in sharedValueStoreRegistry
export const cloudOperationalReady = () => Boolean(isFirebaseEnabled && firestore && firebaseAuth?.currentUser)
const clean = (value: unknown) => JSON.parse(JSON.stringify(value)) as RecordValue
const recordId = (record: RecordValue, index: number) => String(record.id || record.code || `record-${index + 1}`).replaceAll('/', '~')
const recordsPath = (key: OperationalStoreKey) => collection(firestore!, 'operationalStores', operationalStoreRegistry[key], 'records')
const valuePath = (key: SharedValueStoreKey) => doc(firestore!, 'operationalValues', sharedValueStoreRegistry[key])

async function migrated(key: OperationalStoreKey) {
  if (!firestore) return false
  const snapshot = await getDoc(doc(firestore, 'operationalStores', operationalStoreRegistry[key]))
  return snapshot.exists() && snapshot.data().migrated === true
}

export async function subscribeOperationalStore<T>(key: OperationalStoreKey, receive: (records: T[]) => void, seedRecords: RecordValue[] = []): Promise<Unsubscribe> {
  if (!firestore || !firebaseAuth?.currentUser) return () => undefined
  if (!(await migrated(key))) {
    if (!key.startsWith('connect.support-') && !key.startsWith('connect.ncr-') && key !== 'connect.backup-completions.v1') return () => undefined
    await writeStore(key, seedRecords, true)
  }
  return onSnapshot(recordsPath(key), (snapshot) => receive(snapshot.docs.map((entry) => entry.data() as T)))
}

export async function syncOperationalStore(key: OperationalStoreKey, records: RecordValue[]) {
  if (!firestore || !firebaseAuth?.currentUser || !(await migrated(key))) return
  await writeStore(key, records, false)
}

export async function subscribeSharedValueStore<T>(key: SharedValueStoreKey, receive: (value: T) => void, seedValue: T): Promise<Unsubscribe> {
  if (!firestore || !firebaseAuth?.currentUser) return () => undefined
  if (!(await getDoc(valuePath(key))).exists()) await syncSharedValueStore(key, seedValue)
  return onSnapshot(valuePath(key), (snapshot) => { if (snapshot.exists()) receive(snapshot.data().value as T) })
}

export async function syncSharedValueStore(key: SharedValueStoreKey, value: unknown) {
  if (!firestore || !firebaseAuth?.currentUser) return
  await setDoc(valuePath(key), { key, value: clean(value), updatedAt: new Date().toISOString(), updatedBy: firebaseAuth.currentUser.email || 'authenticated user' })
}

async function writeStore(key: OperationalStoreKey, records: RecordValue[], activate: boolean) {
  if (!firestore || !firebaseAuth?.currentUser) throw new Error('An authenticated Firebase session is required.')
  const store = operationalStoreRegistry[key]
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(firestore)
    records.slice(offset, offset + 400).forEach((record, index) => batch.set(doc(recordsPath(key), recordId(record, offset + index)), clean(record), { merge: true }))
    await batch.commit()
  }
  await setDoc(doc(firestore, 'operationalStores', store), { storeKey: key, store, migrated: activate || await migrated(key), localRecordCountAtLastSync: records.length, updatedAt: new Date().toISOString(), updatedBy: firebaseAuth.currentUser.email || 'authenticated user' }, { merge: true })
}

export async function migrateLocalStoresToCloud(progress?: (status: CloudStoreStatus) => void) {
  if (!cloudOperationalReady()) throw new Error('Sign in with Firebase before starting migration.')
  const results: CloudStoreStatus[] = []
  for (const key of Object.keys(operationalStoreRegistry) as OperationalStoreKey[]) {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    const records = Array.isArray(parsed) ? parsed as RecordValue[] : []
    await writeStore(key, records, true)
    const cloudCount = (await getDocs(recordsPath(key))).size
    const status = { key, store: operationalStoreRegistry[key], localCount: records.length, cloudCount, migrated: true, reconciled: records.length === cloudCount, updatedAt: new Date().toISOString() }
    results.push(status); progress?.(status)
  }
  for (const key of Object.keys(sharedValueStoreRegistry) as SharedValueStoreKey[]) {
    const stored = localStorage.getItem(key)
    if (stored) await syncSharedValueStore(key, JSON.parse(stored))
  }
  window.dispatchEvent(new Event('itms-cloud-migrated'))
  return results
}

export async function inspectCloudMigration(): Promise<CloudStoreStatus[]> {
  if (!firestore || !firebaseAuth?.currentUser) return []
  return Promise.all((Object.keys(operationalStoreRegistry) as OperationalStoreKey[]).map(async (key) => {
    const store = operationalStoreRegistry[key]
    const local = JSON.parse(localStorage.getItem(key) || '[]')
    const metadata = await getDoc(doc(firestore!, 'operationalStores', store))
    const cloudCount = metadata.exists() && metadata.data().migrated ? (await getDocs(recordsPath(key))).size : 0
    const localCount = Array.isArray(local) ? local.length : 0
    return { key, store, localCount, cloudCount, migrated: metadata.exists() && metadata.data().migrated === true, reconciled: metadata.exists() && metadata.data().migrated === true && localCount === cloudCount, updatedAt: metadata.data()?.updatedAt || '' }
  }))
}
