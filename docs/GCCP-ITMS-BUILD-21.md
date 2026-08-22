# GCCP-ITMS-BUILD-21 — Firebase Development Foundation

Status: architecture gate approved; Firebase project connection pending.

## Current-state audit

- The accepted ITMS application stores all masters, transactions, relationships, settings and audit trails in browser `localStorage` through `useLocalStore`.
- Role selection is presently a localhost simulator and is not an authenticated identity control.
- Firebase Hosting configuration exists and serves `dist` with an SPA rewrite and baseline security headers.
- No Firebase Web SDK, Authentication client, Firestore client, Firestore rules or indexes are installed.
- No real Firebase configuration is tracked. `.env`, `.env.*`, Firebase cache data and debug logs are ignored; `.env.example` contains placeholder keys only.
- The repository contains no tracked service-account, credential, private-key or admin-SDK file.

## Approved Spark-only architecture

1. Create a separate company-owned Firebase project using `dev@glasscolabs.com`.
2. Keep the project on the no-cost Spark plan with no Cloud Billing account attached.
3. Register one Web app for Glassco Connect ITMS.
4. Use Firebase Authentication for controlled company identities. Initial providers: Email/Password; Google sign-in may be enabled for company accounts after domain-access validation.
5. Use exactly one default Cloud Firestore database.
6. Use classic Firebase Hosting for the Vite static build.
7. Keep documentary evidence in approved controlled links. Do not enable Cloud Storage while the no-billing requirement remains in force.
8. Do not use Cloud Functions, Cloud Run, App Hosting, paid Google Cloud APIs, phone authentication, managed Firestore backups/restores, PITR, TTL or database cloning.

## Migration model

- Introduce a persistence adapter so feature components no longer depend directly on browser storage.
- Retain local storage only as an explicitly labelled development fallback and one-time migration source.
- Store every business record as an individual Firestore document, not as a single oversized array document.
- Preserve existing business IDs, codes, timestamps and relationship identifiers during migration.
- Create append-only audit-event collections for governed transitions.
- Resolve effective role and authorised modules from the authenticated user access record; remove role simulation from production mode.
- Deny all Firestore access by default, then allow the minimum collection operations required for each governed role.

## Proposed collection groups

- `platformUsers`, `accessAssignments`, `accessEvents`
- `departments`, `locations`, `userGroups`, `users`, `vendors`
- `assetGroups`, `assetTypes`, `brands`, `assetModels`, `configurationProfiles`
- `receipts`, `assets`, `allocations`, `custodyMovements`, `employeeLifecycle`
- `maintenanceRecords`, `assetIncidents`, `assetVerifications`, `assetDisposals`
- `assetRetirements`, `warrantyClaims`, `notificationRules`, `notificationDeliveries`
- `masterAuditEvents`, `bulkImportEvents`, `labelPrintEvents`

## Free-plan operating controls

- Current published Firestore allowance: 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB/month outbound transfer.
- Exactly one database receives the free quota.
- Managed backup, restore, point-in-time recovery, TTL deletion and cloning require billing and are excluded.
- Spark Email/Password/social authentication is suitable for the expected internal user count; phone/SMS authentication is excluded.
- Full controlled JSON exports remain the recovery mechanism until a separately approved backup design exists.
- Monitor Firestore and Hosting usage in the Firebase console; never attach a Cloud Billing account without a separate commercial approval.

## Connection checklist

- [ ] Company-owned Firebase project created by `dev@glasscolabs.com`
- [ ] Spark plan visibly confirmed
- [ ] Web app registered
- [ ] Email/Password provider enabled
- [ ] Default Firestore database created in the agreed region
- [ ] Project ID and public Web app configuration copied to local `.env.local`
- [ ] Firebase SDK installed and environment validation added
- [ ] Authentication gate implemented
- [ ] Firestore adapter, rules and indexes implemented
- [ ] Local export imported into development Firestore and reconciled
- [ ] Emulator/rules tests, build, lint and user acceptance completed
- [ ] Hosting deployed only after data and access validation
