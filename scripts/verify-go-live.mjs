import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const results = []
const check = (name, passed, detail) => results.push({ level: passed ? 'PASS' : 'FAIL', name, detail })
const warn = (name, detail) => results.push({ level: 'WARN', name, detail })

const firebase = JSON.parse(read('firebase.json'))
const aliases = JSON.parse(read('.firebaserc'))
const rules = read('firestore.rules')
const cloudStore = read('src/lib/cloudStore.ts')
const localStore = read('src/lib/localStore.ts')
const workspaceIntegration = read('src/lib/workspaceIntegration.ts')
const workspaceSearch = read('src/lib/workspaceSearch.ts')
const userNotifications = read('src/lib/userNotifications.ts')
const mailboxBridge = read('integrations/gmail-ticket-bridge/Code.gs')
const gitignore = read('.gitignore')
const packageJson = JSON.parse(read('package.json'))
const envPath = resolve(root, '.env.local')
const env = existsSync(envPath)
  ? Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter((line) => line && !line.trim().startsWith('#') && line.includes('=')).map((line) => { const split = line.indexOf('='); return [line.slice(0, split).trim(), line.slice(split + 1).trim()] }))
  : {}

const expectedProject = 'glassco-connect-itms-dev'
const requiredEnv = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID']

check('Firebase environment enabled', env.VITE_FIREBASE_ENABLED === 'true', 'VITE_FIREBASE_ENABLED must be true for the hosted build.')
check('Firebase public web configuration present', requiredEnv.every((key) => Boolean(env[key])), 'Required public Firebase Web SDK fields must exist in .env.local.')
check('Project identity is consistent', env.VITE_FIREBASE_PROJECT_ID === expectedProject && aliases.projects?.default === expectedProject, 'Environment and Firebase CLI alias must target the company development project.')
check('Classic Hosting serves the production build', firebase.hosting?.public === 'dist' && firebase.hosting?.rewrites?.some((item) => item.source === '**' && item.destination === '/index.html'), 'Hosting must serve dist with the SPA rewrite.')
check('Baseline Hosting security headers exist', ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'].every((key) => JSON.stringify(firebase.hosting?.headers).includes(key)), 'Baseline browser security headers must remain configured.')
check('Firestore defaults to deny', rules.includes('match /{document=**}') && rules.includes('allow read, write: if false'), 'Unmatched documents must remain inaccessible.')
check('Access assignments are identity-scoped', rules.includes('match /accessAssignments/{principalEmail}') && rules.includes('email() == principalEmail'), 'Users may read only their own access assignment; administrators govern the register.')
check('Access events are append-preserved', rules.includes('match /accessEvents/{eventId}') && rules.includes('allow delete: if false'), 'Access-governance history must not be deletable.')
check('Operational stores are role governed', rules.includes('match /operationalStores/{storeId}') && rules.includes('function operationalEditor()') && rules.includes('allow create: if operationalEditor()') && rules.includes('allow update: if operationalEditor()'), 'Operational records require an active governed role.')
check('Operational deletion is prohibited', rules.includes('match /records/{recordId}') && rules.includes('allow delete: if false'), 'First-stage cloud synchronization must never delete operational documents.')
check('Credential files are ignored', gitignore.includes('.env.*') && gitignore.includes('!.env.example') && gitignore.includes('.firebase/'), 'Local configuration and Firebase cache files must not enter Git.')
check('Firebase SDK is pinned in dependencies', Boolean(packageJson.dependencies?.firebase), 'The authenticated build requires the Firebase Web SDK.')
check('Operational stores have a Firestore registry', cloudStore.includes('operationalStoreRegistry') && cloudStore.includes('subscribeOperationalStore') && cloudStore.includes('syncOperationalStore'), 'Shared masters and operational records must use the controlled Firestore adapter after migration.')
check('Operational stores subscribe to live updates', localStore.includes('subscribeOperationalStore') && cloudStore.includes('onSnapshot'), 'Migrated stores must receive cross-session changes in real time.')
check('Mailbox bridge publishes health state', mailboxBridge.includes("supportBridgeHealth', 'gmail'") && rules.includes('match /supportBridgeHealth/{bridgeId}'), 'Support administrators require a durable success/failure heartbeat.')
check('Managed backup command exists', existsSync(resolve(root, 'scripts/backup-firestore.ps1')) && Boolean(packageJson.scripts?.['backup:firestore']), 'A controlled Firestore export command must remain available for scheduled recovery copies.')
check('Cross-app links are immutable and governed', workspaceIntegration.includes('saveWorkspaceLink') && rules.includes('match /workspaceLinks/{linkId}') && rules.includes("request.resource.data.status == 'Active'"), 'ITMS, ITSD, NCR and future apps require permanent controlled record links.')
check('Workspace events are retry safe', workspaceIntegration.includes('idempotencyKey') && workspaceIntegration.includes('subscribePendingWorkspaceEvents') && rules.includes('match /workspaceEvents/{eventId}'), 'Cross-application actions must survive temporary integration failures without duplication.')
check('Integration health is centrally visible', workspaceIntegration.includes('recordIntegrationHealth') && rules.includes('match /workspaceIntegrationHealth/{healthId}'), 'Administrators require live service health and failure visibility.')
check('Central audit is append only', workspaceIntegration.includes('appendWorkspaceAudit') && rules.includes('match /workspaceAudit/{auditId}') && rules.includes('allow update, delete: if false'), 'Cross-app audit records must not be altered or removed.')
check('Workspace search includes ITSD and NCR', workspaceSearch.includes("collection(firestore, 'supportTickets')") && workspaceSearch.includes("collection(firestore, 'ncrRequests')"), 'Global discovery must include the live support and purchase applications.')
check('Notifications support exact record navigation', userNotifications.includes('recordId?: string') && userNotifications.includes('route?: string') && userNotifications.includes('idempotencyKey?: string'), 'Shared notifications require deep links and duplicate protection.')

warn('Migration status boundary', 'Firestore becomes authoritative store-by-store only after each operational store is marked migrated; verify the migration register reports reconciled counts.')
warn('Legacy attachment recovery', 'New GRN evidence is queued to the controlled Drive archive. Existing IndexedDB-only bill records remain device-local until they are re-attached or migrated.')
warn('Recovery drill boundary', 'The managed Firestore export command is available, but the destination bucket, retention policy and restoration drill must be approved in Google Cloud.')

for (const result of results) console.log(`${result.level.padEnd(4)}  ${result.name} — ${result.detail}`)
const failures = results.filter((result) => result.level === 'FAIL')
console.log(`\n${results.length - failures.length} checks passed or acknowledged; ${failures.length} blocking failure(s).`)
if (failures.length) process.exitCode = 1
