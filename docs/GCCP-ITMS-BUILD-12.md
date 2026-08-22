# GCCP-ITMS-BUILD-12 — Asset Maintenance & Inspection

## Accepted scope

- Asset-linked preventive maintenance, inspection, repair and calibration schedules.
- Automatic maintenance reference codes and accountable responsible person.
- Optional approved vendor, frequency, due date and work instructions.
- Due-list views for overdue, next 7 days and next 30 days.
- Controlled completion with performed date, technician, outcome, cost and findings.
- Optional next-due date automatically creates the follow-on schedule.
- Explicit lifecycle disposition can retain the current state or move an asset to in stock, under repair, quarantine or scrap.
- Completed and scheduled events appear in the asset lifecycle timeline.
- Relevant events also appear in the historical employee IT asset profile.

## Control principles

- Maintenance history is append-only; completion creates a retained service event.
- Asset status changes occur only when an authorised completion explicitly selects a disposition.
- Employee and asset lifecycle relationships remain derived from governed custody history.
- This checkpoint remains localhost-only and introduces no cloud or paid service dependency.

## Validation

- TypeScript production build: passed.
- Lint: passed.
- Git whitespace validation: passed.
