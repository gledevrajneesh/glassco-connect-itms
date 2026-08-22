# GCCP-ITMS-BUILD-19 — Governed Bulk Data Centre

Status: Built; localhost verification pending

## Scope

- Standard downloadable CSV templates for departments, locations, user groups, users, vendors, asset groups, asset types, brands, models, configuration profiles and assets.
- Required import sequence displayed from parent masters through linked users and assets.
- Business codes are used for relationships; internal browser-storage IDs are never requested from operators.
- CSV parser supports quoted values, embedded commas and escaped quotation marks.
- Preview shows line number, business key, validation result and exact rejection reason.
- Add-new-only and update-matching modes.
- Duplicate, required-field, email, numeric and relationship validation.
- Only valid rows may be committed; invalid rows remain unchanged.
- Downloadable CSV error report.
- Immutable batch history capturing dataset, file, mode, counts, actor and timestamp.

## Lifecycle boundary

- Asset import creates controlled inventory records in the selected initial lifecycle state.
- Bulk import does not allocate assets, approve custody, retire assets or bypass lifecycle workflows.
- Users and assets imported through CSV use the same local data stores as manual forms and become immediately available to linked ITMS modules.
