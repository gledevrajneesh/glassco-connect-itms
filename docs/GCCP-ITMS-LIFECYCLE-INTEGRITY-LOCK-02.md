# GCCP-ITMS-LIFECYCLE-INTEGRITY-LOCK-02

Employee lifecycle and IT asset lifecycle are one integrated control system.

## Invariants

1. One asset can have only one current custodian or one open reservation.
2. Allocation submission reserves the asset; approval locks it as Allocated.
3. Transfer changes custody without creating duplicate inventory.
4. Return/revoke ends custody and records In stock, Under repair or Scrap disposition.
5. Offboarding cannot complete while current custody remains unresolved.
6. An inactive employee cannot retain current custody.
7. Closed historical transactions never block future availability.
8. Every module must write through governed lifecycle events and pass Lifecycle Integrity checks.
