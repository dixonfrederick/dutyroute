# Verification record

Verified October 5, 2026, on Windows with Python 3.11 locally and Python 3.12 in Vercel/GitHub Actions. Hosted app: https://dutyroute.vercel.app. Source: https://github.com/dixonfrederick/dutyroute.

## Automated and deployment checks

- **PASS:** 56 pytest cases, including 100 independently checked seeded long-route schedules within one invariant test. Tests assert contiguous timelines, 11/14/8/70-hour budgets, fuel interval, midnight splitting, 24-hour totals, pickup/delivery durations, completed-restart recap reset, input validation and upstream failures.
- **PASS:** 3 Node frontend tests for minute carry, consistent schedule/log timestamp rounding, and CSV escaping.
- **PASS:** React production build; Django system check; static asset collection; npm dependency audit reports 0 known vulnerabilities.
- **PASS:** GitHub Actions on the public repository completed successfully: https://github.com/dixonfrederick/dutyroute/actions/runs/37312847233.
- **PASS:** Vercel build/deploy completed; unauthenticated GET `/` and `/api/health` return HTTP 200.
- **PASS:** Hosted API calculation with 70 current cycle hours returns an initial 34-hour restart, four daily logs and day-one recap still at 70 until the restart actually completes. Each day's four totals add to 24 hours.

## Recorded browser interactions

The real example route Chicago → Indianapolis → Dallas returned 1,080.5 miles, 19h 58m driving, 32h 43m total trip time, delivery completion on October 6 at 16:43 in the supplied home-terminal clock, two log sheets, a 10-hour overnight rest and a fuel stop at mile 1,000. The two rounded daily mileages are 587.1 and 493.3; one-decimal rounding can differ from the rounded route total by 0.1 mile.

| Control / state | Observed result |
| --- | --- |
| Empty trip submit | Displays “Find and select a result for all three locations.” |
| Load example | Populates three real city coordinates and zero cycle hours |
| Calculate trip & logs | Shows loading state, then road route, summary, events and logs |
| Current location Find | Hosted Photon results include Chicago, Illinois; selection updates field |
| Pickup Find | Hosted results include Indianapolis, Indiana; selection updates field |
| Drop-off Find | Hosted results include Dallas, Texas; selection updates field |
| Edit trip after calculation | Displays stale-result notice and requests recalculation |
| Planning assumptions | Expands the actual planning assumptions and FMCSA reference |
| Driver/carrier details | Expands eight labeled fields; test driver entry appears in the log and was removed afterward |
| Map zoom + / − | Both controls respond; working base map tiles and route are visible |
| All nine schedule rows | Each click adds the active-row state and centers its route position; checked individually |
| Daily log sheets | Displays connected four-row duty grid, mileage, remarks, 24-hour totals and day-end cycle recap |
| Day selector | Switches from first to second calendar day with correct continued overnight rest |
| Keyboard Enter on logs tab | Activates logs view with visible focus outline |
| Route instructions | Opens maneuvers with names/distances for both route legs |
| CSV export | Saved `dutyroute-trip.csv`; parsed as 10 rows with 6 columns |
| JSON export | Saved `dutyroute-trip.json`; parsed with 9 events, 2 daily logs and 1,080.5 miles |
| Print all logs / PDF | Invoked the native browser print action. The automation could not inspect the native print preview; PDF pagination is not claimed as visually verified. Print-specific source uses landscape pages and one sheet per day. |

The in-app browser's download-event wait did not report the Blob download, but the real file was present in Downloads and validated independently. The native print action blocks in-app browser control; its tab was closed and a fresh app tab opened. This is a verification limitation, not a saved PDF deliverable.

## Design delivery gate

- **PASS, hard gates:** no invented testimonials/metrics/compliance claims, dead navigation or template FAQ. Empty/loading/error states are present. The actual route and metadata are distinguished from estimates and unsupplied values. The app was built and exercised; print preview limitation is stated above. User explicitly requested uninterrupted completion, so optional antislop setup/approval questions were skipped in favor of a written project direction.
- **PASS, responsive layout:** inspected 390×844 phone viewport (375px document content width because of scrollbar). Document scroll width equals client width, including the logs view. The 760px grid is contained in a 307px scroll area so labels remain legible. Desktop at the default viewport is also inspected. Temporary viewport override was reset.
- **PASS, contrast:** main text on white 11.67:1, secondary text on paper background 5.77:1, white on the amber action 4.72:1, white on teal 11.60:1, teal links on white 7.57:1, pale header text on teal 9.46:1.
- **PASS, purpose:** written color/layout/type/spacing/motion reasons in DESIGN.md. The map and the graph grid display trip data; no decorative illustrations or marketing sections.
- **PASS, liveliness:** ENERGY 2 / RHYTHM 2 / MOTION 1. Working map is the main focal point, amber identifies the calculation and stop locations, and repeated connected duty traces give the product its specific visual structure.
- **PASS, craftsmanship:** native labels/buttons/selectors, visible focus outline, explicit assumption/error copy, actual status graph, real road instructions and validated exports. Browser error/warning log was empty after final production calculation and map zoom checks.

## Operational limits

This is a light assessment/demo deployment using public community map services. Routing lacks commercial-truck restrictions and live traffic. Prior daily cycle history and DST changes are not modeled; conservative restarts and fixed home-terminal wall time are stated in the app and README. Stop pins are estimates, not verified facilities. The outputs are planning logs, not certified ELD records.
