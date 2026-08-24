# GCCP-ITMS-BUILD-23 — Non-destructive Firestore Operational Migration

Status: adapter and controlled migration interface implemented; rule publication and first authenticated migration require final operator execution.

## Implemented controls

- The shared `useLocalStore` contract now supports Firestore without rewriting individual feature modules.
- Local data remains the fallback and the source for the first controlled migration.
- Each operational array record is stored as an individual Firestore document under `operationalStores/{store}/records/{record}`.
- A store becomes cloud-active only after its migration metadata is committed. An empty, uninitialized cloud store can therefore never overwrite accepted localhost data.
- Migration is non-destructive: it creates or merges records and never deletes Firestore documents.
- Activated stores subscribe to Firestore snapshots and propagate remote changes into the existing module state and local cache.
- Device preferences, navigation focus and notification-read state remain local.
- Operations Centre now shows local/cloud counts, activation state and reconciliation exceptions.
- The migration registry covers 26 business stores, including incident, bulk-import and notification history. Access governance continues to use its dedicated Firebase collections; device role/read preferences remain local.

## Security model

- Active Administrator, IT Asset Manager, IT Head, Auditor and Department Manager roles may read operational stores.
- Only Administrator, IT Asset Manager and IT Head roles may create or update operational records.
- Operational document deletion is denied during this migration stage.
- Only an Administrator may activate or update store metadata.
- Access-event updates and deletion are denied to retain append-only authority history.

## First migration procedure

1. Download the controlled JSON export from Operations Centre.
2. Publish and verify the BUILD-23 Firestore rules.
3. Sign in as `dev@glasscolabs.com`.
4. Open **Operations Centre → Cloud migration**.
5. Select **Refresh status**, then **Migrate local records**.
6. Confirm every migrated store is count-reconciled. A cloud count greater than local requires review; the migration intentionally does not delete the additional cloud record.
7. Refresh the app and test one governed update from a second authorised account/device.

Attachments remain in browser IndexedDB and are not included in this migration. A separately approved documentary-storage strategy remains required for cross-device attachment access.
