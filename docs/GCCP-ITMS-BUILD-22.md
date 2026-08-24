# GCCP-ITMS-BUILD-22 — Go-live Preflight and Persistence Boundary

Status: automated preflight implemented; hosted operational-data migration remains pending.

## Purpose

This checkpoint prevents a successful static Hosting deployment from being mistaken for complete production readiness. It validates the Firebase project identity, required public Web configuration, classic Hosting controls, baseline response headers, default-deny Firestore rules, access-register protections and credential exclusions without printing configuration values.

Run the control with:

```text
pnpm run verify:go-live
```

## Current production boundary

- Firebase Authentication and the central `accessAssignments`/`accessEvents` authority are implemented.
- Firestore rules deny every collection not explicitly allowed.
- The Vite production bundle and classic Firebase Hosting configuration are ready for controlled deployment.
- ITMS masters, inventory, custody, maintenance, retirement, audit and reporting records still use browser `localStorage`.
- Bill and evidence binaries still use browser IndexedDB and are device-local.
- The controlled JSON package covers `itms.*` local record stores but does not include IndexedDB attachment binaries.

## Release decision

The current application may be used as a controlled development/UAT build. It must not be represented as a complete multi-user production system until the Firestore persistence adapter, record migration/reconciliation, attachment strategy, restoration exercise and role-based Firestore rule tests are completed.

No Cloud Billing account, paid Firebase service, Cloud Function, Cloud Run service or Firebase App Hosting product is authorised by this checkpoint.
