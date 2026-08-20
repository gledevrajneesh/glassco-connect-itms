# GCCP-ITMS-LIFECYCLE-RELATIONSHIP-LOCK-01

Status: **APPROVED AND LOCKED**

## Governing principle

ITMS uses permanent User IDs and Asset IDs connected through append-only lifecycle transactions. Master records are never duplicated to represent a change in custody, department, location, employment period or asset state.

## Supported custody relationships

- Employee to asset
- Department, location, room, project or shared pool to asset
- Vendor or internal technician temporary repair custody
- Parent asset to component or dependent asset
- Allocation kit containing independently tracked assets and accessories
- Quantity-based consumable issue records without serialized custody

One serialized asset may have only one active custodian. One custodian may hold multiple assets.

## Asset lifecycle

Approved model, procurement, goods receipt, inspection, registration, stock, reservation, allocation approval, active custody, transfer, maintenance, temporary issue, replacement, return, inspection, stock recovery, retirement and disposal.

Returned assets do not become allocatable until inspection and stock release are complete. Replacement transactions permanently link the old and new Asset IDs.

## User lifecycle

Planned, pending onboarding, active, review required, transfer pending, temporarily inactive, reactivation pending, offboarding pending, clearance pending, exception pending, fully cleared and inactive.

Users are never deleted. Rehire or reactivation retains the same historical identity and starts a new employment period. Offboarding cannot complete while custody or unresolved exceptions remain.

## Date model

Every controlled activity distinguishes:

- Planned date
- Effective date
- Recorded timestamp

Warranty, lifecycle, allocation, return, inspection, maintenance, repair, retirement, disposal, joining, transfer, last-working-day, clearance and reactivation dates remain traceable.

## Relationship ledger

Each transaction retains:

- Employee or organisational custodian ID
- Asset ID or consumable item reference
- Transaction code and relationship type
- Previous and new status
- Department and location at the time
- Planned and effective dates
- Recorded timestamp
- Requester, actor and approvers
- Reason, remarks and related transaction
- Optional evidence and acknowledgement references

History is corrected through reversal or amendment events, never destructive deletion.

## Required controls

- New, replacement and temporary allocations
- Custody kits and accessories
- Expected returns, reminders and overdue escalation
- Repair custody and vendor handover
- Lost, stolen, damaged, recovery, waiver and closure workflow
- PDF/email/signature acknowledgement tracking
- Approval delegation with attributable authority
- Bulk-import duplicate detection and reconciliation
- Periodic physical stock and custody verification
- Role separation for masters, receipt, allocation, approval, inspection, reporting and audit
- Notifications for lifecycle and exception events
- Retention of former-user, retired-asset and acknowledgement records

## Authoritative ownership

The shared User Master is the authoritative platform identity source. HR or controlled imports may supply employment data; ITMS controls IT-specific custody and lifecycle status. Asset Catalogue and Asset Register remain the authoritative product and Asset ID sources.

All subsequent ITMS modules, reports, dashboards, PDFs, notifications and future IT Support Desk integrations must use this relationship ledger and lifecycle model.
