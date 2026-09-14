# Support Desk shared-data release — 3 September 2026

Published to https://glassco-connect-itms-dev.web.app with dev@glasscolabs.com.

## Delivered

- Shared supportTickets, supportRatings, and supportRequests collections.
- Employee queries restricted by requester email, enforced by Firestore rules.
- Private notes stored separately in an agent-only collection.
- Transactional field-conflict checks for edits.
- Rating links open Support Desk after login, require the requester identity, expire after 30 days, and allow one 1–5-star submission.
- Email worker writes shared tickets and migrates existing email-ingestion records once without replacing existing shared records.
- Mail worker fails on Firestore read/list failures and serializes executions with a script lock.

## Verification

- Production TypeScript/Vite build passed (bundle-size warning remains).
- 22 isolated Firebase emulator security checks passed, using scripts/test-support-rules.mjs and firebase.test.json with demo-glassco-support.
- Hosting and Firestore rules deployment succeeded.
- Apps Script migration/processing execution completed successfully.
- Hosted login page loaded. Authenticated cross-device UI testing awaits sign-in; do not claim that end-to-end UI test has passed.

## Remaining boundaries

- Old browser-only portal tickets and rating invitations were not automatically imported. Local storage is untouched; email tickets were migrated by the worker.
- Knowledge/SLA/catalogue configuration and simulated delivery history still retain their existing local storage behavior. Do not treat these panels as proof of actual Gmail delivery.
- Attachments remain names/metadata or existing device-local files; this release does not add cloud attachment storage.
- Email acknowledgement retries and reply-to-existing-thread handling require further hardening. Previously failed acknowledgements are not automatically resent.
- Test live status email, closure invitation and requester rating submission before operational rollout.
- Local Apps Script manifest and deployed scopes require review before future redeployment. Automatic broadening of local Gmail scopes was blocked; no local scope change was made in this release.
