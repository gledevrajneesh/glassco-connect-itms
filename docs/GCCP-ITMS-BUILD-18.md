# GCCP-ITMS-BUILD-18 — Firebase Deployment Foundation

Status: Configuration prepared; company project creation and deployment pending

## Ownership

- Firebase and Google Cloud administration account: `dev@glasscolabs.com`.
- ITMS must use a separate Firebase project from Glassco PRISM.
- The project must remain on the no-cost Spark plan unless a future commercial-impact change is explicitly approved.

## Prepared hosting controls

- Vite production output is served only from `dist`.
- Single-page application navigation rewrites to `index.html`.
- Versioned JavaScript and CSS assets receive immutable cache headers.
- Baseline browser security headers are defined.
- No Firebase project ID, API configuration, token, service-account key or credential is committed.

## Interactive steps still required

1. Sign in to Firebase Console using `dev@glasscolabs.com`.
2. Create a dedicated ITMS development project and keep the Spark plan.
3. Record the generated project ID in a local `.firebaserc` file, not in the template.
4. Register the web app and connect Firebase Authentication/Firestore only after rules and environment separation are prepared.
5. Build, preview and deploy Hosting after an explicit pre-deployment review.

## Commercial boundary

Do not link a Cloud Billing account, enable Blaze-only services, or deploy Cloud Functions during this phase.
