# Glassco CONNECT ITMS — operations resilience

## Authoritative data and release path

- **Authoritative operational data:** Cloud Firestore project `glassco-connect-itms-dev`.
- **Live application:** Firebase Hosting at `https://glassco-connect-itms-dev.web.app`.
- **Source of record:** private GitHub repository `gledevrajneesh/glassco-connect-itms`.
- **Browser storage:** only interface preferences and temporary drafts. It is not an operational system of record.

Every production release must follow this path: pull request or reviewed commit → GitHub validation → production build → Firebase Hosting deployment → smoke test → release note. Never deploy a browser-only change as the sole copy of ITMS work.

## Security baseline before wider rollout

1. Require Google sign-in for all users; do not use anonymous authentication.
2. Enforce MFA for every administrator, IT head, asset manager, and GitHub repository administrator at the identity-provider level.
3. Keep Firestore rules deployed with the application and run `pnpm run test:rules` before a rules release.
4. Keep the administrator account break-glass only; use named least-privilege role assignments for day-to-day work.
5. Enable Firebase App Check only after registering the live web origin and confirming legitimate browser traffic. Enforcing it before registration can lock out the current application.
6. Review Firebase Authentication users, Firestore rules, GitHub collaborators, and the Google Drive backup folder quarterly.

## Monitoring and recovery controls

- Review Firebase usage and errors weekly; set Firebase/Google Cloud budget and quota alerts to notify the IT administrator.
- Use Operations Centre → Backup planner and Backup register for every controlled backup. Record destination, record count, checksum/verification evidence, and operator.
- Export an encrypted/controlled JSON backup to the approved Glassco Google Drive folder at least monthly and before any major release.
- Test a restore into a non-production Firebase project every quarter. Record result, elapsed time, records checked, and corrective actions in the Backup register.
- Treat a failed backup, missing backup verification, unexpected sign-in failure, or Firestore permission-denied error as an operational alert requiring an IT ticket.

## Data retention and archival

| Record class | Minimum operational retention | Treatment |
| --- | --- | --- |
| Active and scrapped assets, allocations, custody movements | 7 years after disposal/return | Mark inactive or archived; never hard-delete through the app. |
| GRNs, handovers, invoices and allocation evidence | 8 years | Retain immutable evidence and references in the controlled archive. |
| Closed support tickets and maintenance history | 3 years | Archive from day-to-day lists; preserve audit trace. |
| Audit, approval, and security activity | 7 years | Append-only; restrict access to authorised reviewers. |
| Former employee records | 7 years after departure, subject to HR/legal policy | Disable access immediately; retain only necessary employment and custody history. |

Before changing retention periods, obtain written approval from Finance, HR, and legal/compliance. Any eventual purge requires a reviewed export, retention-expiry evidence, and an audit entry; it must never be an ad-hoc browser deletion.
