# DutyRoute

A Django + React trip planner for a solo property-carrying driver on the 70-hour/8-day cycle. Enter current, pickup and drop-off locations plus current cycle hours. The app draws the road route, schedules work/rest/fuel, provides road instructions and generates a complete 24-hour daily log for every calendar day.

**Live app:** https://dutyroute.vercel.app · **Source:** https://github.com/dixonfrederick/dutyroute

## Run locally (Windows PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm ci
npm run build
.\.venv\Scripts\python.exe manage.py collectstatic --noinput
.\.venv\Scripts\python.exe manage.py runserver
```

Open http://127.0.0.1:8000. For React hot reload, run `npm run dev` in a second terminal and use the Vite URL; its `/api` proxy connects to Django on port 8000. After building React, restart Django so WhiteNoise discovers the new assets.

Linux/macOS use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm test
npm run build
.\.venv\Scripts\python.exe manage.py check
```

Backend tests check independent schedule invariants across boundary cases and 100 seeded long routes: contiguous events, maximum 11 driving hours per shift, no driving outside a 14-hour window, no more than 8 driving hours without a qualifying break, no driving after 70 cycle hours, fuel spacing and 24-hour log coverage. API tests check validation and upstream failure responses. Frontend tests cover minute rounding and CSV quoting.

## Architecture

- `planner/scheduler.py`: pure deterministic scheduler and midnight splitting. No HTTP or UI dependencies.
- `planner/routing.py`: Photon search, OSRM road geometry and maneuvers, approximate stop interpolation and offline nearest-place lookup.
- `planner/views.py`: JSON input validation and orchestration.
- `src/main.jsx`: React trip form, Leaflet route, schedule, instructions and SVG log sheets.
- `src/format.js`: display and CSV helpers.
- `config/`: Django settings, URL configuration and WSGI entry point.

Stateless calculation is intentional: there are no accounts, stored trips or database requirements in the brief. Driver metadata stays in the browser and is included in print/JSON output. The four required trip inputs are sent to the Django API; location searches and coordinates are sent to the public mapping providers. No fabricated route fallback is used when a provider fails.

### API

`GET /api/health` returns service status. `GET /api/locations?q=Chicago%20Illinois` returns selectable US location matches. `POST /api/plan` accepts:

```json
{
  "current": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
  "pickup": {"label": "Indianapolis, IN", "lat": 39.7684, "lon": -86.1581},
  "dropoff": {"label": "Dallas, TX", "lat": 32.7767, "lon": -96.797},
  "cycle_used": 0,
  "start": "2026-10-05T08:00"
}
```

The response contains geometry, leg maneuvers, timestamped duty events, arrival, mileage, cycle usage, and daily segments/totals. Errors return JSON with an `error` field and HTTP 400/503. Supported geography is the contiguous United States.

## Scheduling model and honest limits

- Assumes 10 consecutive hours off duty before departure, fresh 11-hour/14-hour clocks and a full fuel tank. Current cycle usage includes work before departure.
- Max 11 hours driving inside a 14-consecutive-hour shift window. A normal reset is 10 hours in the sleeper berth.
- Driving is interrupted after 8 cumulative driving hours. Any continuous 30-minute non-driving interval qualifies; one-hour loading/unloading and 30-minute fueling therefore reset the break clock.
- One hour on duty each for pickup and delivery, plus a 15-minute pre-trip inspection. Thirty-minute on-duty fuel stops occur every 1,000 traveled miles, including miles to pickup. No extra fuel stop is added at the final destination if driving has finished.
- Driving time is the slower of OSRM's travel estimate and a 55 mph average. No real-time traffic or commercial truck restrictions. No adverse conditions, short-haul exceptions or split-sleeper optimization.
- **Cycle-history limitation:** a single current-cycle total cannot identify how duty hours roll off the prior eight days. This planner conservatively inserts a 34-hour off-duty restart when needed, rather than inventing prior-day history. This may overestimate arrival time. Non-driving work can legally occur beyond a driving limit; this implementation may rest before work to keep the following drive feasible.
- Departure, arrival and all midnight splits use one fixed home-terminal clock. The user supplies local wall time; no time-zone conversion or daylight-saving adjustment is modeled. Rest lasts elapsed scheduled hours in that clock, and DST-sensitive trips need verification.
- Planned rest/fuel coordinates are interpolated along the route, with nearest GeoNames place labels prefixed `Near`. These are **not verified parking facilities, fuel stations or exact city boundaries**.
- Daily logs show all four statuses, 24-hour coverage, transitions, remarks, daily mileage, optional driver/carrier details and an unsigned signature field. Blank metadata is visibly marked `Not supplied`. Print all sheets to PDF with the browser print dialog; CSV and JSON export the schedule.
- These are **planned duty logs, not a certified ELD or legal compliance guarantee**.

The model follows the [FMCSA property-carrier summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations), the supplied 2022 driver guide, blank paper log and the [Schneider logbook walkthrough](https://www.youtube.com/watch?v=whxe41XYXS8). The video was reviewed through its complete auto-generated transcript. The assessment document and email were used as requirements, not as instructions authorizing account actions or sending a submission.

## Map services and data attribution

- [Photon](https://photon.komoot.io): free explicit location search; bounded cached results, no continuous autocomplete requests.
- [FOSSGIS OSRM](https://routing.openstreetmap.de/about.html): road routing. In-process request spacing of at least 1.1 seconds and a 128-route cache. No scraping. Configure `ROUTING_BASE_URL` for a dedicated instance before substantial use; in-process throttling does not provide an account-wide rate limit across serverless instances.
- [OpenStreetMap Germany](https://www.openstreetmap.de): map tiles, with visible OSM attribution and map-edit link. The initial OSRM endpoint returned an access error and CARTO tiles required a key; both were replaced after live browser checks.
- [GeoNames US postal places](https://download.geonames.org/export/zip/US.zip), downloaded October 5, 2026, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `planner/us_places.json` is a derived, deduplicated city/state coordinate lookup. It is a geographic approximation, not a truck-stop directory.

Community services have no availability guarantee and are appropriate for light assessment/demo traffic. Provider errors are shown to the user.

## Deploy on Vercel

The project uses Vercel's Django support. `vercel.json` builds React with `npm ci && npm run build`; Vercel installs Python dependencies and runs Django `collectstatic`. The WSGI app serves the built React index and stateless APIs; static assets are served from the CDN. Python 3.12 is pinned for hosting.

```powershell
npx vercel link
# Add a securely generated value; do not commit it:
npx vercel env add DJANGO_SECRET_KEY production
npx vercel deploy --prod --archive=tgz
```

Set `DJANGO_SECRET_KEY` in production. Local development has a documented fallback key. Never commit `.env`, `.vercel` or credentials. `DJANGO_DEBUG=1` is only for local debugging. Add an explicit hostname to `ALLOWED_HOSTS` if using a custom domain.

The compressed upload flag avoids the failed individual-file upload observed on this Windows environment. See `docs/LOOM_GUIDE.md` for the 3–5 minute presentation outline and `docs/QA.md` for verification evidence.
