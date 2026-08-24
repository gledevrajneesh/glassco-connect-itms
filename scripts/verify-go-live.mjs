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
check('Operational stores are role governed', rules.includes('match /operationalStores/{storeId}') && rules.includes("hasRole('auditor')") && rules.includes('allow create, update: if operationalEditor()'), 'Operational records require an active governed role.')
check('Operational deletion is prohibited', rules.includes('match /records/{recordId}') && rules.includes('allow delete: if false'), 'First-stage cloud synchronization must never delete operational documents.')
check('Credential files are ignored', gitignore.includes('.env.*') && gitignore.includes('!.env.example') && gitignore.includes('.firebase/'), 'Local configuration and Firebase cache files must not enter Git.')
check('Firebase SDK is pinned in dependencies', Boolean(packageJson.dependencies?.firebase), 'The authenticated build requires the Firebase Web SDK.')

warn('Operational persistence boundary', 'Masters and transactions still use browser localStorage. Hosting is not a multi-user operational database until the Firestore persistence adapter and migration are completed.')
warn('Attachment persistence boundary', 'Bills and evidence remain in browser IndexedDB. They are device-local and are not included in the JSON controlled export.')
warn('Recovery boundary', 'Controlled JSON export is the current business-record recovery mechanism; restoration must be tested manually before go-live reliance.')

for (const result of results) console.log(`${result.level.padEnd(4)}  ${result.name} — ${result.detail}`)
const failures = results.filter((result) => result.level === 'FAIL')
console.log(`\n${results.length - failures.length} checks passed or acknowledged; ${failures.length} blocking failure(s).`)
if (failures.length) process.exitCode = 1
