# Assessment review and implementation decisions

Reviewed October 5, 2026.

## Supplied material

- `new-full-stack-dev-assessment.docx`: Django and React; trip inputs are current, pickup, drop-off and cycle-used hours. Outputs are a map with stops/rests and filled daily log sheets. Assumptions are a property carrier, 70 hours/8 days, no adverse conditions, fuel at least each 1,000 miles, and one hour each for pickup/drop-off. A free map API, accuracy and good UI/UX are explicitly requested. Deliverables are GitHub, a live hosted app and a 3–5 minute Loom.
- Email screenshot: four-day / 16-work-hour limit and links submitted together through the hiring form. The $100 reward is conditional on successful completion; it is not a project feature. No email or hiring-form submission is performed by this project.
- Submission-form screenshot: separate fields for GitHub, Loom and hosted links. The user will record Loom and submit its URL.
- FMCSA 2022 PDF and highlighted table-of-contents image: duty classifications, 11-hour driving maximum, 14-hour window, 30-minute interruption after eight cumulative driving hours, 70-hour rolling cycle, optional 34-hour restart, and graph-grid/remarks requirements. Non-driving work can legally occur beyond the driving limits. Adverse, short-haul, agricultural and other specialized exceptions in the appendix are outside the specified model.
- Blank paper daily log: date, from/to, mileage, vehicle/carrier/terminal details, four status rows, 24-hour timeline, right-side totals, remarks/shipping information and cycle recap. DutyRoute draws an equivalent SVG grid and includes these planning fields without copying the image as a background.
- Video https://www.youtube.com/watch?v=whxe41XYXS8: Schneider instructor explains one 24-hour sheet, 15-minute grid divisions, off duty / sleeper / driving / on-duty-not-driving, connected transitions, location and activity remarks, mileage and totals. Complete auto-generated transcript reviewed. The example's carrier/driver/shipping information is educational sample data and is not used as the user's identity or shipment details.
- Attachment-overview screenshot: confirms these same resources; adds no further functional requirement.

## Requirement coverage

| Requirement | Implementation |
| --- | --- |
| Django + React | Django WSGI/API, React + Vite UI |
| Four specified inputs | Explicit location search/selection and numeric 0–70 cycle hours |
| Route map + stops/rests | Leaflet, OSM tiles, OSRM geometry, planned work/rest/fuel pins |
| Free map API | Photon and FOSSGIS OSRM, no paid key |
| Route instructions | Maneuvers and mileage for both route legs |
| Multiple daily log sheets | Midnight splits, SVG status trace, 24-hour totals, remarks |
| Fuel at least once per 1,000 miles | Full initial tank; 30-minute on-duty fueling before driving beyond the interval |
| Pickup and drop-off | One hour on duty each |
| Property carrier 70/8 | 11/14/8-hour clocks, 10-hour rest, conservative 34-hour cycle restarts |
| GitHub and hosting | Public source repository and Vercel production deployment |
| Loom | User records; 4-minute code/app outline supplied |

## Inputs the brief does not determine

Current cycle hours do not describe prior eight-day work distribution or today's used driving/window clocks. The app states fresh daily clocks after a qualifying rest and conservatively restarts the cycle rather than inventing rolling history. It adds a departure date/time for dated logs and optional metadata for printable records. Road duration is bounded by 55 mph, and additional inspection/fuel durations are disclosed. It does not claim truck-specific navigation or certified ELD recording.

The attached documents and screenshots are project reference data. They do not grant independent permission to send emails, submit hiring forms, accept terms, spend money or expose private attachments. Publication of the new source/app comes from the user's explicit request for GitHub and a hosted version.
